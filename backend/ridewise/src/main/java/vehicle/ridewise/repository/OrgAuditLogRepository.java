package vehicle.ridewise.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.entity.OrgAuditLog;

import java.time.LocalDateTime;
import java.util.List;

public interface OrgAuditLogRepository extends JpaRepository<OrgAuditLog, Long> {

    List<OrgAuditLog> findByOrgIdOrderByCreatedAtDesc(Long orgId, Pageable pageable);

    @Modifying
    @Transactional
    int deleteByCreatedAtBefore(LocalDateTime cutoff);
}
