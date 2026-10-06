package vehicle.ridewise.service;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.dto.OrgDtos.InviteRequest;
import vehicle.ridewise.dto.OrgDtos.MemberDto;
import vehicle.ridewise.dto.OrgDtos.MemberPatch;
import vehicle.ridewise.dto.OrgDtos.TransferRequest;
import vehicle.ridewise.entity.OrgMember;
import vehicle.ridewise.entity.Organization;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.entity.VehicleSession;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.repository.OrgAccessRepository;
import vehicle.ridewise.repository.OrgMemberRepository;
import vehicle.ridewise.repository.OrganizationRepository;
import vehicle.ridewise.repository.UserRepository;
import vehicle.ridewise.repository.VehicleSessionRepository;
import vehicle.ridewise.websocket.FleetBroadcaster;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

// ============================================================
// OrgMemberService — the people of an organization
//
// ROLES (per organization — the same person can be an admin of one
// organization, a driver in another and an ordinary rider everywhere else)
//   OWNER    exactly one. Everything, including deleting the organization,
//            appointing admins and handing the ownership over.
//   ADMIN    vehicles, routes, drivers, trips, announcements.
//   DRIVER   starts and ends trips.
//   VIEWER   sees the organization (even a private one, without the
//            password) but cannot drive or change anything — a parent
//            liaison, a security desk, a dispatcher who only watches.
//   Owners and admins may also drive.
//
// JOINING IS BY INVITATION
//   An admin invites someone by username or email; nothing happens until
//   that person accepts. Nobody can be put into an organization — and so
//   have their phone number shown to its admins — without agreeing to it.
//
// WHO MAY CHANGE WHOM
//   • the owner is changed only by a transfer of ownership
//   • only the owner appoints, demotes, suspends or removes ADMINs
//   • admins manage DRIVERs and VIEWERs
//   • nobody changes their own role or suspends themselves
//
// A driver who is removed, suspended or turned into a viewer in the middle
// of a trip: the trip ends at once and the vehicle is free again.
// ============================================================
@Service
public class OrgMemberService {

    private static final Set<String> INVITABLE_ROLES = Set.of("ADMIN", "DRIVER", "VIEWER");
    private static final int MAX_PEOPLE = 1_000;   // members + open invitations per organization
    private static final int MAX_OWNED = 5;        // organizations one person may own

    private final OrgMemberRepository memberRepository;
    private final OrganizationRepository organizationRepository;
    private final OrgAccessRepository accessRepository;
    private final UserRepository userRepository;
    private final VehicleSessionRepository sessionRepository;
    private final OrgGuard guard;
    private final VehicleSessionService sessionService;
    private final VehicleAlertService alertService;
    private final NotificationService notificationService;
    private final OrgAuditService audit;
    private final FleetBroadcaster broadcaster;

    // Looking people up by email must not become a way to test which
    // addresses have an account: unsuccessful lookups are limited per admin.
    private final AttemptLimiter lookups = new AttemptLimiter(15, 15 * 60_000L, 10 * 60_000L);

    public OrgMemberService(OrgMemberRepository memberRepository,
                            OrganizationRepository organizationRepository,
                            OrgAccessRepository accessRepository,
                            UserRepository userRepository,
                            VehicleSessionRepository sessionRepository,
                            OrgGuard guard,
                            VehicleSessionService sessionService,
                            VehicleAlertService alertService,
                            NotificationService notificationService,
                            OrgAuditService audit,
                            FleetBroadcaster broadcaster) {
        this.memberRepository = memberRepository;
        this.organizationRepository = organizationRepository;
        this.accessRepository = accessRepository;
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
        this.guard = guard;
        this.sessionService = sessionService;
        this.alertService = alertService;
        this.notificationService = notificationService;
        this.audit = audit;
        this.broadcaster = broadcaster;
    }

