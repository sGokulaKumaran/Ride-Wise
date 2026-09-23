package vehicle.ridewise.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.entity.Notification;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<Notification> findByUserIdAndIsReadFalse(Long userId);

    long countByUserIdAndIsReadFalse(Long userId);

    // ── Cleanup queries ──

    // Delete old read notifications (returns count of deleted rows)
    @Modifying
    @Transactional
    @Query("DELETE FROM Notification n WHERE n.isRead = true AND n.createdAt < :cutoff")
    int deleteByIsReadTrueAndCreatedAtBefore(@Param("cutoff") LocalDateTime cutoff);

    // Delete very old unread notifications
    @Modifying
    @Transactional
    @Query("DELETE FROM Notification n WHERE n.createdAt < :cutoff")
    int deleteByCreatedAtBefore(@Param("cutoff") LocalDateTime cutoff);

    // Delete all notifications for a specific user
    @Modifying
    @Transactional
    void deleteByUserId(Long userId);
}
