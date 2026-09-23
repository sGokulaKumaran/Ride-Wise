package vehicle.ridewise.repository; // Package declaration

import org.springframework.data.jpa.repository.JpaRepository; // Import JpaRepository
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.entity.LocationUpdate; // Import entity
import java.time.LocalDateTime;
import java.util.List; // Import List

// ============================================================
// LocationUpdateRepository — Spring Data JPA repository
//
// Spring auto-generates all SQL based on method names (no @Query needed).
// ============================================================
public interface LocationUpdateRepository extends JpaRepository<LocationUpdate, Long> { // Extend JpaRepository

    // ── Find all location updates for a specific ride, newest first ──
    // Spring derives: SELECT * FROM location_updates WHERE ride_id = ? ORDER BY received_at DESC
    // Use: retrieve full GPS track for a completed ride to show in history
    List<LocationUpdate> findByRideIdOrderByReceivedAtDesc(Long rideId); // Find by ride ID

    // ── Count how many GPS fixes were recorded for a ride ──
    // Use: quick stat in ride history without loading all coordinates
    long countByRideId(Long rideId); // Count by ride ID

    @Transactional
    @Modifying
    void deleteByRideId(Long rideId);

    // ── Cleanup queries ──

    // Batch delete location updates for multiple rides
    @Transactional
    @Modifying
    void deleteByRideIdIn(List<Long> rideIds);

    // Delete all location updates for a specific user
    @Transactional
    @Modifying
    void deleteByUserId(Long userId);

    // Delete location updates older than a cutoff time
    @Transactional
    @Modifying
    void deleteByReceivedAtBefore(LocalDateTime cutoff);
} // End of interface
