package vehicle.ridewise.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.config.UserStatusCache;
import vehicle.ridewise.entity.Organization;
import vehicle.ridewise.entity.Ride;
import vehicle.ridewise.entity.RideParticipant;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.repository.*;

import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * AdminService — business logic for the admin dashboard, user management
 * and ride monitoring. Never returns password hashes.
 */
@Service
public class AdminService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern USERNAME = Pattern.compile("^[a-zA-Z0-9_]{3,20}$");
    private static final Pattern MOBILE = Pattern.compile("^[+\\d][\\d\\s\\-()]{6,18}$");
    private static final int MAX_EMAIL = 254;
    private static final int MIN_PASSWORD = 6;
    private static final int MAX_PASSWORD = 128;
    private static final int MAX_ADDRESS = 255;
    private static final Set<String> RODE = Set.of("active", "completed", "left");

    private final UserRepository userRepository;
    private final RideRepository rideRepository;
    private final RideParticipantRepository rideParticipantRepository;
    private final ConnectionRepository connectionRepository;
    private final UserLocationRepository userLocationRepository;
    private final OrganizationRepository organizationRepository;
    private final OrgMemberRepository orgMemberRepository;
    private final OrgAccessRepository orgAccessRepository;
    private final VehicleAlertRepository vehicleAlertRepository;
    private final VehicleRepository vehicleRepository;
    private final VehicleSessionRepository vehicleSessionRepository;
    private final FeedbackRepository feedbackRepository;
    private final VehicleSessionService vehicleSessionService;
    private final OrganizationService organizationService;
    private final RideService rideService;
    private final DataCleanupService dataCleanupService;
    private final PasswordEncoder passwordEncoder;
    private final LoginAttemptService loginAttempts;
    private final UserStatusCache userStatusCache;

    public AdminService(UserRepository userRepository,
                        RideRepository rideRepository,
                        RideParticipantRepository rideParticipantRepository,
                        ConnectionRepository connectionRepository,
                        UserLocationRepository userLocationRepository,
                        OrganizationRepository organizationRepository,
                        OrgMemberRepository orgMemberRepository,
                        OrgAccessRepository orgAccessRepository,
                        VehicleAlertRepository vehicleAlertRepository,
                        VehicleRepository vehicleRepository,
                        VehicleSessionRepository vehicleSessionRepository,
                        FeedbackRepository feedbackRepository,
                        VehicleSessionService vehicleSessionService,
                        OrganizationService organizationService,
                        RideService rideService,
                        DataCleanupService dataCleanupService,
                        PasswordEncoder passwordEncoder,
                        LoginAttemptService loginAttempts,
                        UserStatusCache userStatusCache) {
        this.userRepository = userRepository;
        this.rideRepository = rideRepository;
        this.rideParticipantRepository = rideParticipantRepository;
        this.connectionRepository = connectionRepository;
        this.userLocationRepository = userLocationRepository;
        this.organizationRepository = organizationRepository;
        this.orgMemberRepository = orgMemberRepository;
        this.orgAccessRepository = orgAccessRepository;
        this.vehicleAlertRepository = vehicleAlertRepository;
        this.vehicleRepository = vehicleRepository;
        this.vehicleSessionRepository = vehicleSessionRepository;
        this.feedbackRepository = feedbackRepository;
        this.vehicleSessionService = vehicleSessionService;
        this.organizationService = organizationService;
        this.rideService = rideService;
        this.dataCleanupService = dataCleanupService;
        this.passwordEncoder = passwordEncoder;
        this.loginAttempts = loginAttempts;
        this.userStatusCache = userStatusCache;
    }

    // ── Dashboard Stats ──────────────────────────────────────────────

    public Map<String, Object> getDashboardStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalUsers", userRepository.count());
        stats.put("totalRides", rideRepository.count());
        stats.put("activeRides", rideRepository.countByStatus("active"));
        stats.put("completedRides", rideRepository.countByStatus("completed"));
        stats.put("cancelledRides", rideRepository.countByStatus("cancelled"));
        stats.put("totalSoloRides", rideRepository.countByRideType("solo"));
        stats.put("totalGroupRides", rideRepository.countByRideType("group"));
        // Organizations and their fleets
        stats.put("totalOrganizations", organizationRepository.count() - organizationRepository.countByStatus("DELETED"));
        stats.put("suspendedOrganizations", organizationRepository.countByStatus("SUSPENDED"));
        stats.put("totalVehicles", vehicleRepository.count());
        stats.put("activeVehicleTrips", vehicleSessionRepository.countByStatus("ACTIVE"));
        stats.put("totalFeedback", feedbackRepository.count());
        stats.put("openFeedback", feedbackRepository.countByStatus("OPEN"));
        return stats;
    }

    // ── User Management ──────────────────────────────────────────────

    public Map<String, Object> getUsers(String search, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), clampSize(size), Sort.by(Sort.Direction.DESC, "id"));
        String query = search == null ? "" : search.trim();

        Page<User> users = query.isEmpty()
                ? userRepository.findAll(pageable)
                : userRepository.adminSearchUsers(query, pageable);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("users", users.getContent().stream().map(this::toUserMap).collect(Collectors.toList()));
        result.put("totalUsers", users.getTotalElements());
        result.put("totalPages", users.getTotalPages());
        result.put("page", users.getNumber());
        result.put("size", users.getSize());
        return result;
    }

    /**
     * Get single user details with ride count and connection count.
     */
    public Map<String, Object> getUserDetail(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));

        Map<String, Object> detail = toUserMap(user);
        detail.put("rideCount", rideRepository.findByUserIdOrderByCreatedAtDesc(userId).size());
        detail.put("connectionCount", connectionRepository.findConnectedUserIds(userId).size());
        detail.put("ownedOrgCount", organizationRepository.countByOwnerUserIdAndStatusNot(userId, "DELETED"));
        return detail;
    }

    /**
     * Suspend or re-enable an account.
     */
    @Transactional
    public Map<String, Object> updateUserStatus(Long userId, Boolean enabled, Long adminUserId) {
        if (userId.equals(adminUserId)) {
            throw ApiException.badRequest("You cannot disable your own admin account");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
        if ("ADMIN".equals(user.getRole())) {
            throw ApiException.forbidden("Admin accounts cannot be suspended");
        }

        user.setEnabled(enabled);
        userRepository.save(user);
        userStatusCache.evict(userId);
        if (!enabled) {
            userLocationRepository.deleteByUserId(userId);
            vehicleSessionService.endForUser(userId, adminUserId);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", user.getId());
        result.put("enabled", user.getEnabled());
        result.put("message", enabled ? "User account enabled" : "User account suspended");
        return result;
    }

    /**
     * Full admin edit of a user account: username, email, password, mobile,
     * address, role, enabled status, public profile, and ride retention.
     */
    @Transactional
    public Map<String, Object> updateUser(Long userId, Map<String, Object> body, Long adminUserId) {
        if (body == null || body.isEmpty()) {
            throw ApiException.badRequest("No fields provided to update");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));

        // 1. Username
        if (body.containsKey("username")) {
            Object raw = body.get("username");
            String username = raw == null ? "" : String.valueOf(raw).trim();
            if (username.isEmpty()) {
                user.setUsername(null);
            } else {
                if (!USERNAME.matcher(username).matches()) {
                    throw ApiException.badRequest("Username must be 3-20 letters, numbers or underscores");
                }
                userRepository.findByUsernameIgnoreCase(username).ifPresent(existing -> {
                    if (!existing.getId().equals(userId)) {
                        throw ApiException.conflict("Username is already taken");
                    }
                });
                user.setUsername(username);
            }
        }

        // 2. Email
        if (body.containsKey("email") && body.get("email") != null) {
            String email = String.valueOf(body.get("email")).trim().toLowerCase(Locale.ROOT);
            if (email.isEmpty() || email.length() > MAX_EMAIL || !EMAIL.matcher(email).matches()) {
                throw ApiException.badRequest("A valid email is required");
            }
            userRepository.findByEmailIgnoreCase(email).ifPresent(existing -> {
                if (!existing.getId().equals(userId)) {
                    throw ApiException.conflict("Email already registered to another account");
                }
            });
            user.setEmail(email);
        }

        // 3. Password (optional — only updated when a non-blank string is supplied)
        if (body.containsKey("password") && body.get("password") != null) {
            String newPassword = String.valueOf(body.get("password"));
            if (!newPassword.isBlank()) {
                if (newPassword.length() < MIN_PASSWORD) {
                    throw ApiException.badRequest("Password must be at least " + MIN_PASSWORD + " characters");
                }
                if (newPassword.length() > MAX_PASSWORD) {
                    throw ApiException.badRequest("Password must be at most " + MAX_PASSWORD + " characters");
                }
                user.setPassword(passwordEncoder.encode(newPassword));
                user.setSessionsValidAfter(System.currentTimeMillis());
                loginAttempts.recordSuccess(user.getEmail());
                loginAttempts.recordSuccess("account:" + user.getId());
            }
        }

        // 4. Mobile
        if (body.containsKey("mobile")) {
            Object raw = body.get("mobile");
            String mobile = raw == null ? "" : String.valueOf(raw).trim();
            if (!mobile.isEmpty() && !MOBILE.matcher(mobile).matches()) {
                throw ApiException.badRequest("Please enter a valid mobile number");
            }
            user.setMobile(mobile.isEmpty() ? null : mobile);
        }

        // 5. Address
        if (body.containsKey("address")) {
            Object raw = body.get("address");
            String address = raw == null ? "" : String.valueOf(raw).trim();
            if (address.length() > MAX_ADDRESS) {
                throw ApiException.badRequest("Address must be at most " + MAX_ADDRESS + " characters");
            }
            user.setAddress(address.isEmpty() ? null : address);
        }

        // 6. Role
        if (body.containsKey("role") && body.get("role") != null) {
            String nextRole = String.valueOf(body.get("role")).trim().toUpperCase(Locale.ROOT);
            if (!"USER".equals(nextRole) && !"ADMIN".equals(nextRole)) {
                throw ApiException.badRequest("Role must be USER or ADMIN");
            }
            if ("ADMIN".equals(user.getRole()) && !"ADMIN".equals(nextRole)) {
                if (userId.equals(adminUserId)) {
                    throw ApiException.badRequest("You cannot remove your own admin role");
                }
                if (userRepository.findByRole("ADMIN").size() <= 1) {
                    throw ApiException.conflict("Cannot demote the last admin on the platform");
                }
            }
            user.setRole(nextRole);
        }

        // 7. Enabled status
        if (body.containsKey("enabled") && body.get("enabled") instanceof Boolean nextEnabled) {
            if (!nextEnabled) {
                if (userId.equals(adminUserId)) {
                    throw ApiException.badRequest("You cannot suspend your own admin account");
                }
                if ("ADMIN".equals(user.getRole())) {
                    throw ApiException.forbidden("Admin accounts cannot be suspended; change role to USER first");
                }
            }
            user.setEnabled(nextEnabled);
            if (!nextEnabled) {
                userLocationRepository.deleteByUserId(userId);
                vehicleSessionService.endForUser(userId, adminUserId);
            }
        }

        // 8. Public profile
        if (body.containsKey("profilePublic") && body.get("profilePublic") instanceof Boolean pub) {
            user.setProfilePublic(pub);
        }

        // 9. Auto-delete rides days
        if (body.containsKey("autoDeleteRidesDays")) {
            Object raw = body.get("autoDeleteRidesDays");
            int days = 0;
            if (raw instanceof Number num) {
                days = num.intValue();
            } else if (raw != null && !String.valueOf(raw).isBlank()) {
                try {
                    days = Integer.parseInt(String.valueOf(raw).trim());
                } catch (NumberFormatException e) {
                    throw ApiException.badRequest("autoDeleteRidesDays must be a valid number");
                }
            }
            if (days < 0 || days > 3650) {
                throw ApiException.badRequest("Auto-delete days must be between 0 (never) and 3650");
            }
            user.setAutoDeleteRidesDays(days);
            if (days > 0) {
                dataCleanupService.cleanupUserAutoDeleteRides(userId, days);
            }
        }

        userRepository.save(user);
        userStatusCache.evict(userId);
        return getUserDetail(userId);
    }

    /**
     * Permanently delete a user account and all its associated data.
     */
    @Transactional
    public void deleteUser(Long userId, Long adminUserId) {
        if (userId.equals(adminUserId)) {
            throw ApiException.badRequest("You cannot delete your own admin account from the admin panel");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));

        if ("ADMIN".equals(user.getRole()) && userRepository.findByRole("ADMIN").size() <= 1) {
            throw ApiException.conflict("Cannot delete the last platform admin");
        }

        // Clean up any organizations owned by this user
        for (Organization org : organizationRepository.findByOwnerUserIdAndStatusNot(userId, "DELETED")) {
            organizationService.adminDelete(org.getId(), adminUserId);
        }

        // End any active vehicle trip they are driving
        vehicleSessionService.endForUser(userId, adminUserId);

        // Leave active group rides where they are a member
        for (RideParticipant participant : rideParticipantRepository.findByUserIdAndStatus(userId, "active")) {
            if ("admin".equals(participant.getRole())) continue;
            rideService.updateParticipantStatus(participant.getRideId(), userId, "left", userId);
        }

        // Clean up their created rides
        for (Ride ride : rideRepository.findByUserIdOrderByCreatedAtDesc(userId)) {
            boolean group = "group".equals(ride.getRideType());
            if (group && "active".equals(ride.getStatus())) {
                rideService.endAbandonedRide(ride.getId());
            }
            if (!group || !riddenByOthers(ride.getId(), userId)) {
                rideService.adminDeleteRide(ride.getId(), adminUserId);
            }
        }

        orgMemberRepository.deleteByUserId(userId);
        orgAccessRepository.deleteByUserId(userId);
        vehicleAlertRepository.deleteByUserId(userId);
        dataCleanupService.cleanupUserData(userId);

        userRepository.delete(user);
        userStatusCache.evict(userId);
    }

    private boolean riddenByOthers(Long rideId, Long userId) {
        return rideParticipantRepository.findByRideId(rideId).stream()
                .anyMatch(p -> !Objects.equals(p.getUserId(), userId) && RODE.contains(p.getStatus()));
    }

    // ── Ride Monitoring & Management ─────────────────────────────────

    public Map<String, Object> getRides(String status, String type, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), clampSize(size));
        Page<Ride> ridePage;

        boolean hasStatus = status != null && !status.trim().isEmpty();
        boolean hasType = type != null && !type.trim().isEmpty();

        if (hasStatus && hasType) {
            ridePage = rideRepository.findByStatusAndRideTypeOrderByCreatedAtDesc(status.trim(), type.trim(), pageable);
        } else if (hasStatus) {
            ridePage = rideRepository.findByStatusOrderByCreatedAtDesc(status.trim(), pageable);
        } else if (hasType) {
            ridePage = rideRepository.findByRideTypeOrderByCreatedAtDesc(type.trim(), pageable);
        } else {
            ridePage = rideRepository.findAllByOrderByCreatedAtDesc(pageable);
        }

        Map<Long, User> creators = usersById(ridePage.getContent().stream()
                .map(Ride::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("rides", ridePage.getContent().stream()
                .map(ride -> toRideMap(ride, creators.get(ride.getUserId())))
                .collect(Collectors.toList()));
        result.put("totalRides", ridePage.getTotalElements());
        result.put("page", ridePage.getNumber());
        result.put("size", ridePage.getSize());
        result.put("totalPages", ridePage.getTotalPages());
        return result;
    }

    public Map<String, Object> getRideDetail(Long rideId) {
        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> ApiException.notFound("Ride not found"));

        Map<String, Object> detail = toRideMap(ride,
                ride.getUserId() == null ? null : userRepository.findById(ride.getUserId()).orElse(null));

        if ("group".equals(ride.getRideType())) {
            List<RideParticipant> participants = rideParticipantRepository.findByRideId(rideId);
            Map<Long, User> users = usersById(participants.stream()
                    .map(RideParticipant::getUserId)
                    .collect(Collectors.toSet()));

            detail.put("participants", participants.stream().map(p -> {
                Map<String, Object> pMap = new LinkedHashMap<>();
                pMap.put("id", p.getId());
                pMap.put("userId", p.getUserId());
                pMap.put("role", p.getRole());
                pMap.put("status", p.getStatus());
                pMap.put("joinedAt", p.getJoinedAt());
                User u = users.get(p.getUserId());
                if (u != null) {
                    pMap.put("username", u.getUsername());
                    pMap.put("email", u.getEmail());
                }
                return pMap;
            }).collect(Collectors.toList()));
        }

        return detail;
    }

    @Transactional
    public void deleteRide(Long rideId, Long adminUserId) {
        rideService.adminDeleteRide(rideId, adminUserId);
    }

    @Transactional
    public Map<String, Object> endRide(Long rideId, Long adminUserId) {
        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> ApiException.notFound("Ride not found"));
        if ("active".equals(ride.getStatus())) {
            rideService.endAbandonedRide(rideId);
        }
        return getRideDetail(rideId);
    }

    @Transactional
    public Map<String, Object> cleanupFinishedRides(Integer olderThanDays) {
        int deleted = dataCleanupService.adminCleanupFinishedRides(olderThanDays);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("deletedCount", deleted);
        res.put("message", deleted == 0
                ? "No finished rides matched the cleanup criteria."
                : "Deleted " + deleted + " finished ride" + (deleted == 1 ? "" : "s") + ".");
        return res;
    }

    // ── Private helpers ──────────────────────────────────────────────

    private static int clampSize(int size) {
        return Math.min(MAX_PAGE_SIZE, Math.max(1, size));
    }

    private Map<Long, User> usersById(Collection<Long> ids) {
        if (ids.isEmpty()) return Map.of();
        return userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, user -> user));
    }

    /**
     * Convert User entity to a safe map (no password hash).
     */
    private Map<String, Object> toUserMap(User user) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", user.getId());
        map.put("email", user.getEmail());
        map.put("username", user.getUsername());
        map.put("mobile", user.getMobile());
        map.put("address", user.getAddress());
        map.put("role", user.getRole());
        map.put("enabled", user.getEnabled());
        map.put("profilePublic", !Boolean.FALSE.equals(user.getProfilePublic()));
        map.put("autoDeleteRidesDays", user.getAutoDeleteRidesDays() != null && user.getAutoDeleteRidesDays() > 0
                ? user.getAutoDeleteRidesDays()
                : 0);
        map.put("createdAt", user.getCreatedAt());
        return map;
    }

    /**
     * Convert Ride entity to a map with creator info (no route coordinates,
     * to keep payloads small).
     */
    private Map<String, Object> toRideMap(Ride ride, User creator) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", ride.getId());
        map.put("userId", ride.getUserId());
        map.put("fromName", ride.getFromName());
        map.put("destinationName", ride.getDestinationName());
        map.put("rideType", ride.getRideType());
        map.put("status", ride.getStatus());
        map.put("distanceMeters", ride.getDistanceMeters());
        map.put("actualDistanceMeters", ride.getActualDistanceMeters());
        map.put("durationSeconds", ride.getDurationSeconds());
        map.put("createdAt", ride.getCreatedAt());
        map.put("endedAt", ride.getEndedAt());
        if (creator != null) {
            map.put("creatorUsername", creator.getUsername());
            map.put("creatorEmail", creator.getEmail());
        }
        return map;
    }
}
