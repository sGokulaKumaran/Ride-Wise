package vehicle.ridewise.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

// ============================================================
// OrgMember — one person's place in one organization
//
// This is the ONLY place organization permissions come from. The same
// person can own one organization, drive for a second and merely follow
// a third; their account role (User.role) stays USER throughout.
//
//   role    OWNER   exactly one per organization; everything, incl. delete
//           ADMIN   manages vehicles, routes, people, trips
//           DRIVER  starts and ends trips on the organization's vehicles
//           VIEWER  invited follower of a private organization
//   status  PENDING    invited, has not answered yet
//           ACTIVE     a member
//           SUSPENDED  kept on the list but may not act
//           REMOVED    taken off (the row stays so trip history keeps a name)
//
// One row per (organization, person) — re-inviting re-uses the row.
// ============================================================
@Entity
@Table(name = "org_members",
    uniqueConstraints = @UniqueConstraint(name = "uk_org_member", columnNames = {"org_id", "user_id"}),
    indexes = {
        @Index(name = "idx_org_member_user", columnList = "user_id, status"),
        @Index(name = "idx_org_member_org", columnList = "org_id, status")
    })
public class OrgMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "org_id")
    private Long orgId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "role", length = 10)
    private String role;

    @Column(name = "status", length = 10)
    private String status;

    @Column(name = "invited_by")
    private Long invitedBy;

    // When the (latest) invitation was sent — a person who left can be invited again.
    @Column(name = "invited_at")
    private LocalDateTime invitedAt;

    @Column(name = "joined_at")
    private LocalDateTime joinedAt;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public boolean isActive()  { return "ACTIVE".equals(status); }
    public boolean isManager() { return isActive() && ("OWNER".equals(role) || "ADMIN".equals(role)); }
    public boolean isOwner()   { return isActive() && "OWNER".equals(role); }
    /** Owners and admins may drive too — in a small organization they often do. */
    public boolean canDrive()  { return isActive() && !"VIEWER".equals(role); }

    public Long getId()                  { return id; }
    public Long getOrgId()               { return orgId; }
    public Long getUserId()              { return userId; }
    public String getRole()              { return role; }
    public String getStatus()            { return status; }
    public Long getInvitedBy()           { return invitedBy; }
    public LocalDateTime getInvitedAt()  { return invitedAt != null ? invitedAt : createdAt; }
    public LocalDateTime getJoinedAt()   { return joinedAt; }
    public LocalDateTime getCreatedAt()  { return createdAt; }
    public LocalDateTime getUpdatedAt()  { return updatedAt; }

    public void setId(Long id)                        { this.id = id; }
    public void setOrgId(Long orgId)                  { this.orgId = orgId; }
    public void setUserId(Long userId)                { this.userId = userId; }
    public void setRole(String role)                  { this.role = role; }
    public void setStatus(String status)              { this.status = status; }
    public void setInvitedBy(Long invitedBy)          { this.invitedBy = invitedBy; }
    public void setInvitedAt(LocalDateTime invitedAt) { this.invitedAt = invitedAt; }
    public void setJoinedAt(LocalDateTime joinedAt)   { this.joinedAt = joinedAt; }
}