    // ============================================================
    // LIST (admins)
    // ============================================================
    public List<MemberDto> list(Long orgId, Long userId) {
        guard.requireOrg(orgId);
        guard.requireManager(orgId, userId);

        List<OrgMember> members = memberRepository.findByOrgIdAndStatusInOrderByIdAsc(
                orgId, List.of("ACTIVE", "PENDING", "SUSPENDED"), PageRequest.of(0, MAX_PEOPLE + 50));

        Set<Long> userIds = members.stream()
                .flatMap(m -> java.util.stream.Stream.of(m.getUserId(), m.getInvitedBy()))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, User> users = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        Map<Long, String> onTrip = new HashMap<>(); // driver → vehicle code
        for (VehicleSession trip : sessionRepository.findByOrgIdAndStatus(orgId, "ACTIVE")) {
            onTrip.put(trip.getDriverUserId(), trip.getVehicleCode());
        }

        List<MemberDto> result = new ArrayList<>(members.size());
        for (OrgMember member : members) {
            result.add(toDto(member, users.get(member.getUserId()), users.get(member.getInvitedBy()),
                    onTrip.get(member.getUserId())));
        }
        result.sort(Comparator
                .comparingInt((MemberDto m) -> roleOrder(m.role()))
                .thenComparing(m -> m.username() == null ? "" : m.username().toLowerCase(Locale.ROOT)));
        return result;
    }

    // ============================================================
    // INVITE (admins)
    // ============================================================
    @Transactional
    public MemberDto invite(Long orgId, Long managerId, InviteRequest request) {
        Organization org = guard.requireOrg(orgId);
        OrgMember manager = guard.requireManager(orgId, managerId);
        if (!org.isActive()) throw ApiException.forbidden("This organization is suspended — nobody can be invited");

        String identifier = request == null || request.identifier() == null ? "" : request.identifier().trim();
        if (identifier.isEmpty()) throw ApiException.badRequest("Enter the person's username or email");
        if (identifier.length() > 255) throw ApiException.badRequest("That is not a username or email");

        String role = request.role() == null || request.role().isBlank()
                ? "DRIVER" : request.role().trim().toUpperCase(Locale.ROOT);
        if (!INVITABLE_ROLES.contains(role)) throw ApiException.badRequest("Choose a role: admin, driver or viewer");
        if ("ADMIN".equals(role) && !manager.isOwner()) {
            throw ApiException.forbidden("Only the organization's owner can invite admins");
        }

        String limiterKey = "u" + managerId;
        long locked = lookups.lockedMinutes(limiterKey);
        if (locked > 0) {
            throw ApiException.tooManyRequests("Too many names that could not be found. Try again in "
                    + locked + (locked == 1 ? " minute." : " minutes."));
        }

        User target = (identifier.contains("@")
                ? userRepository.findByEmailIgnoreCase(identifier)
                : userRepository.findByUsernameIgnoreCase(identifier)).orElse(null);
        // An account that is suspended or never finished signing up is
        // treated exactly like one that does not exist.
        if (target == null || target.getUsername() == null || Boolean.FALSE.equals(target.getEnabled())) {
            lookups.recordFailure(limiterKey);
            throw ApiException.notFound("No RideWise account was found for \"" + shorten(identifier, 60) + "\"");
        }
        if (target.getId().equals(managerId)) throw ApiException.badRequest("You are already part of this organization");

        OrgMember member = memberRepository.findByOrgIdAndUserId(orgId, target.getId()).orElse(null);
        if (member != null) {
            switch (member.getStatus()) {
                case "ACTIVE" -> throw ApiException.conflict(target.getUsername() + " is already in this organization");
                case "PENDING" -> throw ApiException.conflict(target.getUsername() + " already has an invitation waiting");
                case "SUSPENDED" -> throw ApiException.conflict(target.getUsername()
                        + " is suspended in this organization. Reactivate them instead.");
                default -> { /* REMOVED: the old row is reused below */ }
            }
        }

        long people = memberRepository.countByOrgIdAndStatus(orgId, "ACTIVE")
                + memberRepository.countByOrgIdAndStatus(orgId, "PENDING");
        if (people >= MAX_PEOPLE) {
            throw ApiException.conflict("This organization has reached the limit of " + MAX_PEOPLE + " people");
        }

        if (member == null) {
            member = new OrgMember();
            member.setOrgId(orgId);
            member.setUserId(target.getId());
        }
        member.setRole(role);
        member.setStatus("PENDING");
        member.setInvitedBy(managerId);
        member.setJoinedAt(null);
        member.setInvitedAt(LocalDateTime.now());
        OrgMember saved = memberRepository.save(member);

        User inviter = userRepository.findById(managerId).orElse(null);
        String inviterName = inviter != null && inviter.getUsername() != null ? inviter.getUsername() : "An admin";
        notificationService.notifyWithLink(target.getId(), "org_invite",
                "Invitation from " + org.getName(),
                inviterName + " invited you to join " + org.getName() + " as " + roleWords(role) + ".",
                "/organizations");
        audit.record(orgId, managerId, "member.invite", "invited " + target.getUsername() + " as " + roleWords(role));

        return toDto(saved, target, inviter, null);
    }

