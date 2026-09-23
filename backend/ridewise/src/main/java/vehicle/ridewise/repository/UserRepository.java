package vehicle.ridewise.repository;

import vehicle.ridewise.entity.User;
import org.springframework.data.domain.Pageable;
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
    // Excludes the current user so you don't find yourself.
    // Top-20: search-as-you-type must stay cheap even with thousands of
    // users (the UI only ever renders a short list anyway).
    // NOTE: LIMIT is intentionally NOT in the JPQL string — HQL supports
    // LIMIT only on newer Hibernate versions and breaks on others, so the
    // cap is applied via Pageable (see RidersService.searchRiders).
    @Query("SELECT u FROM User u WHERE u.id != :currentUserId AND " +
           "(LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%'))) " +
           "ORDER BY u.id DESC")
    List<User> searchUsers(@Param("query") String query, @Param("currentUserId") Long currentUserId, Pageable pageable);

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

    // ── Admin queries ──

    // Check if any admin account exists (used by DataInitializer)
    List<User> findByRole(String role);

    // Admin user search — search all users by username or email (no self-exclusion)
    @Query("SELECT u FROM User u WHERE " +
           "LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "ORDER BY u.id DESC")
    List<User> adminSearchUsers(@Param("query") String query, Pageable pageable);
}