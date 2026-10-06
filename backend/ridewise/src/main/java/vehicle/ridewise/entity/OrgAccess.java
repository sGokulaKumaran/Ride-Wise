package vehicle.ridewise.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

// ============================================================
// OrgAccess — "this organization is on my list"
//
//   PRIVATE organization  the person entered its code + password once;
//                         this row is what lets them keep tracking
//                         without typing it again. Deleting the row
//                         (by the person, or by an org admin) ends it.
//   PUBLIC organization   the person saved it for quick access and to
//                         receive its announcements. Nothing is unlocked
//                         by it — public organizations need no key.
//
// One row per (person, organization).
// ============================================================
@Entity
@Table(name = "org_access",
    uniqueConstraints = @UniqueConstraint(name = "uk_org_access", columnNames = {"user_id", "org_id"}),
    indexes = @Index(name = "idx_org_access_org", columnList = "org_id"))
public class OrgAccess {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "org_id")
    private Long orgId;

    @Column(name = "granted_at", updatable = false)
    private LocalDateTime grantedAt;

    @Column(name = "last_accessed_at")
    private LocalDateTime lastAccessedAt;

    @PrePersist
    protected void onCreate() {
        grantedAt = LocalDateTime.now();
        if (lastAccessedAt == null) lastAccessedAt = grantedAt;
    }

    public Long getId()                        { return id; }
    public Long getUserId()                    { return userId; }
    public Long getOrgId()                     { return orgId; }
    public LocalDateTime getGrantedAt()        { return grantedAt; }
    public LocalDateTime getLastAccessedAt()   { return lastAccessedAt; }

    public void setId(Long id)                                  { this.id = id; }
    public void setUserId(Long userId)                          { this.userId = userId; }
    public void setOrgId(Long orgId)                            { this.orgId = orgId; }
    public void setLastAccessedAt(LocalDateTime lastAccessedAt) { this.lastAccessedAt = lastAccessedAt; }
}
