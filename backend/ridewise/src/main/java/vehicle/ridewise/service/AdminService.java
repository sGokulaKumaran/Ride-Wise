package vehicle.ridewise.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.config.UserStatusCache;
import vehicle.ridewise.entity.Ride;
import vehicle.ridewise.entity.RideParticipant;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.repository.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * AdminService — business logic for the admin dashboard, user management
 * and ride monitoring. Never returns password hashes.
 */
@Service
public class AdminService {

    private static final int MAX_PAGE_SIZE = 100;

    private final UserRepository userRepository;
    private final RideRepository rideRepository;
    private final RideParticipantRepository rideParticipantRepository;
    private final ConnectionRepository connectionRepository;
    private final UserLocationRepository userLocationRepository;
    private final OrganizationRepository organizationRepository;
    private final VehicleRepository vehicleRepository;
    private final VehicleSessionRepository vehicleSessionRepository;
    private final VehicleSessionService vehicleSessionService;
    private final UserStatusCache userStatusCache;

    public AdminService(UserRepository userRepository,
                        RideRepository rideRepository,
                        RideParticipantRepository rideParticipantRepository,
                        ConnectionRepository connectionRepository,
                        UserLocationRepository userLocationRepository,
                        OrganizationRepository organizationRepository,
                        VehicleRepository vehicleRepository,
                        VehicleSessionRepository vehicleSessionRepository,
                        VehicleSessionService vehicleSessionService,
                        UserStatusCache userStatusCache) {
        this.userRepository = userRepository;
        this.rideRepository = rideRepository;
        this.rideParticipantRepository = rideParticipantRepository;
        this.connectionRepository = connectionRepository;
        this.userLocationRepository = userLocationRepository;
        this.organizationRepository = organizationRepository;
        this.vehicleRepository = vehicleRepository;
        this.vehicleSessionRepository = vehicleSessionRepository;
        this.vehicleSessionService = vehicleSessionService;
        this.userStatusCache = userStatusCache;
    }

    // ── Dashboard Stats ──────────────────────────────────────────────

    public Map<String, Object> getDashboardStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalUsers", userRepository.count());
        stats.put("totalRides", rideRepository.count());
        stats.put("activeRides", rideRepository.countByStatus("active"));
        stats.put("completedRides", rideRepository.countByStatus("completed"));
        stats.put("totalSoloRides", rideRepository.countByRideType("solo"));
        stats.put("totalGroupRides", rideRepository.countByRideType("group"));
        // Organizations and their fleets
        stats.put("totalOrganizations", organizationRepository.count() - organizationRepository.countByStatus("DELETED"));
        stats.put("suspendedOrganizations", organizationRepository.countByStatus("SUSPENDED"));
        stats.put("totalVehicles", vehicleRepository.count());
        stats.put("activeVehicleTrips", vehicleSessionRepository.countByStatus("ACTIVE"));
        return stats;
    }

    // ── User Management ──────────────────────────────────────────────

    /**
     * A page of users, optionally filtered by a search text.
     *
     * Search results are a real page too: `totalUsers` is the number of
     * MATCHES, not the size of the current page — it used to be the page
     * size, so a search with more results than one page could never be
     * paged through.
     */
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
        return detail;
    }

    /**
     * Suspend or re-enable an account.
     *
     *   • an admin cannot suspend themself, and admin accounts cannot be
     *     suspended at all (the UI already disables that button — the
     *     server now refuses it too)
     *   • a suspension takes effect immediately: the account's cached
     *     status is dropped, so its very next request is refused even
     *     though it is still "logged in", and its live position is removed
     *     from any group map
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
            // A suspended driver cannot end their own trip any more: end it
            // here, so the vehicle is free for someone else straight away.
            vehicleSessionService.endForUser(userId, adminUserId);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", user.getId());
        result.put("enabled", user.getEnabled());
        result.put("message", enabled ? "User account enabled" : "User account suspended");
        return result;
    }

    // ── Ride Monitoring ──────────────────────────────────────────────

    /**
     * Get paginated list of all rides with optional status and type filters.
     */
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

        // All creators of the page in ONE query (it used to be one per ride)
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

    /**
     * Get single ride details with participant list and creator info.
     */
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
