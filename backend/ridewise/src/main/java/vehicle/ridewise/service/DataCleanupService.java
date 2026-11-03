package vehicle.ridewise.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.repository.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DataCleanupService — automatic database maintenance for RideWise.
 *
 * 1. EVENT-DRIVEN (immediate)
 *    cleanupRideLocationData(rideId) — removes a ride's GPS breadcrumbs and
 *    live positions when the ride ends or is deleted.
 *    deleteRideCompletely(rideId) — removes a ride and all its associated
 *    locations, participants, and notifications.
 *
 * 2. SCHEDULED (every 6 hours, first run 60 s after startup)
 *    - per-user auto-delete of finished rides based on user's autoDeleteRidesDays setting
 *    - read notifications older than 30 days
 *    - any notification older than 90 days
 *    - the large route TEXT columns of rides that ended more than 7 days ago
 *      (names, distance and duration are kept)
 *    - GPS breadcrumbs left behind by rides that have ended
 *    - live positions that have not been refreshed for hours
 *    - organization fleets: the planned road of vehicle trips that ended
 *      more than 7 days ago, recorded trip paths older than 90 days,
 *      activity-log entries older than 180 days, announcements older
 *      than 90 days
 *
 * 3. USER CLEANUP
 *    cleanupUserData(userId) — removes everything belonging to a user.
 */
@Service
public class DataCleanupService {

    private static final Logger log = LoggerFactory.getLogger(DataCleanupService.class);
    private static final List<String> ENDED = List.of("completed", "cancelled");

    private final LocationUpdateRepository locationUpdateRepository;
    private final UserLocationRepository userLocationRepository;
    private final NotificationRepository notificationRepository;
    private final RideParticipantRepository rideParticipantRepository;
    private final ConnectionRepository connectionRepository;
    private final RideRepository rideRepository;
    private final UserRepository userRepository;
    private final VehicleSessionRouteRepository vehicleSessionRouteRepository;
    private final VehicleSessionPointRepository vehicleSessionPointRepository;
    private final OrgAuditLogRepository orgAuditLogRepository;
    private final OrgAnnouncementRepository orgAnnouncementRepository;

    public DataCleanupService(LocationUpdateRepository locationUpdateRepository,
                              UserLocationRepository userLocationRepository,
                              NotificationRepository notificationRepository,
                              RideParticipantRepository rideParticipantRepository,
                              ConnectionRepository connectionRepository,
                              RideRepository rideRepository,
                              UserRepository userRepository,
                              VehicleSessionRouteRepository vehicleSessionRouteRepository,
                              VehicleSessionPointRepository vehicleSessionPointRepository,
                              OrgAuditLogRepository orgAuditLogRepository,
                              OrgAnnouncementRepository orgAnnouncementRepository) {
        this.vehicleSessionRouteRepository = vehicleSessionRouteRepository;
        this.vehicleSessionPointRepository = vehicleSessionPointRepository;
        this.orgAuditLogRepository = orgAuditLogRepository;
        this.orgAnnouncementRepository = orgAnnouncementRepository;
        this.locationUpdateRepository = locationUpdateRepository;
        this.userLocationRepository = userLocationRepository;
        this.notificationRepository = notificationRepository;
        this.rideParticipantRepository = rideParticipantRepository;
        this.connectionRepository = connectionRepository;
        this.rideRepository = rideRepository;
        this.userRepository = userRepository;
    }

    // ═══════════════════════════════════════════════════════════════
    // 1. EVENT-DRIVEN: a ride ended or was deleted
    // ═══════════════════════════════════════════════════════════════

    /**
     * Deletes the GPS breadcrumbs (location_updates) and the live latest
     * positions (user_locations) of one ride. The distance ridden is
     * already saved on the ride row, and a finished ride must not leave
     * stale markers on anyone's map.
     *
     * Runs inside the caller's transaction, so it commits — or rolls back —
     * together with the ride change that triggered it.
     */
    @Transactional
    public void cleanupRideLocationData(Long rideId) {
        locationUpdateRepository.deleteByRideId(rideId);
        userLocationRepository.deleteByRideId(rideId);
    }

    /**
     * Completely deletes a ride and all referencing rows (locations,
     * participants, notifications, and the ride row itself).
     */
    @Transactional
    public void deleteRideCompletely(Long rideId) {
        locationUpdateRepository.deleteByRideId(rideId);
        userLocationRepository.deleteByRideId(rideId);
        rideParticipantRepository.deleteByRideId(rideId);
        notificationRepository.deleteByRideId(rideId);
        rideRepository.deleteById(rideId);
    }

    /**
     * Deletes finished (completed/cancelled) rides for a specific user that
     * are older than the given number of days, plus removes the user's
     * participation in other users' finished group rides older than the cutoff.
     */
    @Transactional
    public int cleanupUserAutoDeleteRides(Long userId, int days) {
        if (userId == null || days <= 0) return 0;
        LocalDateTime cutoff = LocalDateTime.now().minusDays(days);
        List<Long> rideIds = rideRepository.findFinishedRideIdsForUserBefore(userId, ENDED, cutoff);
        for (Long rideId : rideIds) {
            deleteRideCompletely(rideId);
        }
        int removedParticipations = rideParticipantRepository.deleteFinishedParticipationsForUserBefore(userId, ENDED, cutoff);
        return rideIds.size() + removedParticipations;
    }

