package vehicle.ridewise.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.entity.RideParticipant;

import java.util.List;
import java.util.Optional;

@Repository
public interface RideParticipantRepository extends JpaRepository<RideParticipant, Long> {

    List<RideParticipant> findByRideId(Long rideId);

    List<RideParticipant> findByUserId(Long userId);

    Optional<RideParticipant> findByRideIdAndUserId(Long rideId, Long userId);

    List<RideParticipant> findByUserIdAndStatus(Long userId, String status);

    @Query("SELECT rp.rideId FROM RideParticipant rp WHERE rp.userId = :userId AND rp.status = 'active'")
    List<Long> findActiveRideIdsByUserId(@Param("userId") Long userId);

    @Query("SELECT rp.rideId FROM RideParticipant rp WHERE rp.userId = :userId AND rp.status <> 'left'")
    List<Long> findVisibleRideIdsByUserId(@Param("userId") Long userId);

    @Modifying
    @Transactional
    void deleteByRideId(Long rideId);

    // ── Cleanup queries ──

    @Modifying
    @Transactional
    void deleteByUserId(Long userId);
}
