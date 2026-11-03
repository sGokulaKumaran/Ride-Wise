package vehicle.ridewise.service;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.dto.OrgDtos.AccessHolder;
import vehicle.ridewise.dto.OrgDtos.AccessPasswordRequest;
import vehicle.ridewise.dto.OrgDtos.AccessRequest;
import vehicle.ridewise.dto.OrgDtos.AdminOrgPatch;
import vehicle.ridewise.dto.OrgDtos.Invitation;
import vehicle.ridewise.dto.OrgDtos.MySummary;
import vehicle.ridewise.dto.OrgDtos.OrgCard;
import vehicle.ridewise.dto.OrgDtos.OrgDetail;
import vehicle.ridewise.dto.OrgDtos.OrgRequest;
import vehicle.ridewise.dto.OrgDtos.PageDto;
import vehicle.ridewise.dto.OrgDtos.SessionDto;
import vehicle.ridewise.dto.OrgDtos.SessionRouteDto;
import vehicle.ridewise.dto.OrgDtos.VehicleDetail;
import vehicle.ridewise.dto.OrgDtos.VehicleDto;
import vehicle.ridewise.entity.OrgAccess;
import vehicle.ridewise.entity.OrgMember;
import vehicle.ridewise.entity.Organization;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.repository.OrgAccessRepository;
import vehicle.ridewise.repository.OrgMemberRepository;
import vehicle.ridewise.repository.OrganizationRepository;
import vehicle.ridewise.repository.UserRepository;
import vehicle.ridewise.repository.VehicleRepository;
import vehicle.ridewise.repository.VehicleSessionRepository;
import vehicle.ridewise.websocket.FleetBroadcaster;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

// ============================================================
// OrganizationService — organizations themselves: create, find, open,
// edit, delete.
// ============================================================
@Service
public class OrganizationService {

    static final Set<String> ORG_TYPES = Set.of("COLLEGE", "SCHOOL", "HOSPITAL", "COMPANY", "TRANSPORT", "OTHER");

    private static final String CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    private static final Pattern MOBILE = Pattern.compile("^[+\\d][\\d\\s\\-()]{6,18}$");
    private static final int MAX_OWNED = 5;
    private static final int MIN_PASSWORD = 6;
    private static final int MAX_PASSWORD = 64;
    private static final int MAX_SAVED = 200;

    private final OrganizationRepository organizationRepository;
    private final OrgMemberRepository memberRepository;
    private final OrgAccessRepository accessRepository;
    private final VehicleRepository vehicleRepository;
    private final VehicleSessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final OrgGuard guard;
    private final VehicleSessionService sessionService;
    private final FleetService fleetService;
    private final VehicleAlertService alertService;
    private final NotificationService notificationService;
    private final OrgAuditService audit;
    private final FleetBroadcaster broadcaster;

    private final SecureRandom random = new SecureRandom();

    private final AttemptLimiter perUser = new AttemptLimiter(6, 15 * 60_000L, 10 * 60_000L);
    private final AttemptLimiter perCode = new AttemptLimiter(60, 15 * 60_000L, 5 * 60_000L);

    public OrganizationService(OrganizationRepository organizationRepository,
                               OrgMemberRepository memberRepository,
                               OrgAccessRepository accessRepository,
                               VehicleRepository vehicleRepository,
                               VehicleSessionRepository sessionRepository,
                               UserRepository userRepository,
                               PasswordEncoder passwordEncoder,
                               OrgGuard guard,
                               VehicleSessionService sessionService,
                               FleetService fleetService,
                               VehicleAlertService alertService,
                               NotificationService notificationService,
                               OrgAuditService audit,
                               FleetBroadcaster broadcaster) {
        this.organizationRepository = organizationRepository;
        this.memberRepository = memberRepository;
        this.accessRepository = accessRepository;
        this.vehicleRepository = vehicleRepository;
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.guard = guard;
        this.sessionService = sessionService;
        this.fleetService = fleetService;
        this.alertService = alertService;
        this.notificationService = notificationService;
        this.audit = audit;
        this.broadcaster = broadcaster;
    }