    /**
     * Clears ALL finished (completed/cancelled) rides for a user immediately.
     */
    @Transactional
    public int clearAllFinishedRidesForUser(Long userId) {
        if (userId == null) return 0;
        List<Long> rideIds = rideRepository.findFinishedRideIdsForUser(userId, ENDED);
        for (Long rideId : rideIds) {
            deleteRideCompletely(rideId);
        }
        int removedParticipations = rideParticipantRepository.deleteFinishedParticipationsForUser(userId, ENDED);
        return rideIds.size() + removedParticipations;
    }

    /**
     * Platform admin bulk cleanup of finished rides (all, or older than N days).
     */
    @Transactional
    public int adminCleanupFinishedRides(Integer olderThanDays) {
        List<Long> rideIds = (olderThanDays != null && olderThanDays > 0)
                ? rideRepository.findFinishedRideIdsBefore(ENDED, LocalDateTime.now().minusDays(olderThanDays))
                : rideRepository.findFinishedRideIds(ENDED);
        for (Long rideId : rideIds) {
            deleteRideCompletely(rideId);
        }
        return rideIds.size();
    }

    /**
     * Iterates over all users who enabled auto-delete (autoDeleteRidesDays > 0)
     * and purges their expired finished rides.
     */
    @Transactional
    public int cleanupAllUsersAutoDeleteRides() {
        int totalDeleted = 0;
        for (User u : userRepository.findByAutoDeleteRidesDaysGreaterThan(0)) {
            Integer days = u.getAutoDeleteRidesDays();
            if (days != null && days > 0) {
                totalDeleted += cleanupUserAutoDeleteRides(u.getId(), days);
            }
        }
        return totalDeleted;
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. SCHEDULED
    // ═══════════════════════════════════════════════════════════════

    @Scheduled(initialDelay = 60_000, fixedRate = 6 * 60 * 60 * 1000)
    public void scheduledCleanup() {
        long startedAt = System.currentTimeMillis();
        LocalDateTime now = LocalDateTime.now();

        int autoDeletedRides = run("user auto-delete rides", this::cleanupAllUsersAutoDeleteRides);
        int readNotifications = run("old read notifications",
                () -> notificationRepository.deleteByIsReadTrueAndCreatedAtBefore(now.minusDays(30)));
        int oldNotifications = run("very old notifications",
                () -> notificationRepository.deleteByCreatedAtBefore(now.minusDays(90)));
        int routeData = run("old route data",
                () -> rideRepository.clearRouteDataEndedBefore(ENDED, now.minusDays(7)));
        int breadcrumbs = run("orphaned GPS breadcrumbs",
                () -> locationUpdateRepository.deleteForRidesEndedBefore(ENDED, now.minusHours(6)));
        int livePositions = run("stale live positions",
                () -> (int) userLocationRepository.deleteByUpdatedAtBefore(now.minusHours(6)));

        // Organization fleets
        int tripRoads = run("planned roads of old vehicle trips",
                () -> vehicleSessionRouteRepository.deleteForSessionsEndedBefore(now.minusDays(7)));
        int tripPaths = run("recorded paths of old vehicle trips",
                () -> vehicleSessionPointRepository.deleteForSessionsEndedBefore(now.minusDays(90)));
        int activity = run("old organization activity",
                () -> orgAuditLogRepository.deleteByCreatedAtBefore(now.minusDays(180)));
        int announcements = run("old announcements",
                () -> orgAnnouncementRepository.deleteByCreatedAtBefore(now.minusDays(90)));
        if (tripRoads + tripPaths + activity + announcements > 0) {
            log.info("Fleet cleanup removed {} planned roads, {} path points, {} activity entries, {} announcements",
                    tripRoads, tripPaths, activity, announcements);
        }

        int total = autoDeletedRides + readNotifications + oldNotifications + routeData + breadcrumbs + livePositions;
        if (total > 0) {
            log.info("Cleanup removed {} auto-deleted rides, {} read + {} old notifications, route data of {} rides, "
                            + "{} GPS breadcrumbs, {} stale live positions in {} ms",
                    autoDeletedRides, readNotifications, oldNotifications, routeData, breadcrumbs, livePositions,
                    System.currentTimeMillis() - startedAt);
        }
    }

    private interface Step {
        int execute();
    }

    // One failing step must not stop the others.
    private int run(String what, Step step) {
        try {
            return step.execute();
        } catch (Exception e) {
            log.warn("Cleanup of {} failed: {}", what, e.getMessage());
            return 0;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. USER CLEANUP: remove all data of a deleted user
    //    (used by AccountService.deleteAccount & AdminService.deleteUser)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Removes all data belonging to a specific user.
     * Does NOT delete rides they created (those may have other participants).
     * Call this before deleting the User entity itself.
     */
    @Transactional
    public void cleanupUserData(Long userId) {
        notificationRepository.deleteByUserId(userId);
        rideParticipantRepository.deleteByUserId(userId);
        connectionRepository.deleteByUserIdOrConnectedUserId(userId, userId);
        locationUpdateRepository.deleteByUserId(userId);
        userLocationRepository.deleteByUserId(userId);
        log.info("Removed all data of user #{}", userId);
    }
}
