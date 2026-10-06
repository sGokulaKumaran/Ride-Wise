package vehicle.ridewise.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vehicle.ridewise.entity.Vehicle;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface VehicleRepository extends JpaRepository<Vehicle, Long> {

    List<Vehicle> findByOrgIdOrderByVehicleCodeAsc(Long orgId);

    Optional<Vehicle> findByIdAndOrgId(Long id, Long orgId);

    Optional<Vehicle> findByOrgIdAndVehicleCodeIgnoreCase(Long orgId, String vehicleCode);

    long countByOrgId(Long orgId);

    long countByOrgIdAndStatus(Long orgId, String status);

    // Fleet sizes (retired vehicles left out) for a set of organizations: [orgId, count]
    @Query("SELECT v.orgId, COUNT(v) FROM Vehicle v WHERE v.orgId IN :orgIds AND v.status <> 'RETIRED' GROUP BY v.orgId")
    List<Object[]> countFleetByOrgIds(@Param("orgIds") Collection<Long> orgIds);
}
