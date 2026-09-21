package vehicle.ridewise.repository;

import vehicle.ridewise.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    // Find user by email (used during login) — case-insensitive
    Optional<User> findByEmailIgnoreCase(String email);

    // Check if email exists (used during signup) — case-insensitive
    boolean existsByEmailIgnoreCase(String email);

    // Username uniqueness checks (used during onboarding/profile edit)
    Optional<User> findByUsernameIgnoreCase(String username);

    // Search users by username OR email (for Add Rider search)
    // Excludes the current user so you don't find yourself
    @Query("SELECT u FROM User u WHERE u.id != :currentUserId AND " +
           "(LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<User> searchUsers(@Param("query") String query, @Param("currentUserId") Long currentUserId);

    // Find users within a lat/lng radius (for Near Riders)
    // Uses Haversine formula in SQL — 50 km radius
    @Query(value = "SELECT * FROM users WHERE id != :userId AND lat IS NOT NULL " +
                   "AND lng IS NOT NULL AND " +
                   "(6371 * acos(LEAST(GREATEST(cos(radians(:lat)) * cos(radians(lat)) * " +
                   "cos(radians(lng) - radians(:lng)) + sin(radians(:lat)) * " +
                   "sin(radians(lat)), -1.0), 1.0))) <= :radiusKm",
           nativeQuery = true)
    List<User> findNearbyUsers(@Param("userId") Long userId,
                               @Param("lat") Double lat,
                               @Param("lng") Double lng,
                               @Param("radiusKm") Double radiusKm);
}