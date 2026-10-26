package vehicle.ridewise.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.config.UserStatusCache;
import vehicle.ridewise.dto.AccountDtos.DeleteCheck;
import vehicle.ridewise.dto.AccountDtos.OwnedOrganization;
import vehicle.ridewise.entity.OrgAccess;
import vehicle.ridewise.entity.OrgMember;
import vehicle.ridewise.entity.Organization;
import vehicle.ridewise.entity.Ride;
import vehicle.ridewise.entity.RideParticipant;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.entity.VehicleSession;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.repository.ConnectionRepository;
import vehicle.ridewise.repository.OrgAccessRepository;
import vehicle.ridewise.repository.OrgMemberRepository;
import vehicle.ridewise.repository.OrganizationRepository;
import vehicle.ridewise.repository.RideParticipantRepository;
import vehicle.ridewise.repository.RideRepository;
import vehicle.ridewise.repository.UserRepository;
import vehicle.ridewise.repository.VehicleAlertRepository;
import vehicle.ridewise.repository.VehicleSessionRepository;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

// ============================================================
// AccountService — the whole account at once: download it, delete it
//
// DELETING AN ACCOUNT
//   Refused while the person still OWNS an organization (its vehicles,
//   drivers and riders would be left without anyone in charge — they
//   transfer it or delete it first), and for the last platform admin
//   (a fresh, publicly known default admin would otherwise be created
//   on the next start, see DataInitializer).
//
//   On the way out, in one transaction:
//     • a trip they are driving ends, so the vehicle is free again
//     • group rides they are riding in: they leave (the admin is told)
//     • their own rides: an active group ride ends for everyone; solo
//       rides, and group rides nobody else rode, are deleted; group rides
//       others took part in stay in those riders' history
//     • memberships and invitations, saved organizations, "tell me when
//       it's near" alerts, connections, notifications, positions
//     • the account itself
//   What organizations keep — trip history, activity log, announcements —
//   carries the person's name as it was, so it stays readable.
//
// DOWNLOADING THE DATA
//   Profile, rides (without route geometry), connections, organizations
//   and trips driven, as one JSON document.
// ============================================================
@Service
public class AccountService {

    private static final Logger log = LoggerFactory.getLogger(AccountService.class);
    private static final Set<String> RODE = Set.of("active", "completed", "left");

    private final UserRepository userRepository;
    private final RideRepository rideRepository;
    private final RideParticipantRepository participantRepository;
    private final ConnectionRepository connectionRepository;
    private final OrganizationRepository organizationRepository;
    private final OrgMemberRepository orgMemberRepository;
    private final OrgAccessRepository orgAccessRepository;
    private final VehicleAlertRepository vehicleAlertRepository;
    private final VehicleSessionRepository vehicleSessionRepository;
    private final RideService rideService;
    private final VehicleSessionService vehicleSessionService;
    private final DataCleanupService dataCleanupService;
    private final AuthService authService;
    private final UserStatusCache userStatusCache;

    public AccountService(UserRepository userRepository, RideRepository rideRepository,
                          RideParticipantRepository participantRepository, ConnectionRepository connectionRepository,
                          OrganizationRepository organizationRepository, OrgMemberRepository orgMemberRepository,
                          OrgAccessRepository orgAccessRepository, VehicleAlertRepository vehicleAlertRepository,
                          VehicleSessionRepository vehicleSessionRepository, RideService rideService,
                          VehicleSessionService vehicleSessionService, DataCleanupService dataCleanupService,
                          AuthService authService, UserStatusCache userStatusCache) {
        this.userRepository = userRepository;
        this.rideRepository = rideRepository;
        this.participantRepository = participantRepository;
        this.connectionRepository = connectionRepository;
        this.organizationRepository = organizationRepository;
        this.orgMemberRepository = orgMemberRepository;
        this.orgAccessRepository = orgAccessRepository;
        this.vehicleAlertRepository = vehicleAlertRepository;
        this.vehicleSessionRepository = vehicleSessionRepository;
        this.rideService = rideService;
        this.vehicleSessionService = vehicleSessionService;
        this.dataCleanupService = dataCleanupService;
        this.authService = authService;
        this.userStatusCache = userStatusCache;
    }

    // ============================================================
    // DELETE
    // ============================================================

    /** What stands in the way of deleting this account, shown before asking for the password. */
    @Transactional(readOnly = true)
    public DeleteCheck deleteCheck(Long userId) {
        return check(findUser(userId));
    }

