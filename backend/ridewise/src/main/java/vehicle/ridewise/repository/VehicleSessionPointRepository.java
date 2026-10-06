package vehicle.ridewise.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.entity.VehicleSessionPoint;

import java.time.LocalDateTime;
import java.util.List;

public interface VehicleSessionPointRepository extends JpaRepository<VehicleSessionPoint, Long> {

    List<VehicleSessionPoint> findBySessionIdOrderByRecordedAtAsc(Long sessionId);

    // Old replay tracks — one statement, run inside the database.
    @Modifying
    @Transactional
    @Query("DELETE FROM VehicleSessionPoint p WHERE p.sessionId IN " +
           "(SELECT s.id FROM VehicleSession s WHERE s.status <> 'ACTIVE' AND s.endedAt < :cutoff)")
    int deleteForSessionsEndedBefore(@Param("cutoff") LocalDateTime cutoff);
}