    // ============================================================
    // ANSWER AN INVITATION (the invited person)
    // ============================================================
    @Transactional
    public Long accept(Long memberId, Long userId) {
        OrgMember member = requireInvitation(memberId, userId);
        Organization org = guard.requireOrg(member.getOrgId());
        if (!org.isActive()) throw ApiException.conflict("This organization is suspended right now");

        member.setStatus("ACTIVE");
        member.setJoinedAt(LocalDateTime.now());
        memberRepository.save(member);

        String name = usernameOf(userId);
        if (member.getInvitedBy() != null) {
            notificationService.notifyWithLink(member.getInvitedBy(), "org_member",
                    name + " joined " + org.getName(),
                    name + " accepted the invitation and is now " + roleWords(member.getRole()) + ".",
                    "/org-admin/" + org.getId() + "/people");
        }
        audit.record(org.getId(), userId, "member.join", "joined as " + roleWords(member.getRole()));
        return org.getId();
    }

    @Transactional
    public void reject(Long memberId, Long userId) {
        OrgMember member = requireInvitation(memberId, userId);
        memberRepository.delete(member);

        Organization org = organizationRepository.findById(member.getOrgId()).orElse(null);
        if (org != null && member.getInvitedBy() != null && !"DELETED".equals(org.getStatus())) {
            String name = usernameOf(userId);
            notificationService.notifyWithLink(member.getInvitedBy(), "org_member",
                    name + " declined the invitation",
                    name + " declined to join " + org.getName() + ".",
                    "/org-admin/" + org.getId() + "/people");
            audit.record(org.getId(), userId, "member.decline", "declined the invitation");
        }
    }

    private OrgMember requireInvitation(Long memberId, Long userId) {
        OrgMember member = memberId == null ? null : memberRepository.findById(memberId).orElse(null);
        if (member == null || !member.getUserId().equals(userId) || !"PENDING".equals(member.getStatus())) {
            throw ApiException.notFound("That invitation is no longer open");
        }
        return member;
    }

