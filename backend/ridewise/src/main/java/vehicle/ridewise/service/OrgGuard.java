package vehicle.ridewise.service;

import org.springframework.stereotype.Component;
import vehicle.ridewise.entity.OrgMember;
import vehicle.ridewise.entity.Organization;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.repository.OrgAccessRepository;
import vehicle.ridewise.repository.OrgMemberRepository;
import vehicle.ridewise.repository.OrganizationRepository;

// ============================================================
// OrgGuard — the single place that answers "may this person do that
// in this organization?"
//
// Every organization / vehicle / trip service calls into here, so the
// rules exist exactly once:
//
//   VIEW     see the organization's page, its vehicles and where they are
//              PUBLIC org   → anyone signed in
//              PRIVATE org  → a member, or someone who entered the code
//                             and password (an OrgAccess row)
//   DRIVE    start and end trips        → active member who is not a viewer
//   MANAGE   vehicles, routes, people   → active OWNER or ADMIN
//   OWN      delete, transfer, appoint admins → the active OWNER
//
// A suspended organization (by the platform admin) can still be opened by
// its own managers — they need to see why — but nobody can track it or
// start a trip in it. A deleted organization does not exist for anyone.
// ============================================================
@Component
public class OrgGuard {

    private final OrganizationRepository organizationRepository;
    private final OrgMemberRepository memberRepository;
    private final OrgAccessRepository accessRepository;

    public OrgGuard(OrganizationRepository organizationRepository,
                    OrgMemberRepository memberRepository,
                    OrgAccessRepository accessRepository) {
        this.organizationRepository = organizationRepository;
        this.memberRepository = memberRepository;
        this.accessRepository = accessRepository;
    }

    /** The organization, unless it never existed or was deleted. */
    public Organization requireOrg(Long orgId) {
        if (orgId == null) throw ApiException.badRequest("Organization is required");
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> ApiException.notFound("Organization not found"));
        if ("DELETED".equals(org.getStatus())) throw ApiException.notFound("Organization not found");
        return org;
    }

    /** This person's row in the organization (any status), or null. */
    public OrgMember memberOf(Long orgId, Long userId) {
        if (orgId == null || userId == null) return null;
        return memberRepository.findByOrgIdAndUserId(orgId, userId).orElse(null);
    }

    /** ACTIVE membership, or null. */
    public OrgMember activeMember(Long orgId, Long userId) {
        OrgMember member = memberOf(orgId, userId);
        return member != null && member.isActive() ? member : null;
    }

    public boolean isManager(Long orgId, Long userId) {
        OrgMember member = memberOf(orgId, userId);
        return member != null && member.isManager();
    }

    // ── MANAGE ──
    public OrgMember requireManager(Long orgId, Long userId) {
        OrgMember member = memberOf(orgId, userId);
        if (member == null || !member.isManager()) {
            throw ApiException.forbidden("Only the organization's admins can do that");
        }
        return member;
    }

    // ── OWN ──
    public OrgMember requireOwner(Long orgId, Long userId) {
        OrgMember member = memberOf(orgId, userId);
        if (member == null || !member.isOwner()) {
            throw ApiException.forbidden("Only the organization's owner can do that");
        }
        return member;
    }

    // ── DRIVE ──
    public OrgMember requireDriver(Organization org, Long userId) {
        OrgMember member = memberOf(org.getId(), userId);
        if (member == null || !member.canDrive()) {
            throw ApiException.forbidden("You are not a driver of this organization");
        }
        if (!org.isActive()) {
            throw ApiException.forbidden("This organization is suspended — trips cannot be started");
        }
        return member;
    }

    // ── VIEW ──
    public boolean canView(Organization org, Long userId) {
        if (org == null || userId == null || "DELETED".equals(org.getStatus())) return false;

        OrgMember member = memberOf(org.getId(), userId);
        boolean activeMember = member != null && member.isActive();

        if (!org.isActive()) return member != null && member.isManager(); // suspended
        if (org.isPublic()) return true;
        return activeMember || accessRepository.existsByUserIdAndOrgId(userId, org.getId());
    }

    public void requireView(Organization org, Long userId) {
        if (canView(org, userId)) return;
        if (!org.isActive()) {
            throw ApiException.forbidden("This organization is currently suspended");
        }
        throw ApiException.forbidden("This organization is private. Open it with its code and password first.");
    }
}
