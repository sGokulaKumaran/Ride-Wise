package vehicle.ridewise.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

// ============================================================
// Vehicle — one bus / van / ambulance / car of an organization
//
//   status  ACTIVE      can be taken out by a driver
//           IN_SERVICE  planned maintenance — not selectable
//           REPAIR      broken down — not selectable
//           RETIRED     no longer part of the fleet (kept so that its
//                       past trips still have a vehicle to point at)
//
// lastLat / lastLng / lastLocationAt hold where the vehicle was when its
// most recent trip ended ("last seen 2 hours ago"). While a trip is
// running the live position comes from the trip itself, so this row is
// not rewritten on every GPS fix.
// ============================================================
@Entity
@Table(name = "vehicles",
    uniqueConstraints = @UniqueConstraint(name = "uk_vehicle_org_code", columnNames = {"org_id", "vehicle_code"}),
    indexes = @Index(name = "idx_vehicle_org_status", columnList = "org_id, status"))
public class Vehicle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "org_id")
    private Long orgId;

    @Column(name = "vehicle_code", length = 30)
    private String vehicleCode; // "BUS-01" — unique inside the organization

    @Column(name = "vehicle_type", length = 12)
    private String vehicleType; // BUS | VAN | AMBULANCE | CAR | OTHER

    @Column(name = "registration_number", length = 30)
    private String registrationNumber;

    @Column(name = "capacity")
    private Integer capacity;

    @Column(name = "description", length = 300)
    private String description;

    @Column(name = "status", length = 12)
    private String status;

    @Column(name = "last_lat")
    private Double lastLat;

    @Column(name = "last_lng")
    private Double lastLng;

    @Column(name = "last_location_at")
    private LocalDateTime lastLocationAt;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
        if (status == null) status = "ACTIVE";
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId()                        { return id; }
    public Long getOrgId()                     { return orgId; }
    public String getVehicleCode()             { return vehicleCode; }
    public String getVehicleType()             { return vehicleType; }
    public String getRegistrationNumber()      { return registrationNumber; }
    public Integer getCapacity()               { return capacity; }
    public String getDescription()             { return description; }
    public String getStatus()                  { return status; }
    public Double getLastLat()                 { return lastLat; }
    public Double getLastLng()                 { return lastLng; }
    public LocalDateTime getLastLocationAt()   { return lastLocationAt; }
    public LocalDateTime getCreatedAt()        { return createdAt; }
    public LocalDateTime getUpdatedAt()        { return updatedAt; }

    public void setId(Long id)                                   { this.id = id; }
    public void setOrgId(Long orgId)                             { this.orgId = orgId; }
    public void setVehicleCode(String vehicleCode)               { this.vehicleCode = vehicleCode; }
    public void setVehicleType(String vehicleType)               { this.vehicleType = vehicleType; }
    public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }
    public void setCapacity(Integer capacity)                    { this.capacity = capacity; }
    public void setDescription(String description)               { this.description = description; }
    public void setStatus(String status)                         { this.status = status; }
    public void setLastLat(Double lastLat)                       { this.lastLat = lastLat; }
    public void setLastLng(Double lastLng)                       { this.lastLng = lastLng; }
    public void setLastLocationAt(LocalDateTime lastLocationAt)  { this.lastLocationAt = lastLocationAt; }
}