    @Transactional
    public void deleteAccount(Long userId, String password, String confirm) {
        User user = findUser(userId);
        if (confirm == null || !"DELETE".equals(confirm.trim())) {
            throw ApiException.badRequest("Type DELETE to confirm");
        }
        authService.verifyPassword(user, password);

        DeleteCheck check = check(user);
        if (check.lastPlatformAdmin()) {
            throw ApiException.conflict("You are the only RideWise admin. Make another account an admin before deleting yours.");
        }
        if (!check.ownedOrganizations().isEmpty()) {
            String names = check.ownedOrganizations().stream().map(OwnedOrganization::name).collect(Collectors.joining(", "));
            throw ApiException.conflict("You still own " + names + ". Transfer ownership or delete "
                    + (check.ownedOrganizations().size() == 1 ? "it" : "them") + " first.");
        }

        // A trip they are driving ends, so the vehicle is free again.
        vehicleSessionService.endForUser(userId, userId);

        // Group rides they are riding in as a member: they leave.
        for (RideParticipant participant : participantRepository.findByUserIdAndStatus(userId, "active")) {
            if ("admin".equals(participant.getRole())) continue; // their own ride — handled below
            rideService.updateParticipantStatus(participant.getRideId(), userId, "left", userId);
        }

        // Their own rides.
        for (Ride ride : rideRepository.findByUserIdOrderByCreatedAtDesc(userId)) {
            boolean group = "group".equals(ride.getRideType());
            if (group && "active".equals(ride.getStatus())) {
                rideService.endAbandonedRide(ride.getId()); // ends it for everyone, who are told
            }
            if (!group || !riddenByOthers(ride.getId(), userId)) {
                rideService.deleteRide(ride.getId(), userId);
            }
        }

        orgMemberRepository.deleteByUserId(userId);
        orgAccessRepository.deleteByUserId(userId);
        vehicleAlertRepository.deleteByUserId(userId);
        dataCleanupService.cleanupUserData(userId);

        userRepository.delete(user);
        userStatusCache.evict(userId);
        log.info("Account #{} was deleted by its owner", userId);
    }

    private DeleteCheck check(User user) {
        Long userId = user.getId();
        List<OwnedOrganization> owned = organizationRepository.findByOwnerUserIdAndStatusNot(userId, "DELETED").stream()
                .map(org -> new OwnedOrganization(org.getId(), org.getName()))
                .collect(Collectors.toList());
        boolean lastAdmin = "ADMIN".equals(user.getRole()) && userRepository.findByRole("ADMIN").size() <= 1;
        long activeRides = participantRepository.findByUserIdAndStatus(userId, "active").size();
        boolean driving = vehicleSessionRepository.findFirstByDriverUserIdAndStatus(userId, "ACTIVE").isPresent();
        return new DeleteCheck(owned.isEmpty() && !lastAdmin, owned, lastAdmin, activeRides, driving);
    }

    // Did anyone besides the creator take part in this group ride?
    private boolean riddenByOthers(Long rideId, Long userId) {
        return participantRepository.findByRideId(rideId).stream()
                .anyMatch(p -> !Objects.equals(p.getUserId(), userId) && RODE.contains(p.getStatus()));
    }

    // ============================================================
    // DOWNLOAD
    // ============================================================

    @Transactional(readOnly = true)
    public Map<String, Object> exportData(Long userId) {
        User user = findUser(userId);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("app", "RideWise");
        data.put("exportedAt", LocalDateTime.now());

        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("id", user.getId());
        profile.put("email", user.getEmail());
        profile.put("username", user.getUsername());
        profile.put("mobile", user.getMobile());
        profile.put("address", user.getAddress());
        profile.put("lat", user.getLat());
        profile.put("lng", user.getLng());
        profile.put("publicProfile", !Boolean.FALSE.equals(user.getProfilePublic()));
        profile.put("role", user.getRole());
        profile.put("memberSince", user.getCreatedAt());
        data.put("profile", profile);

        data.put("rides", rideService.getUserRides(userId, true));

        List<Long> connectionIds = connectionRepository.findConnectedUserIds(userId);
        data.put("connections", userRepository.findAllById(connectionIds).stream()
                .map(User::getUsername)
                .filter(Objects::nonNull)
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .collect(Collectors.toList()));

        List<OrgMember> memberships = orgMemberRepository.findByUserIdAndStatusIn(userId, List.of("ACTIVE", "PENDING"));
        List<OrgAccess> saved = orgAccessRepository.findByUserIdOrderByLastAccessedAtDesc(userId, PageRequest.of(0, 500));
        List<VehicleSession> trips = vehicleSessionRepository.findByDriverUserIdOrderByStartedAtDesc(userId, PageRequest.of(0, 1000));
        Set<Long> orgIds = Stream.of(
                        memberships.stream().map(OrgMember::getOrgId),
                        saved.stream().map(OrgAccess::getOrgId),
                        trips.stream().map(VehicleSession::getOrgId))
                .flatMap(Function.identity())
                .collect(Collectors.toSet());
        Map<Long, Organization> orgs = organizationRepository.findAllById(orgIds).stream()
                .collect(Collectors.toMap(Organization::getId, Function.identity()));
        Function<Long, String> orgName = id -> orgs.containsKey(id) ? orgs.get(id).getName() : "(removed)";

        data.put("organizations", memberships.stream().map(member -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", orgName.apply(member.getOrgId()));
            row.put("role", member.getRole());
            row.put("status", member.getStatus());
            row.put("joinedAt", member.getJoinedAt());
            return row;
        }).collect(Collectors.toList()));
        data.put("savedOrganizations", saved.stream().map(access -> orgName.apply(access.getOrgId())).collect(Collectors.toList()));

        data.put("tripsDriven", trips.stream().map(trip -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("organization", orgName.apply(trip.getOrgId()));
            row.put("vehicle", trip.getVehicleCode());
            row.put("route", trip.getRouteName());
            row.put("from", trip.getFromName());
            row.put("to", trip.getDestinationName());
            row.put("startedAt", trip.getStartedAt());
            row.put("endedAt", trip.getEndedAt());
            row.put("distanceMeters", trip.getDistanceMeters());
            row.put("status", trip.getStatus());
            return row;
        }).collect(Collectors.toList()));

        return data;
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }
}
