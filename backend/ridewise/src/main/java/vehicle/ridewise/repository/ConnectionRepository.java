package vehicle.ridewise.repository;

import vehicle.ridewise.entity.Connection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface ConnectionRepository extends JpaRepository<Connection, Long> {

    // Get all connection IDs for a user (just the IDs, not full user objects)
    @Query("SELECT c.connectedUserId FROM Connection c WHERE c.userId = :userId")
    List<Long> findConnectedUserIds(@Param("userId") Long userId);

    // Check if a connection already exists
    boolean existsByUserIdAndConnectedUserId(Long userId, Long connectedUserId);

    // Delete a connection
    void deleteByUserIdAndConnectedUserId(Long userId, Long connectedUserId);
}