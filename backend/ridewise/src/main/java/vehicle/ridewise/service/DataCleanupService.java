package vehicle.ridewise.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.repository.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DataCleanupService — automatic database maintenance for RideWise.
 *
 * 1. EVENT-DRIVEN (immediate)
 *    cleanupRideLocationData(rideId) — removes a ride's GPS breadcrumbs and
 *    live positions when the ride ends or is deleted.
 *
 * 2. SCHEDULED (every 6 hours, first run 60 s after startup)
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
 *    Every one of these is a SINGLE statement run inside the database.
 *    The previous version loaded every ended ride — route blobs included —
 *    into memory on each run and worked through them one by one, which
 *    grew slower with every ride ever taken.
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

    // ═══════════════════════════════════════════════════════════════
    // 2. SCHEDULED
    // ═══════════════════════════════════════════════════════════════

    @Scheduled(initialDelay = 60_000, fixedRate = 6 * 60 * 60 * 1000)
    public void scheduledCleanup() {
        long startedAt = System.currentTimeMillis();
        LocalDateTime now = LocalDateTime.now();

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

        int total = readNotifications + oldNotifications + routeData + breadcrumbs + livePositions;
        if (total > 0) {
            log.info("Cleanup removed {} read + {} old notifications, route data of {} rides, "
                            + "{} GPS breadcrumbs, {} stale live positions in {} ms",
                    readNotifications, oldNotifications, routeData, breadcrumbs, livePositions,
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
    //    (pre-wired for a future "delete account" feature)
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
