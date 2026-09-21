package vehicle.ridewise.repository; // Package declaration

import org.springframework.data.jpa.repository.JpaRepository; // Import JpaRepository
import org.springframework.stereotype.Repository; // Import Repository annotation
import vehicle.ridewise.entity.Ride; // Import Ride entity
import java.util.List; // Import List

@Repository // Mark as repository
public interface RideRepository extends JpaRepository<Ride, Long> { // Define interface extending JpaRepository

    List<Ride> findByUserIdOrderByCreatedAtDesc(Long userId); // Find by user ID sorted by creation time

    List<Ride> findByUserIdAndStatus(Long userId, String status); // Find by user ID and status
    
    List<Ride> findByIdInOrderByCreatedAtDesc(List<Long> ids);
} // End of interface