    // ============================================================
    // CHANGE ROLE / SUSPEND / REACTIVATE (admins)
    // ============================================================
    @Transactional
    public MemberDto patch(Long orgId, Long memberId, Long managerId, MemberPatch patch) {
        Organization org = guard.requireOrg(orgId);
        OrgMember manager = guard.requireManager(orgId, managerId);
        OrgMember member = requireMember(orgId, memberId);
        if (patch == null) throw ApiException.badRequest("Nothing to change");

        requireMayChange(manager, member);
        User target = userRepository.findById(member.getUserId()).orElse(null);
        String targetName = target != null && target.getUsername() != null ? target.getUsername() : "this person";

        boolean stopsDriving = false;

        // ── role ──
        if (patch.role() != null) {
            String role = patch.role().trim().toUpperCase(Locale.ROOT);
            if (!INVITABLE_ROLES.contains(role)) throw ApiException.badRequest("Choose a role: admin, driver or viewer");
            if (!role.equals(member.getRole())) {
                if ("ADMIN".equals(role) && !manager.isOwner()) {
                    throw ApiException.forbidden("Only the organization's owner can appoint admins");
                }
                member.setRole(role);
                if ("VIEWER".equals(role)) stopsDriving = true;
                if ("ACTIVE".equals(member.getStatus())) {
                    notificationService.notifyWithLink(member.getUserId(), "org_member",
                            "Your role in " + org.getName() + " changed",
                            "You are now " + roleWords(role) + " in " + org.getName() + ".",
                            "/organizations");
                }
                audit.record(orgId, managerId, "member.role", "made " + targetName + " " + roleWords(role));
            }
        }

        // ── status ──
        if (patch.status() != null) {
            String status = patch.status().trim().toUpperCase(Locale.ROOT);
            if (!Set.of("ACTIVE", "SUSPENDED").contains(status)) throw ApiException.badRequest("Unknown status");
            if (!status.equals(member.getStatus())) {
                if ("PENDING".equals(member.getStatus())) {
                    throw ApiException.conflict(targetName + " has not accepted the invitation yet");
                }
                member.setStatus(status);
                if ("SUSPENDED".equals(status)) {
                    stopsDriving = true;
                    notificationService.notifyWithLink(member.getUserId(), "org_member",
                            "Suspended in " + org.getName(),
                            "An admin suspended you in " + org.getName() + ". You cannot start trips there for now.",
                            "/organizations");
                    audit.record(orgId, managerId, "member.suspend", "suspended " + targetName);
                } else {
                    notificationService.notifyWithLink(member.getUserId(), "org_member",
                            "Active again in " + org.getName(),
                            "An admin reactivated you in " + org.getName() + ".",
                            "/organizations");
                    audit.record(orgId, managerId, "member.reactivate", "reactivated " + targetName);
                }
            }
        }

        OrgMember saved = memberRepository.save(member);
        if (stopsDriving) sessionService.endForDriver(orgId, saved.getUserId(), "REMOVED", managerId);
        if ("SUSPENDED".equals(saved.getStatus())) loseView(org, saved.getUserId());

        VehicleSession trip = stopsDriving ? null
                : sessionRepository.findByOrgIdAndDriverUserIdAndStatus(orgId, saved.getUserId(), "ACTIVE")
                        .stream().findFirst().orElse(null);
        return toDto(saved, target, saved.getInvitedBy() == null ? null
                : userRepository.findById(saved.getInvitedBy()).orElse(null),
                trip == null ? null : trip.getVehicleCode());
    }

    // ============================================================
    // REMOVE (admins) — also withdraws an invitation not yet answered
    // ============================================================
    @Transactional
    public void remove(Long orgId, Long memberId, Long managerId) {
        Organization org = guard.requireOrg(orgId);
        OrgMember manager = guard.requireManager(orgId, managerId);
        OrgMember member = requireMember(orgId, memberId);
        requireMayChange(manager, member);

        String targetName = usernameOf(member.getUserId());
        if ("PENDING".equals(member.getStatus())) {
            memberRepository.delete(member);
            audit.record(orgId, managerId, "member.uninvite", "withdrew the invitation of " + targetName);
            return;
        }

        member.setStatus("REMOVED");
        memberRepository.save(member);
        sessionService.endForDriver(orgId, member.getUserId(), "REMOVED", managerId);
        loseView(org, member.getUserId());

        notificationService.notifyWithLink(member.getUserId(), "org_member",
                "Removed from " + org.getName(),
                "An admin removed you from " + org.getName() + ".",
                "/organizations");
        audit.record(orgId, managerId, "member.remove", "removed " + targetName);
    }

    // ============================================================
    // LEAVE (the member)
    // ============================================================
    @Transactional
    public void leave(Long orgId, Long userId) {
        Organization org = guard.requireOrg(orgId);
        OrgMember member = guard.memberOf(orgId, userId);
        if (member == null || !Set.of("ACTIVE", "SUSPENDED").contains(member.getStatus())) {
            throw ApiException.notFound("You are not part of this organization");
        }
        if ("OWNER".equals(member.getRole())) {
            throw ApiException.conflict("You own this organization. Hand the ownership to someone else first, or delete it.");
        }

        member.setStatus("REMOVED");
        memberRepository.save(member);
        sessionService.endForDriver(orgId, userId, "REMOVED", userId);
        loseView(org, userId);
        audit.record(orgId, userId, "member.leave", "left the organization");
    }

