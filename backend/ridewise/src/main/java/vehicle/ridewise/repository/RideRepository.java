package vehicle.ridewise.repository; // Package declaration

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository; // Import JpaRepository
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository; // Import Repository annotation
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.dto.RideResponse;
import vehicle.ridewise.entity.Ride; // Import Ride entity
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List; // Import List

@Repository // Mark as repository
public interface RideRepository extends JpaRepository<Ride, Long> { // Define interface extending JpaRepository

    List<Ride> findByUserIdOrderByCreatedAtDesc(Long userId); // Find by user ID sorted by creation time

    // ── A rider's rides: the ones they created PLUS the group rides they
    // take part in — one query, newest first, no duplicates. ──
    // (:rideIds must not be empty — pass a list containing -1 for "none".)

    // Lightweight rows: every column except the two large route TEXT
    // columns (see RideResponse's summary constructor).
    @Query("SELECT new vehicle.ridewise.dto.RideResponse(" +
           "r.id, r.userId, r.fromName, r.fromLat, r.fromLng, " +
           "r.destinationName, r.destinationLat, r.destinationLng, " +
           "r.distanceMeters, r.durationSeconds, r.actualDistanceMeters, " +
           "r.rideType, r.status, r.createdAt, r.endedAt, " +
           "CASE WHEN r.routeCoordinates IS NOT NULL THEN true ELSE false END) " +
           "FROM Ride r WHERE r.userId = :userId OR r.id IN :rideIds " +
           "ORDER BY r.createdAt DESC")
    List<RideResponse> findSummariesForUser(@Param("userId") Long userId,
                                            @Param("rideIds") Collection<Long> rideIds);

    // Full entities (route included), for callers that need the geometry.
    @Query("SELECT r FROM Ride r WHERE r.userId = :userId OR r.id IN :rideIds ORDER BY r.createdAt DESC")
    List<Ride> findAllForUser(@Param("userId") Long userId, @Param("rideIds") Collection<Long> rideIds);

    // ── Admin queries ──

    long countByStatus(String status);

    long countByRideType(String rideType);

    Page<Ride> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Ride> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    Page<Ride> findByRideTypeOrderByCreatedAtDesc(String rideType, Pageable pageable);

    Page<Ride> findByStatusAndRideTypeOrderByCreatedAtDesc(String status, String rideType, Pageable pageable);

    // ── Cleanup queries ──

    // Rides still "active" long after they were created (never ended)
    List<Ride> findByStatusAndCreatedAtBefore(String status, LocalDateTime cutoff);

    // Drop the large route TEXT columns of rides that ended before a cutoff.
    // One UPDATE in the database — the old version loaded every old ride
    // (route blobs included) into memory on each run, forever.
    @Modifying
    @Transactional
    @Query("UPDATE Ride r SET r.routeCoordinates = null, r.routeSteps = null " +
           "WHERE r.status IN :statuses AND r.endedAt < :cutoff " +
           "AND (r.routeCoordinates IS NOT NULL OR r.routeSteps IS NOT NULL)")
    int clearRouteDataEndedBefore(@Param("statuses") Collection<String> statuses,
                                  @Param("cutoff") LocalDateTime cutoff);
} // End of interface
