package vehicle.ridewise.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

// ============================================================
// VehicleAlert — "tell me when this vehicle gets close to here"
//
// A person tracking a bus picks a place (their stop, or where they are
// standing) and a distance. When the vehicle comes within that distance
// during a trip they get a notification — once per trip, so the same
// alert works again tomorrow morning without being set up again.
//
//   lastFiredSessionId  the trip it already fired for
//
// One alert per (person, vehicle).
// ============================================================
@Entity
@Table(name = "vehicle_alerts",
    uniqueConstraints = @UniqueConstraint(name = "uk_vehicle_alert", columnNames = {"user_id", "vehicle_id"}),
    indexes = @Index(name = "idx_vehicle_alert_vehicle", columnList = "vehicle_id"))
public class VehicleAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "vehicle_id")
    private Long vehicleId;

    @Column(name = "org_id")
    private Long orgId;

    @Column(name = "label", length = 120)
    private String label; // "Anna Nagar stop", "My location"

    private Double lat;
    private Double lng;

    @Column(name = "radius_meters")
    private Integer radiusMeters;

    @Column(name = "last_fired_session_id")
    private Long lastFiredSessionId;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId()                    { return id; }
    public Long getUserId()                { return userId; }
    public Long getVehicleId()             { return vehicleId; }
    public Long getOrgId()                 { return orgId; }
    public String getLabel()               { return label; }
    public Double getLat()                 { return lat; }
    public Double getLng()                 { return lng; }
    public Integer getRadiusMeters()       { return radiusMeters; }
    public Long getLastFiredSessionId()    { return lastFiredSessionId; }
    public LocalDateTime getCreatedAt()    { return createdAt; }

    public void setId(Long id)                                 { this.id = id; }
    public void setUserId(Long userId)                         { this.userId = userId; }
    public void setVehicleId(Long vehicleId)                   { this.vehicleId = vehicleId; }
    public void setOrgId(Long orgId)                           { this.orgId = orgId; }
    public void setLabel(String label)                         { this.label = label; }
    public void setLat(Double lat)                             { this.lat = lat; }
    public void setLng(Double lng)                             { this.lng = lng; }
    public void setRadiusMeters(Integer radiusMeters)          { this.radiusMeters = radiusMeters; }
    public void setLastFiredSessionId(Long lastFiredSessionId) { this.lastFiredSessionId = lastFiredSessionId; }
}