    // ============================================================
    // HAND THE OWNERSHIP OVER (owner)
    // ============================================================
    @Transactional
    public void transfer(Long orgId, Long ownerId, TransferRequest request) {
        Organization org = guard.requireOrg(orgId);
        OrgMember owner = guard.requireOwner(orgId, ownerId);
        OrgMember next = requireMember(orgId, request == null ? null : request.memberId());

        if (next.getId().equals(owner.getId())) throw ApiException.badRequest("You already own this organization");
        if (!next.isActive()) throw ApiException.conflict("Only an active member can become the owner");
        if (organizationRepository.countByOwnerUserIdAndStatusNot(next.getUserId(), "DELETED") >= MAX_OWNED) {
            throw ApiException.conflict("That person already owns the maximum number of organizations");
        }

        next.setRole("OWNER");
        owner.setRole("ADMIN");
        memberRepository.save(owner);
        memberRepository.save(next);
        org.setOwnerUserId(next.getUserId());
        organizationRepository.save(org);

        String nextName = usernameOf(next.getUserId());
        notificationService.notifyWithLink(next.getUserId(), "org_member",
                "You now own " + org.getName(),
                usernameOf(ownerId) + " handed the ownership of " + org.getName() + " to you.",
                "/org-admin/" + orgId);
        audit.record(orgId, ownerId, "org.transfer", "handed the ownership to " + nextName);
    }

    // ============================================================
    // HELPERS
    // ============================================================

    private OrgMember requireMember(Long orgId, Long memberId) {
        if (memberId == null) throw ApiException.badRequest("A member is required");
        OrgMember member = memberRepository.findByIdAndOrgId(memberId, orgId).orElse(null);
        if (member == null || "REMOVED".equals(member.getStatus())) {
            throw ApiException.notFound("That person is not part of this organization");
        }
        return member;
    }

    // See "WHO MAY CHANGE WHOM" above.
    private static void requireMayChange(OrgMember manager, OrgMember target) {
        if (target.getId().equals(manager.getId())) {
            throw ApiException.badRequest("You cannot change your own membership here");
        }
        if ("OWNER".equals(target.getRole())) {
            throw ApiException.forbidden("The owner can only be changed by handing the ownership over");
        }
        if ("ADMIN".equals(target.getRole()) && !manager.isOwner()) {
            throw ApiException.forbidden("Only the organization's owner can change an admin");
        }
    }

    // Someone stopped being a member. In a PRIVATE organization they also
    // stop seeing it: their saved access, their "bus is near" alerts and
    // any live map they have open go with the membership. (A public
    // organization stays visible to them like to anyone else.)
    private void loseView(Organization org, Long userId) {
        if (org.isPublic()) return;
        Long orgId = org.getId();
        accessRepository.deleteByUserIdAndOrgId(userId, orgId);
        alertService.removeForUserInOrg(userId, orgId);
        Tx.afterCommit(() -> broadcaster.dropUser(orgId, userId));
    }

    private String usernameOf(Long userId) {
        return userRepository.findById(userId)
                .map(u -> u.getUsername() != null ? u.getUsername() : "A member")
                .orElse("A member");
    }

    private static MemberDto toDto(OrgMember m, User user, User inviter, String tripVehicleCode) {
        // Contact details belong to people who agreed to be here: an open
        // invitation shows the name only.
        boolean joined = !"PENDING".equals(m.getStatus());
        return new MemberDto(
                m.getId(), m.getUserId(),
                user == null ? null : user.getUsername(),
                joined && user != null ? user.getEmail() : null,
                joined && user != null ? user.getMobile() : null,
                m.getRole(), m.getStatus(),
                inviter == null ? null : inviter.getUsername(),
                m.getJoinedAt(), m.getInvitedAt(),
                tripVehicleCode != null, tripVehicleCode);
    }

    private static int roleOrder(String role) {
        return switch (role == null ? "" : role) {
            case "OWNER" -> 0;
            case "ADMIN" -> 1;
            case "DRIVER" -> 2;
            default -> 3;
        };
    }

    static String roleWords(String role) {
        return switch (role == null ? "" : role) {
            case "OWNER" -> "the owner";
            case "ADMIN" -> "an admin";
            case "DRIVER" -> "a driver";
            case "VIEWER" -> "a viewer";
            default -> "a member";
        };
    }

    private static String shorten(String text, int max) {
        return text.length() > max ? text.substring(0, max) + "…" : text;
    }
}
