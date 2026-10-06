package vehicle.ridewise.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.entity.OrgAccess;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OrgAccessRepository extends JpaRepository<OrgAccess, Long> {

    Optional<OrgAccess> findByUserIdAndOrgId(Long userId, Long orgId);

    boolean existsByUserIdAndOrgId(Long userId, Long orgId);

    // Which of these organizations are on this person's list (one query for a whole page of cards)
    @Query("SELECT a.orgId FROM OrgAccess a WHERE a.userId = :userId AND a.orgId IN :orgIds")
    List<Long> findSavedOrgIds(@Param("userId") Long userId, @Param("orgIds") Collection<Long> orgIds);

    List<OrgAccess> findByUserIdOrderByLastAccessedAtDesc(Long userId, Pageable pageable);

    Page<OrgAccess> findByOrgIdOrderByGrantedAtDesc(Long orgId, Pageable pageable);

    long countByOrgId(Long orgId);

    long countByUserId(Long userId);

    // Everyone who has the organization on their list — the audience of
    // an announcement (capped by the caller).
    @Query("SELECT a.userId FROM OrgAccess a WHERE a.orgId = :orgId")
    List<Long> findUserIdsByOrgId(@Param("orgId") Long orgId, Pageable pageable);

    @Modifying
    @Transactional
    long deleteByUserIdAndOrgId(Long userId, Long orgId);

    // "Reset the password and make everyone enter the new one"
    @Modifying
    @Transactional
    @Query("DELETE FROM OrgAccess a WHERE a.orgId = :orgId")
    int deleteAllForOrg(@Param("orgId") Long orgId);
}
