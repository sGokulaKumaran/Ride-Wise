package vehicle.ridewise.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

// ============================================================
// VehicleSession — one trip: a driver takes a vehicle out, drives it,
// ends the trip. While it is ACTIVE the vehicle is "locked" to that
// driver and its position is live.
//
// THE LOCK (the core rule of the fleet system)
//   One vehicle  → at most one ACTIVE trip.
//   One driver   → at most one ACTIVE trip.
//
//   A "look first, then insert" check is not enough: two drivers tapping
//   "Start" at the same moment both look, both see the bus free, and both
//   insert. So the DATABASE enforces it:
//
//     activeVehicleKey = the vehicle id while ACTIVE, NULL afterwards
//     activeDriverKey  = the driver id  while ACTIVE, NULL afterwards
//
//   Both columns are UNIQUE. Any number of rows may hold NULL, but only
//   one row can hold a given vehicle (or driver) id — so the second
//   insert is refused by the database itself, whatever the timing.
//
// POSITION
//   lastLat / lastLng / lastLocationAt are refreshed every few seconds
//   (not on every GPS fix — fixes are broadcast live from memory), and
//   are what "last known location" is read from.
//
// vehicleCode and driverName are copied in at the start so the trip
// history stays readable after a vehicle is renamed or a driver leaves.
//
// The route's geometry is NOT in this row — it lives in
// VehicleSessionRoute. Trips are read constantly (live lists, history,
// statistics) and a route can be hundreds of kilobytes; keeping it apart
// keeps all of those reads small.
// ============================================================
@Entity
@Table(name = "vehicle_sessions", indexes = {
    @Index(name = "idx_vsession_org_status", columnList = "org_id, status"),
    @Index(name = "idx_vsession_org_started", columnList = "org_id, started_at"),
    @Index(name = "idx_vsession_vehicle", columnList = "vehicle_id, started_at"),
    @Index(name = "idx_vsession_driver", columnList = "driver_user_id, started_at"),
    @Index(name = "idx_vsession_status_seen", columnList = "status, last_location_at")
})
public class VehicleSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "vehicle_id")
    private Long vehicleId;

    @Column(name = "driver_user_id")
    private Long driverUserId;

    @Column(name = "org_id")
    private Long orgId;

    @Column(name = "route_id")
    private Long routeId; // the saved route it follows, if any

    @Column(name = "status", length = 10)
    private String status; // ACTIVE | COMPLETED | CANCELLED

    // Why it ended: DRIVER | ADMIN | TIMEOUT | REMOVED | VEHICLE | ORG
    @Column(name = "end_reason", length = 12)
    private String endReason;

    @Column(name = "vehicle_code", length = 30)
    private String vehicleCode;

    @Column(name = "driver_name", length = 60)
    private String driverName;

    @Column(name = "route_name", length = 120)
    private String routeName;

    @Column(name = "from_name")
    private String fromName;

    @Column(name = "from_lat")
    private Double fromLat;

    @Column(name = "from_lng")
    private Double fromLng;

    @Column(name = "destination_name")
    private String destinationName;

    @Column(name = "destination_lat")
    private Double destinationLat;

    @Column(name = "destination_lng")
    private Double destinationLng;

    @Column(name = "planned_distance_meters")
    private Double plannedDistanceMeters;

    @Column(name = "planned_duration_seconds")
    private Double plannedDurationSeconds;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Column(name = "last_lat")
    private Double lastLat;

    @Column(name = "last_lng")
    private Double lastLng;

    @Column(name = "last_speed")
    private Double lastSpeed; // metres per second

    @Column(name = "last_heading")
    private Double lastHeading; // degrees, 0 = north

    @Column(name = "last_accuracy")
    private Double lastAccuracy; // metres

    @Column(name = "last_location_at")
    private LocalDateTime lastLocationAt;

    // Measured on the server from the accepted GPS fixes.
    @Column(name = "distance_meters")
    private Double distanceMeters;

    @Column(name = "max_speed_kmh")
    private Double maxSpeedKmh;

    // How many separate times the organization's speed limit was exceeded.
    @Column(name = "overspeed_count")
    private Integer overspeedCount;

    // Start to end, in seconds — written when the trip ends, so statistics
    // can add it up inside the database.
    @Column(name = "duration_seconds")
    private Long durationSeconds;

    // Seats: UNKNOWN | LOW (plenty) | MEDIUM (filling up) | FULL — set by the driver.
    @Column(name = "crowd_level", length = 8)
    private String crowdLevel;

    @Column(name = "sos_active")
    private Boolean sosActive;

    @Column(name = "sos_at")
    private LocalDateTime sosAt;

    @Column(name = "sos_message", length = 200)
    private String sosMessage;

    // See "THE LOCK" above.
    @Column(name = "active_vehicle_key", unique = true)
    private Long activeVehicleKey;

    @Column(name = "active_driver_key", unique = true)
    private Long activeDriverKey;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (startedAt == null) startedAt = createdAt;
        if (status == null) status = "ACTIVE";
        if (distanceMeters == null) distanceMeters = 0.0;
        if (overspeedCount == null) overspeedCount = 0;
        if (sosActive == null) sosActive = false;
        if (crowdLevel == null) crowdLevel = "UNKNOWN";
    }

    public boolean isActive() { return "ACTIVE".equals(status); }

    public Long getId()                          { return id; }
    public Long getVehicleId()                   { return vehicleId; }
    public Long getDriverUserId()                { return driverUserId; }
    public Long getOrgId()                       { return orgId; }
    public Long getRouteId()                     { return routeId; }
    public String getStatus()                    { return status; }
    public String getEndReason()                 { return endReason; }
    public String getVehicleCode()               { return vehicleCode; }
    public String getDriverName()                { return driverName; }
    public String getRouteName()                 { return routeName; }
    public String getFromName()                  { return fromName; }
    public Double getFromLat()                   { return fromLat; }
    public Double getFromLng()                   { return fromLng; }
    public String getDestinationName()           { return destinationName; }
    public Double getDestinationLat()            { return destinationLat; }
    public Double getDestinationLng()            { return destinationLng; }
    public Double getPlannedDistanceMeters()     { return plannedDistanceMeters; }
    public Double getPlannedDurationSeconds()    { return plannedDurationSeconds; }
    public LocalDateTime getStartedAt()          { return startedAt; }
    public LocalDateTime getEndedAt()            { return endedAt; }
    public Double getLastLat()                   { return lastLat; }
    public Double getLastLng()                   { return lastLng; }
    public Double getLastSpeed()                 { return lastSpeed; }
    public Double getLastHeading()               { return lastHeading; }
    public Double getLastAccuracy()              { return lastAccuracy; }
    public LocalDateTime getLastLocationAt()     { return lastLocationAt; }
    public Double getDistanceMeters()            { return distanceMeters; }
    public Double getMaxSpeedKmh()               { return maxSpeedKmh; }
    public Integer getOverspeedCount()           { return overspeedCount; }
    public Long getDurationSeconds()             { return durationSeconds; }
    public String getCrowdLevel()                { return crowdLevel; }
    public Boolean getSosActive()                { return sosActive; }
    public LocalDateTime getSosAt()              { return sosAt; }
    public String getSosMessage()                { return sosMessage; }
    public Long getActiveVehicleKey()            { return activeVehicleKey; }
    public Long getActiveDriverKey()             { return activeDriverKey; }
    public LocalDateTime getCreatedAt()          { return createdAt; }

    public void setId(Long id)                                         { this.id = id; }
    public void setVehicleId(Long vehicleId)                           { this.vehicleId = vehicleId; }
    public void setDriverUserId(Long driverUserId)                     { this.driverUserId = driverUserId; }
    public void setOrgId(Long orgId)                                   { this.orgId = orgId; }
    public void setRouteId(Long routeId)                               { this.routeId = routeId; }
    public void setStatus(String status)                               { this.status = status; }
    public void setEndReason(String endReason)                         { this.endReason = endReason; }
    public void setVehicleCode(String vehicleCode)                     { this.vehicleCode = vehicleCode; }
    public void setDriverName(String driverName)                       { this.driverName = driverName; }
    public void setRouteName(String routeName)                         { this.routeName = routeName; }
    public void setFromName(String fromName)                           { this.fromName = fromName; }
    public void setFromLat(Double fromLat)                             { this.fromLat = fromLat; }
    public void setFromLng(Double fromLng)                             { this.fromLng = fromLng; }
    public void setDestinationName(String destinationName)             { this.destinationName = destinationName; }
    public void setDestinationLat(Double destinationLat)               { this.destinationLat = destinationLat; }
    public void setDestinationLng(Double destinationLng)               { this.destinationLng = destinationLng; }
    public void setPlannedDistanceMeters(Double plannedDistanceMeters) { this.plannedDistanceMeters = plannedDistanceMeters; }
    public void setPlannedDurationSeconds(Double plannedDurationSeconds) { this.plannedDurationSeconds = plannedDurationSeconds; }
    public void setStartedAt(LocalDateTime startedAt)                  { this.startedAt = startedAt; }
    public void setEndedAt(LocalDateTime endedAt)                      { this.endedAt = endedAt; }
    public void setLastLat(Double lastLat)                             { this.lastLat = lastLat; }
    public void setLastLng(Double lastLng)                             { this.lastLng = lastLng; }
    public void setLastSpeed(Double lastSpeed)                         { this.lastSpeed = lastSpeed; }
    public void setLastHeading(Double lastHeading)                     { this.lastHeading = lastHeading; }
    public void setLastAccuracy(Double lastAccuracy)                   { this.lastAccuracy = lastAccuracy; }
    public void setLastLocationAt(LocalDateTime lastLocationAt)        { this.lastLocationAt = lastLocationAt; }
    public void setDistanceMeters(Double distanceMeters)               { this.distanceMeters = distanceMeters; }
    public void setMaxSpeedKmh(Double maxSpeedKmh)                     { this.maxSpeedKmh = maxSpeedKmh; }
    public void setOverspeedCount(Integer overspeedCount)              { this.overspeedCount = overspeedCount; }
    public void setDurationSeconds(Long durationSeconds)               { this.durationSeconds = durationSeconds; }
    public void setCrowdLevel(String crowdLevel)                       { this.crowdLevel = crowdLevel; }
    public void setSosActive(Boolean sosActive)                        { this.sosActive = sosActive; }
    public void setSosAt(LocalDateTime sosAt)                          { this.sosAt = sosAt; }
    public void setSosMessage(String sosMessage)                       { this.sosMessage = sosMessage; }
    public void setActiveVehicleKey(Long activeVehicleKey)             { this.activeVehicleKey = activeVehicleKey; }
    public void setActiveDriverKey(Long activeDriverKey)               { this.activeDriverKey = activeDriverKey; }
}
