package vehicle.ridewise.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.entity.Ride;
import vehicle.ridewise.repository.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DataCleanupService — Automatic database maintenance for RideWise.
 *
 * Three types of cleanup:
 *
 * 1. EVENT-DRIVEN (immediate):
 *    cleanupRideLocationData(rideId) — deletes GPS breadcrumbs when a ride ends.
 *    Called by RideService.updateStatus() after a ride is completed/cancelled.
 *    This is the biggest storage saver (hundreds of rows per ride).
 *
 * 2. SCHEDULED (every 6 hours):
 *    - Deletes read notifications older than 30 days
 *    - Deletes unread notifications older than 90 days
 *    - Clears route_coordinates and route_steps TEXT blobs from rides
 *      that ended more than 7 days ago (from/destination names + distance kept)
 *    - Deletes orphaned location updates for non-active rides
 *
 * 3. USER CLEANUP (for future admin user deletion):
 *    cleanupUserData(userId) — removes all data belonging to a user.
 */
@Service
public class DataCleanupService {

    private final LocationUpdateRepository locationUpdateRepository;
    private final NotificationRepository notificationRepository;
    private final RideParticipantRepository rideParticipantRepository;
    private final ConnectionRepository connectionRepository;
    private final RideRepository rideRepository;

    public DataCleanupService(LocationUpdateRepository locationUpdateRepository,
                              NotificationRepository notificationRepository,
                              RideParticipantRepository rideParticipantRepository,
                              ConnectionRepository connectionRepository,
                              RideRepository rideRepository) {
        this.locationUpdateRepository = locationUpdateRepository;
        this.notificationRepository = notificationRepository;
        this.rideParticipantRepository = rideParticipantRepository;
        this.connectionRepository = connectionRepository;
        this.rideRepository = rideRepository;
    }

    // ═══════════════════════════════════════════════════════════════
    // 1. EVENT-DRIVEN: Clean up GPS breadcrumbs when a ride ends
    // ═══════════════════════════════════════════════════════════════

