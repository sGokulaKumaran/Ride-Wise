package vehicle.ridewise.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.entity.OrgMember;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OrgMemberRepository extends JpaRepository<OrgMember, Long> {

    Optional<OrgMember> findByOrgIdAndUserId(Long orgId, Long userId);

    Optional<OrgMember> findByIdAndOrgId(Long id, Long orgId);

    // Everything one person belongs to (or is invited to)
    List<OrgMember> findByUserIdAndStatusIn(Long userId, Collection<String> statuses);

    // People of one organization, by status
    List<OrgMember> findByOrgIdAndStatusInOrderByIdAsc(Long orgId, Collection<String> statuses, Pageable pageable);

    List<OrgMember> findByOrgIdAndStatusAndRoleIn(Long orgId, String status, Collection<String> roles);

    long countByOrgIdAndStatus(Long orgId, String status);

    long countByOrgIdAndStatusAndRoleIn(Long orgId, String status, Collection<String> roles);

    // User ids of the active members — the audience of an announcement
    @Query("SELECT m.userId FROM OrgMember m WHERE m.orgId = :orgId AND m.status = 'ACTIVE'")
    List<Long> findActiveUserIds(@Param("orgId") Long orgId, Pageable pageable);

    // Member counts for a set of organizations: [orgId, count]
    @Query("SELECT m.orgId, COUNT(m) FROM OrgMember m WHERE m.orgId IN :orgIds AND m.status = 'ACTIVE' GROUP BY m.orgId")
    List<Object[]> countActiveByOrgIds(@Param("orgIds") Collection<Long> orgIds);

    // ── Account deletion: memberships and invitations of the person ──
    @Modifying
    @Transactional
    long deleteByUserId(Long userId);
}
