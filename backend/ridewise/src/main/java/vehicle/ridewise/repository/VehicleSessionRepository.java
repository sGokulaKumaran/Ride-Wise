package vehicle.ridewise.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.entity.VehicleSession;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface VehicleSessionRepository extends JpaRepository<VehicleSession, Long> {

    // ── The lock: who is using a vehicle / what is a driver on ──
    Optional<VehicleSession> findFirstByVehicleIdAndStatus(Long vehicleId, String status);

    Optional<VehicleSession> findFirstByDriverUserIdAndStatus(Long driverUserId, String status);

    // ── Live ──
    List<VehicleSession> findByOrgIdAndStatus(Long orgId, String status);

    List<VehicleSession> findByOrgIdAndDriverUserIdAndStatus(Long orgId, Long driverUserId, String status);

    long countByOrgIdAndStatus(Long orgId, String status);

    long countByStatus(String status);

    // Running-trip counts for a set of organizations: [orgId, count]
    @Query("SELECT s.orgId, COUNT(s) FROM VehicleSession s WHERE s.orgId IN :orgIds AND s.status = 'ACTIVE' GROUP BY s.orgId")
    List<Object[]> countActiveByOrgIds(@Param("orgIds") Collection<Long> orgIds);

    // ── Trips nobody ended: no position for too long ──
    @Query("SELECT s.id FROM VehicleSession s WHERE s.status = 'ACTIVE' AND " +
           "((s.lastLocationAt IS NULL AND s.startedAt < :cutoff) OR s.lastLocationAt < :cutoff)")
    List<Long> findStaleActiveIds(@Param("cutoff") LocalDateTime cutoff);

    // ── Latest position, written every few seconds while a trip runs ──
    // One UPDATE, no entity load. Touches ACTIVE trips only, so it returns 0
    // when the trip has been ended meanwhile — the caller then stops.
    @Modifying
    @Transactional
    @Query("UPDATE VehicleSession s SET s.lastLat = :lat, s.lastLng = :lng, s.lastSpeed = :speed, " +
           "s.lastHeading = :heading, s.lastAccuracy = :accuracy, s.lastLocationAt = :at, " +
           "s.distanceMeters = :distance, s.maxSpeedKmh = :maxSpeed, s.overspeedCount = :overspeed " +
           "WHERE s.id = :id AND s.status = 'ACTIVE'")
    int updateLivePosition(@Param("id") Long id,
                           @Param("lat") Double lat, @Param("lng") Double lng,
                           @Param("speed") Double speed, @Param("heading") Double heading,
                           @Param("accuracy") Double accuracy, @Param("at") LocalDateTime at,
                           @Param("distance") Double distance, @Param("maxSpeed") Double maxSpeed,
                           @Param("overspeed") Integer overspeed);

    // ── Statistics — added up inside the database, never row by row in Java ──
    // (trips that never produced a position are CANCELLED and left out)

    // One row: [trips, distance (m), driving time (s), times over the speed limit]
    @Query("SELECT COUNT(s), COALESCE(SUM(s.distanceMeters), 0), COALESCE(SUM(s.durationSeconds), 0), " +
           "COALESCE(SUM(s.overspeedCount), 0) FROM VehicleSession s " +
           "WHERE s.orgId = :orgId AND s.status <> 'CANCELLED' AND s.startedAt >= :from AND s.startedAt < :to")
    List<Object[]> totalsBetween(@Param("orgId") Long orgId,
                                 @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    // Per driver: [userId, name, trips, distance, driving time, top speed, times over the limit]
    @Query("SELECT s.driverUserId, MAX(s.driverName), COUNT(s), COALESCE(SUM(s.distanceMeters), 0), " +
           "COALESCE(SUM(s.durationSeconds), 0), COALESCE(MAX(s.maxSpeedKmh), 0), COALESCE(SUM(s.overspeedCount), 0) " +
           "FROM VehicleSession s WHERE s.orgId = :orgId AND s.status <> 'CANCELLED' AND s.startedAt >= :from " +
           "GROUP BY s.driverUserId ORDER BY COUNT(s) DESC")
    List<Object[]> driverStats(@Param("orgId") Long orgId, @Param("from") LocalDateTime from, Pageable pageable);

    // Per vehicle: [vehicleId, code, trips, distance, driving time]
    @Query("SELECT s.vehicleId, MAX(s.vehicleCode), COUNT(s), COALESCE(SUM(s.distanceMeters), 0), " +
           "COALESCE(SUM(s.durationSeconds), 0) " +
           "FROM VehicleSession s WHERE s.orgId = :orgId AND s.status <> 'CANCELLED' AND s.startedAt >= :from " +
           "GROUP BY s.vehicleId ORDER BY COUNT(s) DESC")
    List<Object[]> vehicleStats(@Param("orgId") Long orgId, @Param("from") LocalDateTime from, Pageable pageable);

    long countByOrgIdAndStatusAndStartedAtGreaterThanEqual(Long orgId, String status, LocalDateTime from);

    long countByOrgIdAndStatusAndSosActiveTrue(Long orgId, String status);

    // ── History ──
    boolean existsByVehicleId(Long vehicleId);

    Optional<VehicleSession> findFirstByVehicleIdAndStatusOrderByStartedAtDesc(Long vehicleId, String status);

    List<VehicleSession> findByOrgIdAndStartedAtGreaterThanEqualOrderByStartedAtAsc(
            Long orgId, LocalDateTime from, Pageable pageable);

    List<VehicleSession> findByDriverUserIdOrderByStartedAtDesc(Long driverUserId, Pageable pageable);
}
