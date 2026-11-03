package vehicle.ridewise.repository;

import vehicle.ridewise.entity.User;
import org.springframework.data.domain.Page;
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

    // Search riders by username OR email (for the Riders page).
    // Excludes the current user, suspended accounts, riders who switched
    // "Public profile" off, and accounts that never finished signing up
    // (no username yet — there is nobody to ride with behind them).
    // Top-20: search-as-you-type must stay cheap even with thousands of
    // users (the UI only ever renders a short list anyway).
    // NOTE: LIMIT is intentionally NOT in the JPQL string — HQL supports
    // LIMIT only on newer Hibernate versions and breaks on others, so the
    // cap is applied via Pageable (see RidersService.searchRiders).
    // The caller escapes % and _ in :query with a backslash (ESCAPE '\'),
    // so they are matched literally.
    @Query("SELECT u FROM User u WHERE u.id <> :currentUserId " +
           "AND u.username IS NOT NULL " +
           "AND (u.enabled IS NULL OR u.enabled = true) " +
           "AND (u.profilePublic IS NULL OR u.profilePublic = true) AND " +
           "(LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) ESCAPE '\\' OR " +
           "LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%')) ESCAPE '\\') " +
           "ORDER BY u.id DESC")
    List<User> searchUsers(@Param("query") String query, @Param("currentUserId") Long currentUserId, Pageable pageable);

    // Riders within a radius of a point (for "near me").
    // Haversine formula in SQL. Suspended accounts, riders who switched
    // "Public profile" off and accounts without a username are left out.
    @Query(value = "SELECT * FROM users WHERE id <> :userId AND lat IS NOT NULL " +
                   "AND lng IS NOT NULL AND username IS NOT NULL " +
                   "AND (enabled IS NULL OR enabled = true) " +
                   "AND (profile_public IS NULL OR profile_public = true) AND " +
                   "(6371 * acos(LEAST(GREATEST(cos(radians(:lat)) * cos(radians(lat)) * " +
                   "cos(radians(lng) - radians(:lng)) + sin(radians(:lat)) * " +
                   "sin(radians(lat)), -1.0), 1.0))) <= :radiusKm",
           nativeQuery = true)
    List<User> findNearbyUsers(@Param("userId") Long userId,
                               @Param("lat") Double lat,
                               @Param("lng") Double lng,
                               @Param("radiusKm") Double radiusKm);

    // ── Admin & Cleanup queries ──

    // Check if any admin account exists (used by DataInitializer)
    List<User> findByRole(String role);

    // Users who configured automatic ride deletion (autoDeleteRidesDays > 0)
    List<User> findByAutoDeleteRidesDaysGreaterThan(Integer minDays);

    // Admin user search — all users by username or email, as a real page
    // (so the total count and "next page" work for search results too).
    // Sorting comes from the Pageable.
    @Query("SELECT u FROM User u WHERE " +
           "LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%'))")
    Page<User> adminSearchUsers(@Param("query") String query, Pageable pageable);
}
