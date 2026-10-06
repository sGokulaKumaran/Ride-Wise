package vehicle.ridewise.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

// ============================================================
// Organization — a college, hospital, company or transport service
// that runs vehicles people can track.
//
//   orgCode      public identifier people type in ("RW-7K3M9Q"). Random,
//                from an alphabet without look-alike characters.
//   visibility   PUBLIC   anyone signed in can find it by name and track
//                PRIVATE  opened with orgCode + access password only
//   status       ACTIVE | SUSPENDED (by the platform admin) | DELETED
//   verified     set by the platform admin — tells riders this really is
//                the organization it claims to be
//
// WHO MAY DO WHAT is not stored here: it comes from OrgMember (owner,
// admin, driver, viewer). ownerUserId is kept only as a shortcut.
// ============================================================
@Entity
@Table(name = "organizations", indexes = {
    @Index(name = "idx_org_owner", columnList = "owner_user_id"),
    @Index(name = "idx_org_visibility_status", columnList = "visibility, status")
})
public class Organization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "org_code", unique = true, length = 16)
    private String orgCode;

    @Column(name = "name", length = 120)
    private String name;

    @Column(name = "org_type", length = 20)
    private String orgType; // COLLEGE | SCHOOL | HOSPITAL | COMPANY | TRANSPORT | OTHER

    @Column(name = "visibility", length = 10)
    private String visibility; // PUBLIC | PRIVATE

    @Column(name = "access_password_hash", length = 100)
    private String accessPasswordHash; // BCrypt; null for PUBLIC

    @Column(name = "description", length = 600)
    private String description;

    @Column(name = "address")
    private String address;

    private Double lat;
    private Double lng;

    // A number riders may call (help desk / transport office).
    @Column(name = "contact_phone", length = 30)
    private String contactPhone;

    // May people tracking a vehicle see its driver's own phone number?
    // Off unless the organization switches it on.
    @Column(name = "show_driver_phone")
    private Boolean showDriverPhone;

    // Speed above which a trip is flagged (km/h). Null = no monitoring.
    @Column(name = "speed_limit_kmh")
    private Integer speedLimitKmh;

    @Column(name = "owner_user_id")
    private Long ownerUserId;

    @Column(name = "verified")
    private Boolean verified;

    @Column(name = "status", length = 12)
    private String status;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
        if (status == null) status = "ACTIVE";
        if (verified == null) verified = false;
        if (showDriverPhone == null) showDriverPhone = false;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public boolean isPublic() { return "PUBLIC".equals(visibility); }
    public boolean isActive() { return "ACTIVE".equals(status); }

    // ---- Getters ----
    public Long getId()                     { return id; }
    public String getOrgCode()              { return orgCode; }
    public String getName()                 { return name; }
    public String getOrgType()              { return orgType; }
    public String getVisibility()           { return visibility; }
    public String getAccessPasswordHash()   { return accessPasswordHash; }
    public String getDescription()          { return description; }
    public String getAddress()              { return address; }
    public Double getLat()                  { return lat; }
    public Double getLng()                  { return lng; }
    public String getContactPhone()         { return contactPhone; }
    public Boolean getShowDriverPhone()     { return showDriverPhone; }
    public Integer getSpeedLimitKmh()       { return speedLimitKmh; }
    public Long getOwnerUserId()            { return ownerUserId; }
    public Boolean getVerified()            { return verified; }
    public String getStatus()               { return status; }
    public LocalDateTime getCreatedAt()     { return createdAt; }
    public LocalDateTime getUpdatedAt()     { return updatedAt; }

    // ---- Setters ----
    public void setId(Long id)                                   { this.id = id; }
    public void setOrgCode(String orgCode)                       { this.orgCode = orgCode; }
    public void setName(String name)                             { this.name = name; }
    public void setOrgType(String orgType)                       { this.orgType = orgType; }
    public void setVisibility(String visibility)                 { this.visibility = visibility; }
    public void setAccessPasswordHash(String accessPasswordHash) { this.accessPasswordHash = accessPasswordHash; }
    public void setDescription(String description)               { this.description = description; }
    public void setAddress(String address)                       { this.address = address; }
    public void setLat(Double lat)                               { this.lat = lat; }
    public void setLng(Double lng)                               { this.lng = lng; }
    public void setContactPhone(String contactPhone)             { this.contactPhone = contactPhone; }
    public void setShowDriverPhone(Boolean showDriverPhone)      { this.showDriverPhone = showDriverPhone; }
    public void setSpeedLimitKmh(Integer speedLimitKmh)          { this.speedLimitKmh = speedLimitKmh; }
    public void setOwnerUserId(Long ownerUserId)                 { this.ownerUserId = ownerUserId; }
    public void setVerified(Boolean verified)                    { this.verified = verified; }
    public void setStatus(String status)                         { this.status = status; }
}
