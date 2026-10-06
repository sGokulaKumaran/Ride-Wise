package vehicle.ridewise.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vehicle.ridewise.entity.Organization;

import java.util.List;
import java.util.Optional;

public interface OrganizationRepository extends JpaRepository<Organization, Long> {

    Optional<Organization> findByOrgCode(String orgCode);

    boolean existsByOrgCode(String orgCode);

    long countByOwnerUserIdAndStatusNot(Long ownerUserId, String status);

    long countByStatus(String status);

    // Public search by name — PUBLIC and ACTIVE only, verified first.
    // The caller escapes % and _ with a backslash, so they match literally.
    @Query("SELECT o FROM Organization o WHERE o.status = 'ACTIVE' AND o.visibility = 'PUBLIC' " +
           "AND LOWER(o.name) LIKE LOWER(CONCAT('%', :q, '%')) ESCAPE '\\' " +
           "ORDER BY o.verified DESC, o.name ASC")
    List<Organization> searchPublic(@Param("q") String query, Pageable pageable);

    // Platform admin: every organization that has not been deleted.
    Page<Organization> findByStatusNot(String status, Pageable pageable);

    @Query("SELECT o FROM Organization o WHERE o.status <> 'DELETED' AND " +
           "(LOWER(o.name) LIKE LOWER(CONCAT('%', :q, '%')) ESCAPE '\\' " +
           " OR LOWER(o.orgCode) LIKE LOWER(CONCAT('%', :q, '%')) ESCAPE '\\')")
    Page<Organization> adminSearch(@Param("q") String query, Pageable pageable);
}