    // ============================================================
    // CREATE
    // ============================================================
    @Transactional
    public OrgDetail create(Long userId, OrgRequest request) {
        if (request == null) throw ApiException.badRequest("Organization details are required");
        if (organizationRepository.countByOwnerUserIdAndStatusNot(userId, "DELETED") >= MAX_OWNED) {
            throw ApiException.conflict("You can own at most " + MAX_OWNED + " organizations");
        }

        Organization org = new Organization();
        org.setOwnerUserId(userId);
        org.setName(requireName(request.name()));
        org.setOrgType(orgType(request.orgType()));
        org.setVisibility(visibility(request.visibility()));
        if (!org.isPublic()) {
            org.setAccessPasswordHash(passwordEncoder.encode(requirePassword(request.accessPassword())));
        }
        applyOptional(org, request);
        org.setStatus("ACTIVE");
        org.setVerified(false);

        Organization saved = saveWithFreshCode(org);

        OrgMember owner = new OrgMember();
        owner.setOrgId(saved.getId());
        owner.setUserId(userId);
        owner.setRole("OWNER");
        owner.setStatus("ACTIVE");
        owner.setJoinedAt(LocalDateTime.now());
        memberRepository.save(owner);

        audit.record(saved.getId(), userId, "org.create", "created the organization");
        return detail(saved.getId(), userId);
    }

