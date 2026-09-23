package vehicle.ridewise.repository; // Package declaration

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository; // Import JpaRepository
import org.springframework.stereotype.Repository; // Import Repository annotation
import vehicle.ridewise.entity.Ride; // Import Ride entity
import java.time.LocalDateTime;
import java.util.List; // Import List

@Repository // Mark as repository
public interface RideRepository extends JpaRepository<Ride, Long> { // Define interface extending JpaRepository

    List<Ride> findByUserIdOrderByCreatedAtDesc(Long userId); // Find by user ID sorted by creation time

    List<Ride> findByUserIdAndStatus(Long userId, String status); // Find by user ID and status
    
    List<Ride> findByIdInOrderByCreatedAtDesc(List<Long> ids);

    // ── Admin queries ──

    long countByStatus(String status);

    long countByRideType(String rideType);

    Page<Ride> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Ride> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    Page<Ride> findByRideTypeOrderByCreatedAtDesc(String rideType, Pageable pageable);

    Page<Ride> findByStatusAndRideTypeOrderByCreatedAtDesc(String status, String rideType, Pageable pageable);

    // ── Cleanup queries ──

    // Find rides that ended before a cutoff time (for route blob cleanup)
    List<Ride> findByStatusInAndEndedAtBefore(List<String> statuses, LocalDateTime cutoff);
} // End of interface

