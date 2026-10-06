package vehicle.ridewise.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

// ============================================================
// OrgAuditLog — who did what in an organization, and when
//
// Every change that matters is written here in plain words: a vehicle
// added or taken out of service, a driver invited or removed, a trip
// ended by an admin, the access password reset, an SOS raised.
//
// It gives several admins of one organization a shared record ("who
// retired Bus 04?") and is what the dashboard's "Recent activity" shows.
// actorName is copied in, so the entry stays readable after the person
// has left.
// ============================================================
@Entity
@Table(name = "org_audit_logs",
    indexes = @Index(name = "idx_org_audit_org", columnList = "org_id, created_at"))
public class OrgAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "org_id")
    private Long orgId;

    @Column(name = "actor_user_id")
    private Long actorUserId; // null = done by the system (e.g. a trip timed out)

    @Column(name = "actor_name", length = 60)
    private String actorName;

    @Column(name = "action", length = 40)
    private String action; // short code, e.g. "vehicle.status"

    @Column(name = "summary", length = 300)
    private String summary; // the sentence shown to people

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId()                    { return id; }
    public Long getOrgId()                 { return orgId; }
    public Long getActorUserId()           { return actorUserId; }
    public String getActorName()           { return actorName; }
    public String getAction()              { return action; }
    public String getSummary()             { return summary; }
    public LocalDateTime getCreatedAt()    { return createdAt; }

    public void setId(Long id)                     { this.id = id; }
    public void setOrgId(Long orgId)               { this.orgId = orgId; }
    public void setActorUserId(Long actorUserId)   { this.actorUserId = actorUserId; }
    public void setActorName(String actorName)     { this.actorName = actorName; }
    public void setAction(String action)           { this.action = action; }
    public void setSummary(String summary)         { this.summary = summary; }
}