    private Organization saveWithFreshCode(Organization org) {
        for (int attempt = 0; attempt < 6; attempt++) {
            String code = newCode();
            if (organizationRepository.existsByOrgCode(code)) continue;
            org.setOrgCode(code);
            try {
                return organizationRepository.saveAndFlush(org);
            } catch (DataIntegrityViolationException e) {
                // someone drew the same code in the same instant → try another
            }
        }
        throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                "Couldn't create the organization right now. Please try again.");
    }

    private String newCode() {
        StringBuilder code = new StringBuilder("RW-");
        for (int i = 0; i < 6; i++) code.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
        return code.toString();
    }

    // ============================================================
    // EDIT (admins; visibility and password by the owner)
    // ============================================================
    @Transactional
    public OrgDetail update(Long orgId, Long userId, OrgRequest request) {
        if (request == null) throw ApiException.badRequest("Nothing to change");
        Organization org = guard.requireOrg(orgId);
        guard.requireManager(orgId, userId);

        if (request.name() != null) org.setName(requireName(request.name()));
        if (request.orgType() != null) org.setOrgType(orgType(request.orgType()));

        Integer limitBefore = org.getSpeedLimitKmh();
        applyOptional(org, request);

        boolean wentPrivate = false;
        if (request.visibility() != null && !visibility(request.visibility()).equals(org.getVisibility())) {
            guard.requireOwner(orgId, userId);
            String next = visibility(request.visibility());
            if ("PRIVATE".equals(next)) {
                org.setAccessPasswordHash(passwordEncoder.encode(requirePassword(request.accessPassword())));
                wentPrivate = true;
            } else {
                org.setAccessPasswordHash(null);
            }
            org.setVisibility(next);
            audit.record(orgId, userId, "org.visibility",
                    "made the organization " + ("PRIVATE".equals(next) ? "private" : "public"));
        }

        Organization saved = organizationRepository.save(org);
        audit.record(orgId, userId, "org.edit", "updated the organization's details");

        if (wentPrivate) {
            accessRepository.deleteAllForOrg(orgId);
            alertService.removeForNonMembers(orgId);
            Tx.afterCommit(() -> broadcaster.dropOrg(orgId));
        }
        if (!java.util.Objects.equals(limitBefore, saved.getSpeedLimitKmh())) {
            Integer limit = saved.getSpeedLimitKmh();
            Tx.afterCommit(() -> sessionService.speedLimitChanged(orgId, limit));
        }
        return detail(orgId, userId);
    }

    @Transactional
    public void setAccessPassword(Long orgId, Long userId, AccessPasswordRequest request) {
        Organization org = guard.requireOrg(orgId);
        guard.requireManager(orgId, userId);
        if (org.isPublic()) throw ApiException.badRequest("A public organization has no access password");
        if (request == null) throw ApiException.badRequest("A new password is required");

        org.setAccessPasswordHash(passwordEncoder.encode(requirePassword(request.password())));
        organizationRepository.save(org);

        boolean revoke = Boolean.TRUE.equals(request.revokeExisting());
        if (revoke) {
            accessRepository.deleteAllForOrg(orgId);
            alertService.removeForNonMembers(orgId);
            Tx.afterCommit(() -> broadcaster.dropOrg(orgId));
        }
        audit.record(orgId, userId, "org.password",
                revoke ? "reset the access password and removed everyone's saved access"
                        : "reset the access password");
    }

    // ============================================================
    // DELETE (owner or platform admin)
    // ============================================================
    @Transactional
    public void delete(Long orgId, Long userId) {
        Organization org = guard.requireOrg(orgId);
        guard.requireOwner(orgId, userId);

        sessionService.endAllForOrg(orgId, "ORG", userId);
        org.setStatus("DELETED");
        organizationRepository.save(org);
        accessRepository.deleteAllForOrg(orgId);
        alertService.removeForOrg(orgId);
        audit.record(orgId, userId, "org.delete", "deleted the organization");
        Tx.afterCommit(() -> broadcaster.dropOrg(orgId));
    }

    @Transactional
    public void adminDelete(Long orgId, Long adminUserId) {
        Organization org = guard.requireOrg(orgId);
        sessionService.endAllForOrg(orgId, "ORG", null);
        org.setStatus("DELETED");
        organizationRepository.save(org);
        accessRepository.deleteAllForOrg(orgId);
        alertService.removeForOrg(orgId);
        audit.record(orgId, null, "org.delete", "deleted the organization (platform admin)");
        Tx.afterCommit(() -> broadcaster.dropOrg(orgId));
    }

    // ============================================================
    // FIND
    // ============================================================
    public List<OrgCard> search(String query, Long userId) {
        String q = query == null ? "" : query.trim();
        if (q.length() < 2) return List.of();
        if (q.length() > 60) q = q.substring(0, 60);

        List<Organization> found = new ArrayList<>(
                organizationRepository.searchPublic(escapeLike(q), PageRequest.of(0, 20)));

        String code = normalizeCode(q);
        if (code != null && found.stream().noneMatch(o -> o.getOrgCode().equals(code))) {
            organizationRepository.findByOrgCode(code)
                    .filter(o -> o.isActive() && guard.canView(o, userId))
                    .ifPresent(o -> found.add(0, o));
        }
        return cards(found, userId);
    }

    public OrgDetail detail(Long orgId, Long userId) {
        Organization org = guard.requireOrg(orgId);
        guard.requireView(org, userId);

        OrgMember member = guard.memberOf(orgId, userId);
        boolean manager = member != null && member.isManager();
        OrgCard card = cards(List.of(org), userId).get(0);

        accessRepository.findByUserIdAndOrgId(userId, orgId).ifPresent(access -> {
            access.setLastAccessedAt(LocalDateTime.now());
            accessRepository.save(access);
        });

        return new OrgDetail(
                card, org.getLat(), org.getLng(), org.getContactPhone(),
                Boolean.TRUE.equals(org.getShowDriverPhone()),
                manager ? org.getSpeedLimitKmh() : null,
                manager,
                member != null && member.isOwner(),
                member != null && member.canDrive() && org.isActive(),
                manager ? Long.valueOf(memberRepository.countByOrgIdAndStatus(orgId, "ACTIVE")) : null,
                manager ? Long.valueOf(accessRepository.countByOrgId(orgId)) : null,
                org.getCreatedAt());
    }

    // ============================================================
    // THE TRACKING SCREEN — one vehicle with everything around it
    // ============================================================
    public VehicleDetail vehicleDetail(Long orgId, Long vehicleId, Long userId) {
        Organization org = guard.requireOrg(orgId);
        VehicleDto vehicle = fleetService.getVehicle(orgId, vehicleId, userId);
        boolean manager = guard.isManager(orgId, userId);

        SessionRouteDto route = null;
        SessionDto lastTrip = null;
        if (vehicle.trip() != null) {
            SessionRouteDto full = sessionService.routeOf(vehicle.trip().sessionId());
            if (full != null) route = new SessionRouteDto(full.routeCoordinates(), null, full.stops());
        } else {
            lastTrip = sessionRepository.findFirstByVehicleIdAndStatusOrderByStartedAtDesc(vehicleId, "COMPLETED")
                    .map(sessionService::toDto)
                    .map(trip -> manager ? trip : withoutDrivingRecord(trip))
                    .orElse(null);
        }

        return new VehicleDetail(vehicle, route, cards(List.of(org), userId).get(0),
                org.getContactPhone(), alertService.myAlert(userId, vehicleId), lastTrip);
    }

    private static SessionDto withoutDrivingRecord(SessionDto t) {
        return new SessionDto(t.id(), t.orgId(), t.vehicleId(), t.vehicleCode(), null, t.driverName(),
                t.routeId(), t.routeName(), t.fromName(), t.fromLat(), t.fromLng(),
                t.destinationName(), t.destinationLat(), t.destinationLng(),
                t.status(), null, t.startedAt(), t.endedAt(), t.distanceMeters(),
                t.plannedDistanceMeters(), t.plannedDurationSeconds(), null, null,
                t.lastLat(), t.lastLng(), t.lastLocationAt(), t.crowdLevel(), false, null);
    }

    // ============================================================
    // OPEN A PRIVATE ORGANIZATION / SAVE A PUBLIC ONE
    // ============================================================
    @Transactional
    public OrgCard access(Long userId, AccessRequest request) {
        String code = request == null ? null : normalizeCode(request.orgCode());
        if (code == null) throw ApiException.badRequest("Enter the organization code, for example RW-7K3M9Q");

        String userKey = "u" + userId;
        long locked = Math.max(perUser.lockedMinutes(userKey), perCode.lockedMinutes(code));
        if (locked > 0) {
            throw ApiException.tooManyRequests("Too many wrong attempts. Try again in " + locked
                    + (locked == 1 ? " minute." : " minutes."));
        }

        Organization org = organizationRepository.findByOrgCode(code).orElse(null);
        boolean allowed = false;
        if (org != null && org.isActive()) {
            OrgMember member = guard.activeMember(org.getId(), userId);
            allowed = org.isPublic()
                    || member != null
                    || (org.getAccessPasswordHash() != null && request.password() != null
                        && passwordEncoder.matches(request.password(), org.getAccessPasswordHash()));
        }
        if (!allowed) {
            perUser.recordFailure(userKey);
            perCode.recordFailure(code);
            throw ApiException.forbidden("That organization code or password is not right");
        }
        perUser.recordSuccess(userKey);

        remember(userId, org.getId());
        return cards(List.of(org), userId).get(0);
    }

    @Transactional
    public OrgCard save(Long orgId, Long userId) {
        Organization org = guard.requireOrg(orgId);
        guard.requireView(org, userId);
        remember(userId, orgId);
        return cards(List.of(org), userId).get(0);
    }

    @Transactional
    public void unsave(Long orgId, Long userId) {
        accessRepository.deleteByUserIdAndOrgId(userId, orgId);
        Organization org = organizationRepository.findById(orgId).orElse(null);
        if (org != null && !org.isPublic() && guard.activeMember(orgId, userId) == null) {
            alertService.removeForUserInOrg(userId, orgId);
            Tx.afterCommit(() -> broadcaster.dropUser(orgId, userId));
        }
    }

    private void remember(Long userId, Long orgId) {
        OrgAccess access = accessRepository.findByUserIdAndOrgId(userId, orgId).orElse(null);
        if (access == null) {
            if (accessRepository.countByUserId(userId) >= MAX_SAVED) {
                throw ApiException.conflict("Your list is full. Remove an organization you no longer need first.");
            }
            access = new OrgAccess();
            access.setUserId(userId);
            access.setOrgId(orgId);
        }
        access.setLastAccessedAt(LocalDateTime.now());
        accessRepository.save(access);
    }

    public List<OrgCard> saved(Long userId) {
        List<Long> ids = accessRepository.findByUserIdOrderByLastAccessedAtDesc(userId, PageRequest.of(0, MAX_SAVED))
                .stream().map(OrgAccess::getOrgId).toList();
        if (ids.isEmpty()) return List.of();

        Map<Long, Organization> byId = organizationRepository.findAllById(ids).stream()
                .filter(Organization::isActive)
                .collect(Collectors.toMap(Organization::getId, o -> o));
        List<Organization> ordered = ids.stream().map(byId::get).filter(java.util.Objects::nonNull).toList();
        return cards(ordered, userId);
    }

    public PageDto<AccessHolder> accessHolders(Long orgId, Long userId, int page, int size) {
        guard.requireOrg(orgId);
        guard.requireManager(orgId, userId);
        Page<OrgAccess> rows = accessRepository.findByOrgIdOrderByGrantedAtDesc(
                orgId, PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100))));

        Map<Long, String> names = userRepository.findAllById(rows.stream().map(OrgAccess::getUserId).toList())
                .stream().collect(Collectors.toMap(User::getId, u -> u.getUsername() == null ? "Rider" : u.getUsername()));
        List<AccessHolder> items = rows.stream()
                .map(a -> new AccessHolder(a.getUserId(), names.getOrDefault(a.getUserId(), "Rider"),
                        a.getGrantedAt(), a.getLastAccessedAt()))
                .toList();
        return new PageDto<>(items, rows.getTotalElements(), rows.getNumber(), rows.getSize(), rows.getTotalPages());
    }

    @Transactional
    public void revokeAccess(Long orgId, Long managerId, Long targetUserId) {
        guard.requireOrg(orgId);
        guard.requireManager(orgId, managerId);
        if (accessRepository.deleteByUserIdAndOrgId(targetUserId, orgId) > 0) {
            alertService.removeForUserInOrg(targetUserId, orgId);
            audit.record(orgId, managerId, "org.access.revoke", "removed one person's saved access");
            Tx.afterCommit(() -> broadcaster.dropUser(orgId, targetUserId));
        }
    }

    public MySummary summary(Long userId) {
        List<OrgMember> memberships = memberRepository.findByUserIdAndStatusIn(userId, List.of("ACTIVE", "PENDING"));
        Map<Long, Organization> orgs = organizationRepository
                .findAllById(memberships.stream().map(OrgMember::getOrgId).toList()).stream()
                .filter(o -> !"DELETED".equals(o.getStatus()))
                .collect(Collectors.toMap(Organization::getId, o -> o));

        List<Organization> managed = new ArrayList<>();
        List<Organization> driving = new ArrayList<>();
        List<OrgMember> pending = new ArrayList<>();
        for (OrgMember member : memberships) {
            Organization org = orgs.get(member.getOrgId());
            if (org == null) continue;
            if ("PENDING".equals(member.getStatus())) {
                if (org.isActive()) pending.add(member);
            } else if (member.isManager()) {
                managed.add(org);
            } else if (member.canDrive() && org.isActive()) {
                driving.add(org);
            }
        }

        Map<Long, String> inviters = userRepository
                .findAllById(pending.stream().map(OrgMember::getInvitedBy).filter(java.util.Objects::nonNull).toList())
                .stream().collect(Collectors.toMap(User::getId, u -> u.getUsername() == null ? "An admin" : u.getUsername()));
        List<Invitation> invitations = pending.stream().map(member -> {
            Organization org = orgs.get(member.getOrgId());
            return new Invitation(member.getId(), org.getId(), org.getName(), org.getOrgType(),
                    Boolean.TRUE.equals(org.getVerified()), member.getRole(),
                    inviters.getOrDefault(member.getInvitedBy(), "An admin"), member.getInvitedAt());
        }).toList();

        return new MySummary(
                cards(managed, userId), cards(driving, userId), invitations,
                accessRepository.countByUserId(userId),
                sessionService.myActiveSummary(userId));
    }

    // ============================================================
    // PLATFORM ADMIN — every organization; verify, suspend, delete
    // ============================================================
    public PageDto<Map<String, Object>> adminList(String search, int page, int size) {
        PageRequest pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)),
                Sort.by(Sort.Direction.DESC, "id"));
        String q = search == null ? "" : search.trim();
        Page<Organization> rows = q.isEmpty()
                ? organizationRepository.findByStatusNot("DELETED", pageable)
                : organizationRepository.adminSearch(escapeLike(q), pageable);

        List<Long> ids = rows.stream().map(Organization::getId).toList();
        Map<Long, Long> fleet = counts(ids.isEmpty() ? List.of() : vehicleRepository.countFleetByOrgIds(ids));
        Map<Long, Long> members = counts(ids.isEmpty() ? List.of() : memberRepository.countActiveByOrgIds(ids));
        Map<Long, Long> running = counts(ids.isEmpty() ? List.of() : sessionRepository.countActiveByOrgIds(ids));
        Map<Long, User> owners = userRepository.findAllById(rows.stream().map(Organization::getOwnerUserId).toList())
                .stream().collect(Collectors.toMap(User::getId, u -> u));

        List<Map<String, Object>> items = rows.stream().map(org -> {
            User owner = owners.get(org.getOwnerUserId());
            Map<String, Object> row = new HashMap<>();
            row.put("id", org.getId());
            row.put("orgCode", org.getOrgCode());
            row.put("name", org.getName());
            row.put("orgType", org.getOrgType());
            row.put("visibility", org.getVisibility());
            row.put("status", org.getStatus());
            row.put("verified", Boolean.TRUE.equals(org.getVerified()));
            row.put("ownerUsername", owner == null ? null : owner.getUsername());
            row.put("ownerEmail", owner == null ? null : owner.getEmail());
            row.put("vehicleCount", fleet.getOrDefault(org.getId(), 0L));
            row.put("memberCount", members.getOrDefault(org.getId(), 0L));
            row.put("activeTrips", running.getOrDefault(org.getId(), 0L));
            row.put("createdAt", org.getCreatedAt());
            return row;
        }).toList();
        return new PageDto<>(items, rows.getTotalElements(), rows.getNumber(), rows.getSize(), rows.getTotalPages());
    }

    @Transactional
    public void adminPatch(Long orgId, Long adminUserId, AdminOrgPatch patch) {
        Organization org = guard.requireOrg(orgId);
        if (patch == null) return;

        if (patch.status() != null && "DELETED".equalsIgnoreCase(patch.status().trim())) {
            adminDelete(orgId, adminUserId);
            return;
        }

        if (patch.verified() != null) org.setVerified(patch.verified());

        boolean suspended = false;
        boolean restored = false;
        if (patch.status() != null) {
            String next = patch.status().trim().toUpperCase(Locale.ROOT);
            if (!Set.of("ACTIVE", "SUSPENDED").contains(next)) throw ApiException.badRequest("Unknown status");
            if (!next.equals(org.getStatus())) {
                org.setStatus(next);
                suspended = "SUSPENDED".equals(next);
                restored = !suspended;
            }
        }
        organizationRepository.save(org);

        if (restored) {
            notificationService.notifyWithLink(org.getOwnerUserId(), "org_notice",
                    org.getName() + " is active again",
                    "RideWise restored this organization. Trips and tracking work again.",
                    "/org-admin/" + orgId);
        }

        if (suspended) {
            sessionService.endAllForOrg(orgId, "ORG", null);
            notificationService.notifyWithLink(org.getOwnerUserId(), "org_notice",
                    org.getName() + " was suspended",
                    "RideWise suspended this organization. Its vehicles cannot be tracked until it is restored.",
                    "/org-admin/" + orgId);
            Tx.afterCommit(() -> broadcaster.dropOrg(orgId));
        }
        audit.record(orgId, null, "org.platform",
                suspended ? "suspended the organization"
                        : "updated the organization (verified: " + Boolean.TRUE.equals(org.getVerified())
                          + ", status: " + org.getStatus().toLowerCase(Locale.ROOT) + ")");
    }

    public List<OrgCard> cards(Collection<Organization> orgs, Long userId) {
        if (orgs.isEmpty()) return List.of();
        List<Long> ids = orgs.stream().map(Organization::getId).toList();

        Map<Long, Long> fleet = counts(vehicleRepository.countFleetByOrgIds(ids));
        Map<Long, Long> running = counts(sessionRepository.countActiveByOrgIds(ids));

        Map<Long, OrgMember> mine = new HashMap<>();
        for (OrgMember member : memberRepository.findByUserIdAndStatusIn(userId, List.of("ACTIVE", "PENDING", "SUSPENDED"))) {
            mine.put(member.getOrgId(), member);
        }
        Set<Long> savedIds = new HashSet<>(accessRepository.findSavedOrgIds(userId, ids));

        List<OrgCard> cards = new ArrayList<>(orgs.size());
        for (Organization org : orgs) {
            OrgMember member = mine.get(org.getId());
            cards.add(new OrgCard(
                    org.getId(), org.getOrgCode(), org.getName(), org.getOrgType(), org.getVisibility(),
                    Boolean.TRUE.equals(org.getVerified()), org.getStatus(),
                    org.getDescription(), org.getAddress(),
                    fleet.getOrDefault(org.getId(), 0L), running.getOrDefault(org.getId(), 0L),
                    member == null ? null : member.getRole(),
                    member == null ? null : member.getStatus(),
                    savedIds.contains(org.getId())));
        }
        return cards;
    }

    private static Map<Long, Long> counts(List<Object[]> rows) {
        Map<Long, Long> result = new HashMap<>();
        for (Object[] row : rows) result.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        return result;
    }

    private void applyOptional(Organization org, OrgRequest request) {
        if (request.description() != null) {
            String description = request.description().trim();
            if (description.length() > 600) throw ApiException.badRequest("The description can be at most 600 characters");
            org.setDescription(description.isEmpty() ? null : description);
        }
        if (request.address() != null) {
            String address = request.address().trim();
            if (address.length() > 255) throw ApiException.badRequest("The address can be at most 255 characters");
            org.setAddress(address.isEmpty() ? null : address);
        }
        if (request.lat() != null || request.lng() != null) {
            if (!GeoMath.validLatLng(request.lat(), request.lng())) {
                throw ApiException.badRequest("A valid latitude and longitude are required");
            }
            org.setLat(request.lat());
            org.setLng(request.lng());
        }
        if (request.contactPhone() != null) {
            String phone = request.contactPhone().trim();
            if (!phone.isEmpty() && !MOBILE.matcher(phone).matches()) {
                throw ApiException.badRequest("Please enter a valid contact number");
            }
            org.setContactPhone(phone.isEmpty() ? null : phone);
        }
        if (request.showDriverPhone() != null) org.setShowDriverPhone(request.showDriverPhone());
        if (request.speedLimitKmh() != null) {
            int limit = request.speedLimitKmh();
            if (limit != 0 && (limit < 10 || limit > 160)) {
                throw ApiException.badRequest("The speed limit must be between 10 and 160 km/h (0 switches it off)");
            }
            org.setSpeedLimitKmh(limit == 0 ? null : limit);
        }
    }

    private static String requireName(String value) {
        String name = value == null ? "" : value.trim().replaceAll("\\s+", " ");
        if (name.length() < 2 || name.length() > 80) {
            throw ApiException.badRequest("The organization name must be 2 to 80 characters");
        }
        return name;
    }

    private static String orgType(String value) {
        String type = value == null ? "OTHER" : value.trim().toUpperCase(Locale.ROOT);
        if (!ORG_TYPES.contains(type)) throw ApiException.badRequest("Unknown organization type");
        return type;
    }

    private static String visibility(String value) {
        String visibility = value == null ? "PUBLIC" : value.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("PUBLIC", "PRIVATE").contains(visibility)) throw ApiException.badRequest("Choose public or private");
        return visibility;
    }

    private static String requirePassword(String value) {
        if (value == null || value.length() < MIN_PASSWORD) {
            throw ApiException.badRequest("A private organization needs an access password of at least "
                    + MIN_PASSWORD + " characters");
        }
        if (value.length() > MAX_PASSWORD) {
            throw ApiException.badRequest("The access password can be at most " + MAX_PASSWORD + " characters");
        }
        return value;
    }

    static String normalizeCode(String input) {
        if (input == null) return null;
        String compact = input.trim().toUpperCase(Locale.ROOT).replaceAll("[\\s-]", "");
        if (compact.startsWith("RW")) compact = compact.substring(2);
        if (compact.length() != 6) return null;
        for (char c : compact.toCharArray()) {
            if (CODE_ALPHABET.indexOf(c) < 0) return null;
        }
        return "RW-" + compact;
    }

    private static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
