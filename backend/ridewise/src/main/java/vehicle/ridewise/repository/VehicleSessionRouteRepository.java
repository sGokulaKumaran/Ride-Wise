package vehicle.ridewise.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.entity.VehicleSessionRoute;

import java.time.LocalDateTime;

public interface VehicleSessionRouteRepository extends JpaRepository<VehicleSessionRoute, Long> {

    // The planned road of a trip is only needed while it runs and for a
    // while afterwards; the recorded track (vehicle_session_points) is what
    // a replay uses. One statement, run inside the database.
    @Modifying
    @Transactional
    @Query("DELETE FROM VehicleSessionRoute r WHERE r.sessionId IN " +
           "(SELECT s.id FROM VehicleSession s WHERE s.status <> 'ACTIVE' AND s.endedAt < :cutoff)")
    int deleteForSessionsEndedBefore(@Param("cutoff") LocalDateTime cutoff);
}
