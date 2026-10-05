package vehicle.ridewise.service;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.dto.RiderResponse;
import vehicle.ridewise.entity.Connection;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.repository.ConnectionRepository;
import vehicle.ridewise.repository.UserRepository;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

// ============================================================
// RidersService — finding riders and managing connections
//
// Other riders are always returned as RiderResponse, which carries no
// coordinates and no phone number, and shows the full email address only
// to riders who are already connected (see that class).
// ============================================================
@Service
public class RidersService {

    private static final double NEARBY_RADIUS_KM = 50.0;
    private static final int MAX_NEARBY = 50;
    private static final int MAX_QUERY_LENGTH = 60;

    private final UserRepository userRepository;
    private final ConnectionRepository connectionRepository;

    public RidersService(UserRepository userRepository, ConnectionRepository connectionRepository) {
        this.userRepository = userRepository;
        this.connectionRepository = connectionRepository;
    }

    // Search riders by username/email (top 20 — see UserRepository note)
    public List<RiderResponse> searchRiders(String query, Long currentUserId) {
        String q = query == null ? "" : query.trim();
        if (q.isEmpty()) return List.of();
        if (q.length() > MAX_QUERY_LENGTH) q = q.substring(0, MAX_QUERY_LENGTH);

        Set<Long> connected = connectedIds(currentUserId);
        return userRepository.searchUsers(escapeLike(q), currentUserId, PageRequest.of(0, 20))
                .stream()
                .map(other -> forViewer(other, null, connected))
                .collect(Collectors.toList());
    }

    // Riders the viewer is connected with see each other's email; everyone
    // else gets a hint only (see RiderResponse).
    private Set<Long> connectedIds(Long userId) {
        return new HashSet<>(connectionRepository.findConnectedUserIds(userId));
    }

    private static RiderResponse forViewer(User other, Double distanceKm, Set<Long> connected) {
        return connected.contains(other.getId())
                ? RiderResponse.from(other, distanceKm)
                : RiderResponse.forStranger(other, distanceKm);
    }

    // ── Riders within 50 km of MY saved location, nearest first ──
    //
    // The old version silently used Chennai when the rider had no saved
    // location — so everyone without one was shown "riders near you" from
    // a city they might be nowhere near. It now says what is missing, and
    // the app asks the rider to share their location first.
    //
    // Each result carries its distance (which the Riders screen has always
    // tried to show, but the API never sent).
    public List<RiderResponse> getNearRiders(Long userId) {
        User me = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));

        if (me.getLat() == null || me.getLng() == null) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "Share your location first to find riders near you");
        }

        double lat = me.getLat();
        double lng = me.getLng();
        Set<Long> connected = connectedIds(userId);
        return userRepository.findNearbyUsers(userId, lat, lng, NEARBY_RADIUS_KM).stream()
                .map(other -> forViewer(other, distanceKm(lat, lng, other.getLat(), other.getLng()), connected))
                .sorted(Comparator.comparingDouble(RiderResponse::getDistance))
                .limit(MAX_NEARBY)
                .collect(Collectors.toList());
    }

    // Everyone the rider is connected with, by name
    public List<RiderResponse> getConnections(Long userId) {
        List<Long> ids = connectionRepository.findConnectedUserIds(userId);
        return userRepository.findAllById(ids).stream()
                .sorted(Comparator.comparing(
                        (User u) -> u.getUsername() == null ? "" : u.getUsername(),
                        String.CASE_INSENSITIVE_ORDER))
                .map(RiderResponse::from)
                .collect(Collectors.toList());
    }

    // Add a rider to connections (bidirectional, deduplicated)
    @Transactional
    public boolean addRider(Long userId, Long riderId) {
        if (userId == null || riderId == null) {
            throw ApiException.badRequest("userId and riderId are required");
        }
        if (userId.equals(riderId)) {
            throw ApiException.badRequest("You cannot connect with yourself");
        }
        if (!userRepository.existsById(userId) || !userRepository.existsById(riderId)) {
            throw ApiException.notFound("User not found");
        }
        if (connectionRepository.existsByUserIdAndConnectedUserId(userId, riderId)) {
            return false; // Already connected
        }
        Connection conn = new Connection();
        conn.setUserId(userId);
        conn.setConnectedUserId(riderId);
        connectionRepository.save(conn);

        if (!connectionRepository.existsByUserIdAndConnectedUserId(riderId, userId)) {
            Connection reverseConn = new Connection();
            reverseConn.setUserId(riderId);
            reverseConn.setConnectedUserId(userId);
            connectionRepository.save(reverseConn);
        }
        return true;
    }

    // Remove a rider from connections (bidirectional)
    @Transactional
    public boolean removeRider(Long userId, Long riderId) {
        if (userId == null || riderId == null) {
            throw ApiException.badRequest("userId and riderId are required");
        }
        if (!connectionRepository.existsByUserIdAndConnectedUserId(userId, riderId)) {
            return false; // Not connected
        }
        connectionRepository.deleteByUserIdAndConnectedUserId(userId, riderId);
        // Also remove reverse connection for bidirectional consistency
        if (connectionRepository.existsByUserIdAndConnectedUserId(riderId, userId)) {
            connectionRepository.deleteByUserIdAndConnectedUserId(riderId, userId);
        }
        return true;
    }

    // "%" and "_" are wildcards in LIKE. Typed by a rider they must match
    // literally, or a search for "_" would list every account.
    private static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    // Great-circle distance in kilometres (Haversine)
    private static double distanceKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 6371.0 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
