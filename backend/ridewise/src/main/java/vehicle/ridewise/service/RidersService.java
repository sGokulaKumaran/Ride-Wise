package vehicle.ridewise.service;

import com.ridewise.dto.UserResponse;
import com.ridewise.entity.Connection;
import com.ridewise.entity.User;
import com.ridewise.repository.ConnectionRepository;
import com.ridewise.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class RidersService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ConnectionRepository connectionRepository;

    // Search riders by username/email
    public List<UserResponse> searchRiders(String query, Long currentUserId) {
        List<User> users = userRepository.searchUsers(query, currentUserId);
        return users.stream().map(this::toResponse).collect(Collectors.toList());
    }

    // Get nearby riders within 50km
    public List<UserResponse> getNearRiders(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Default location: Chennai (until user provides lat/lng)
        Double lat = user.getLat() != null ? user.getLat() : 13.0827;
        Double lng = user.getLng() != null ? user.getLng() : 80.2707;

        List<User> nearby = userRepository.findNearbyUsers(userId, lat, lng, 50.0);
        return nearby.stream().map(this::toResponse).collect(Collectors.toList());
    }

    // Get all connections (full user objects) for a user
    public List<UserResponse> getConnections(Long userId) {
        // Step 1: Get IDs of connected users
        List<Long> ids = connectionRepository.findConnectedUserIds(userId);

        // Step 2: Fetch full user objects for those IDs
        List<User> users = userRepository.findAllById(ids);
        return users.stream().map(this::toResponse).collect(Collectors.toList());
    }

    // Add a rider to connections
    public boolean addRider(Long userId, Long riderId) {
        if (connectionRepository.existsByUserIdAndConnectedUserId(userId, riderId)) {
            return false;  // Already connected
        }
        Connection conn = new Connection();
        conn.setUserId(userId);
        conn.setConnectedUserId(riderId);
        connectionRepository.save(conn);
        return true;
    }

    // Remove a rider from connections
    public boolean removeRider(Long userId, Long riderId) {
        if (!connectionRepository.existsByUserIdAndConnectedUserId(userId, riderId)) {
            return false;  // Not connected
        }
        connectionRepository.deleteByUserIdAndConnectedUserId(userId, riderId);
        return true;
    }

    private UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(), user.getEmail(), user.getUsername(),
                user.getMobile(), user.getAddress(),
                user.getLat(), user.getLng(), user.getCreatedAt()
        );
    }
}