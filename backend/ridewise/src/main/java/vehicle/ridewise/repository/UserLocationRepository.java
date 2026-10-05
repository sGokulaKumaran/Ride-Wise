package vehicle.ridewise.repository; // Package declaration

import org.springframework.data.jpa.repository.JpaRepository; // Import JpaRepository
import org.springframework.data.jpa.repository.Modifying; // Bulk update/delete marker
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.entity.UserLocation; // Import entity

import java.time.LocalDateTime;
import java.util.List; // Import List
import java.util.Optional; // Import Optional

// ============================================================
// UserLocationRepository — Spring Data JPA repository for the
// latest-only live location table (user_locations).
//
// One row per user, updated in place. Spring derives the SQL from
// the method names, no @Query needed.
// ============================================================
public interface UserLocationRepository extends JpaRepository<UserLocation, Long> {

    // ── The upsert lookup: find this user's single latest row ──
    Optional<UserLocation> findByUserId(Long userId);

    // ── All current positions for the members of one ride ──
    List<UserLocation> findByRideId(Long rideId);

    // ── Cleanup queries ──

    @Transactional
    @Modifying
    void deleteByRideId(Long rideId);

    @Transactional
    @Modifying
    void deleteByUserId(Long userId);

    // Drop positions that have not been refreshed for a long time
    // (rider closed the tab without ending the ride). Returns how many.
    @Transactional
    @Modifying
    long deleteByUpdatedAtBefore(LocalDateTime cutoff);
} // End of interface
