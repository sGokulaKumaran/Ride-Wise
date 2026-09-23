package vehicle.ridewise.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.dto.UserResponse;
import vehicle.ridewise.entity.Ride;
import vehicle.ridewise.entity.RideParticipant;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.repository.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * AdminService — Business logic for admin dashboard, user management,
 * and ride monitoring. Uses existing repositories without creating
 * duplicate data access patterns.
 */
@Service
public class AdminService {

    private final UserRepository userRepository;
    private final RideRepository rideRepository;
    private final RideParticipantRepository rideParticipantRepository;
    private final ConnectionRepository connectionRepository;

    public AdminService(UserRepository userRepository,
                        RideRepository rideRepository,
                        RideParticipantRepository rideParticipantRepository,
                        ConnectionRepository connectionRepository) {
        this.userRepository = userRepository;
        this.rideRepository = rideRepository;
        this.rideParticipantRepository = rideParticipantRepository;
        this.connectionRepository = connectionRepository;
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
        return stats;
    }

    // ── User Management ──────────────────────────────────────────────

    /**
     * Get paginated list of all users. Optionally filtered by search query.
     * Never returns password hashes.
     */
    public Map<String, Object> getUsers(String search, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id"));
        List<User> users;
        long totalUsers;

        if (search != null && !search.trim().isEmpty()) {
            users = userRepository.adminSearchUsers(search.trim(), pageable);
            // For search results, we don't have exact total count from the query,
            // so we return the list size as an approximation
            totalUsers = users.size();
        } else {
            Page<User> userPage = userRepository.findAll(pageable);
            users = userPage.getContent();
            totalUsers = userPage.getTotalElements();
        }

        List<Map<String, Object>> userList = users.stream()
                .map(this::toUserMap)
                .collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("users", userList);
        result.put("totalUsers", totalUsers);
        result.put("page", page);
        result.put("size", size);
        return result;
    }

    /**
     * Get single user details with ride count and connection count.
     */
    public Map<String, Object> getUserDetail(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));

        Map<String, Object> detail = toUserMap(user);

        // Add ride count
        List<Ride> userRides = rideRepository.findByUserIdOrderByCreatedAtDesc(userId);
        detail.put("rideCount", userRides.size());

        // Add connection count
        List<Long> connectionIds = connectionRepository.findConnectedUserIds(userId);
        detail.put("connectionCount", connectionIds.size());

        return detail;
    }

    /**
     * Toggle user enabled/disabled status. Cannot disable own admin account.
     */
    @Transactional
    public Map<String, Object> updateUserStatus(Long userId, Boolean enabled, Long adminUserId) {
        if (userId.equals(adminUserId)) {
            throw ApiException.badRequest("You cannot disable your own admin account");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));

        user.setEnabled(enabled);
        userRepository.save(user);

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
        Pageable pageable = PageRequest.of(page, size);
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

        // Enrich rides with creator info
        List<Map<String, Object>> rideList = ridePage.getContent().stream()
                .map(this::toRideMap)
                .collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("rides", rideList);
        result.put("totalRides", ridePage.getTotalElements());
        result.put("page", page);
        result.put("size", size);
        result.put("totalPages", ridePage.getTotalPages());
        return result;
    }

    /**
     * Get single ride details with participant list and creator info.
     */
    public Map<String, Object> getRideDetail(Long rideId) {
        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> ApiException.notFound("Ride not found"));

        Map<String, Object> detail = toRideMap(ride);

        // Add participants for group rides
        if ("group".equals(ride.getRideType())) {
            List<RideParticipant> participants = rideParticipantRepository.findByRideId(rideId);
            List<Map<String, Object>> participantList = participants.stream().map(p -> {
                Map<String, Object> pMap = new LinkedHashMap<>();
                pMap.put("id", p.getId());
                pMap.put("userId", p.getUserId());
                pMap.put("role", p.getRole());
                pMap.put("status", p.getStatus());
                pMap.put("joinedAt", p.getJoinedAt());

                // Enrich with user info
                userRepository.findById(p.getUserId()).ifPresent(u -> {
                    pMap.put("username", u.getUsername());
                    pMap.put("email", u.getEmail());
                });

                return pMap;
            }).collect(Collectors.toList());

            detail.put("participants", participantList);
        }

        return detail;
    }

    // ── Private helpers ──────────────────────────────────────────────

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
     * Convert Ride entity to a map with creator info (no route coordinates
     * in list view to keep payloads small).
     */
    private Map<String, Object> toRideMap(Ride ride) {
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

        // Enrich with creator info
        userRepository.findById(ride.getUserId()).ifPresent(creator -> {
            map.put("creatorUsername", creator.getUsername());
            map.put("creatorEmail", creator.getEmail());
        });

        return map;
    }
}
