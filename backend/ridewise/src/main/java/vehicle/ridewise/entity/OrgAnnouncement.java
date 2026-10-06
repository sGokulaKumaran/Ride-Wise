package vehicle.ridewise.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

// ============================================================
// OrgAnnouncement — a notice an organization posts for the people who
// follow it ("Bus 03 is cancelled today").
//
// Shown on the organization's page, and sent as a notification to its
// members and to everyone who has the organization on their list.
//
//   level      INFO | WARNING | URGENT
//   vehicleId  optional — the vehicle the notice is about
//   expiresAt  optional — hidden after this moment
// ============================================================
@Entity
@Table(name = "org_announcements",
    indexes = @Index(name = "idx_org_announcement_org", columnList = "org_id, created_at"))
public class OrgAnnouncement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "org_id")
    private Long orgId;

    @Column(name = "author_user_id")
    private Long authorUserId;

    @Column(name = "author_name", length = 60)
    private String authorName;

    @Column(name = "title", length = 120)
    private String title;

    @Column(name = "message", length = 1000)
    private String message;

    @Column(name = "level", length = 8)
    private String level;

    @Column(name = "vehicle_id")
    private Long vehicleId;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (level == null) level = "INFO";
    }

    public Long getId()                    { return id; }
    public Long getOrgId()                 { return orgId; }
    public Long getAuthorUserId()          { return authorUserId; }
    public String getAuthorName()          { return authorName; }
    public String getTitle()               { return title; }
    public String getMessage()             { return message; }
    public String getLevel()               { return level; }
    public Long getVehicleId()             { return vehicleId; }
    public LocalDateTime getCreatedAt()    { return createdAt; }
    public LocalDateTime getExpiresAt()    { return expiresAt; }

    public void setId(Long id)                           { this.id = id; }
    public void setOrgId(Long orgId)                     { this.orgId = orgId; }
    public void setAuthorUserId(Long authorUserId)       { this.authorUserId = authorUserId; }
    public void setAuthorName(String authorName)         { this.authorName = authorName; }
    public void setTitle(String title)                   { this.title = title; }
    public void setMessage(String message)               { this.message = message; }
    public void setLevel(String level)                   { this.level = level; }
    public void setVehicleId(Long vehicleId)             { this.vehicleId = vehicleId; }
    public void setExpiresAt(LocalDateTime expiresAt)    { this.expiresAt = expiresAt; }
}