    /**
     * Deletes all location_updates rows for the given ride.
     * Called immediately after a ride is completed or cancelled.
     * The actual travelled distance is already saved on the ride row,
     * so these GPS breadcrumbs are no longer needed.
     */
    @Transactional
    public void cleanupRideLocationData(Long rideId) {
        try {
            long count = locationUpdateRepository.countByRideId(rideId);
            if (count > 0) {
                locationUpdateRepository.deleteByRideId(rideId);
                System.out.println("[RideWise Cleanup] Deleted " + count + " GPS breadcrumbs for ride #" + rideId);
            }
        } catch (Exception e) {
            // Don't let cleanup failure break the ride flow
            System.err.println("[RideWise Cleanup] Failed to clean location data for ride #" + rideId + ": " + e.getMessage());
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. SCHEDULED: Automatic periodic cleanup (every 6 hours)
    //    Also runs once 60 seconds after startup.
    // ═══════════════════════════════════════════════════════════════

    @Scheduled(initialDelay = 60_000, fixedRate = 6 * 60 * 60 * 1000)
    public void scheduledCleanup() {
        System.out.println("[RideWise Cleanup] ═══ Starting scheduled cleanup ═══");
        long startTime = System.currentTimeMillis();

        int totalCleaned = 0;
        totalCleaned += cleanupOldReadNotifications();
        totalCleaned += cleanupVeryOldNotifications();
        totalCleaned += cleanupOldRouteBlobs();
        totalCleaned += cleanupOrphanedLocationUpdates();

        long elapsed = System.currentTimeMillis() - startTime;
        System.out.println("[RideWise Cleanup] ═══ Completed in " + elapsed + "ms — " + totalCleaned + " total items cleaned ═══");
    }

    /**
     * Delete read notifications older than 30 days.
     * These have been seen by the user and have no further purpose.
     */
    @Transactional
    public int cleanupOldReadNotifications() {
        try {
            LocalDateTime cutoff = LocalDateTime.now().minusDays(30);
            int deleted = notificationRepository.deleteByIsReadTrueAndCreatedAtBefore(cutoff);
            if (deleted > 0) {
                System.out.println("[RideWise Cleanup]   ↳ Deleted " + deleted + " read notifications (> 30 days old)");
            }
            return deleted;
        } catch (Exception e) {
            System.err.println("[RideWise Cleanup] Failed to clean old read notifications: " + e.getMessage());
            return 0;
        }
    }

    /**
     * Delete ALL notifications (read or unread) older than 90 days.
     * Even unread notifications lose relevance after 3 months.
     */
    @Transactional
    public int cleanupVeryOldNotifications() {
        try {
            LocalDateTime cutoff = LocalDateTime.now().minusDays(90);
            int deleted = notificationRepository.deleteByCreatedAtBefore(cutoff);
            if (deleted > 0) {
                System.out.println("[RideWise Cleanup]   ↳ Deleted " + deleted + " old notifications (> 90 days old)");
            }
            return deleted;
        } catch (Exception e) {
            System.err.println("[RideWise Cleanup] Failed to clean very old notifications: " + e.getMessage());
            return 0;
        }
    }

    /**
     * Clear route_coordinates and route_steps TEXT blobs from rides
     * that ended more than 7 days ago.
     *
     * These are large JSON strings (often 10-50KB each) that are only
     * useful during the ride and shortly after. Thefrom/destination
     * names, distance, and duration are still preserved.
     */
    @Transactional
    public int cleanupOldRouteBlobs() {
        try {
            LocalDateTime cutoff = LocalDateTime.now().minusDays(7);
            List<Ride> oldRides = rideRepository.findByStatusInAndEndedAtBefore(
                    List.of("completed", "cancelled"), cutoff);

            int cleaned = 0;
            for (Ride ride : oldRides) {
                if (ride.getRouteCoordinates() != null || ride.getRouteSteps() != null) {
                    ride.setRouteCoordinates(null);
                    ride.setRouteSteps(null);
                    rideRepository.save(ride);
                    cleaned++;
                }
            }

            if (cleaned > 0) {
                System.out.println("[RideWise Cleanup]   ↳ Cleared route blobs from " + cleaned + " old rides (> 7 days ended)");
            }
            return cleaned;
        } catch (Exception e) {
            System.err.println("[RideWise Cleanup] Failed to clean old route blobs: " + e.getMessage());
            return 0;
        }
    }

    /**
     * Delete orphaned location updates — GPS breadcrumbs where the
     * parent ride is already completed/cancelled but the location
     * data wasn't cleaned up (e.g., from before this cleanup service existed).
     */
    @Transactional
    public int cleanupOrphanedLocationUpdates() {
        try {
            LocalDateTime cutoff = LocalDateTime.now().minusHours(6);
            List<Ride> endedRides = rideRepository.findByStatusInAndEndedAtBefore(
                    List.of("completed", "cancelled"), cutoff);

            int totalDeleted = 0;
            for (Ride ride : endedRides) {
                long count = locationUpdateRepository.countByRideId(ride.getId());
                if (count > 0) {
                    locationUpdateRepository.deleteByRideId(ride.getId());
                    totalDeleted += (int) count;
                }
            }

            if (totalDeleted > 0) {
                System.out.println("[RideWise Cleanup]   ↳ Deleted " + totalDeleted + " orphaned GPS breadcrumbs from " + endedRides.size() + " ended rides");
            }
            return totalDeleted;
        } catch (Exception e) {
            System.err.println("[RideWise Cleanup] Failed to clean orphaned location updates: " + e.getMessage());
            return 0;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. USER CLEANUP: Remove all data for a deleted user
    //    (pre-wired for future admin user deletion feature)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Removes all data belonging to a specific user.
     * Does NOT delete rides they created (those may have other participants).
     * Call this before deleting the User entity itself.
     */
    @Transactional
    public void cleanupUserData(Long userId) {
        try {
            notificationRepository.deleteByUserId(userId);
            rideParticipantRepository.deleteByUserId(userId);
            connectionRepository.deleteByUserIdOrConnectedUserId(userId, userId);
            locationUpdateRepository.deleteByUserId(userId);
            System.out.println("[RideWise Cleanup] Cleaned up all data for user #" + userId);
        } catch (Exception e) {
            System.err.println("[RideWise Cleanup] Failed to clean data for user #" + userId + ": " + e.getMessage());
            throw e; // Re-throw so the calling transaction rolls back
        }
    }
}
