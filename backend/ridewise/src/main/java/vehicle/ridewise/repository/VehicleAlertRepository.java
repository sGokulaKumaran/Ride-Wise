package vehicle.ridewise.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.entity.VehicleAlert;

import java.util.List;
import java.util.Optional;

public interface VehicleAlertRepository extends JpaRepository<VehicleAlert, Long> {

    Optional<VehicleAlert> findByUserIdAndVehicleId(Long userId, Long vehicleId);

    List<VehicleAlert> findByVehicleId(Long vehicleId);

    // "Told on this trip" — one UPDATE; returns 0 when the alert was removed meanwhile.
    @Modifying
    @Transactional
    @Query("UPDATE VehicleAlert a SET a.lastFiredSessionId = :sessionId WHERE a.id = :id")
    int markFired(@Param("id") Long id, @Param("sessionId") Long sessionId);

    @Modifying
    @Transactional
    long deleteByUserIdAndVehicleId(Long userId, Long vehicleId);

    @Modifying
    @Transactional
    long deleteByVehicleId(Long vehicleId);

    @Modifying
    @Transactional
    long deleteByUserIdAndOrgId(Long userId, Long orgId);

    @Modifying
    @Transactional
    long deleteByOrgId(Long orgId);

    // The organization became private (or its password was reset for
    // everyone): only its members may keep an alert there.
    @Modifying
    @Transactional
    @Query("DELETE FROM VehicleAlert a WHERE a.orgId = :orgId AND a.userId NOT IN " +
           "(SELECT m.userId FROM OrgMember m WHERE m.orgId = :orgId AND m.status = 'ACTIVE')")
    int deleteForNonMembers(@Param("orgId") Long orgId);
}
