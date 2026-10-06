package vehicle.ridewise.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.entity.OrgAnnouncement;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OrgAnnouncementRepository extends JpaRepository<OrgAnnouncement, Long> {

    List<OrgAnnouncement> findByOrgIdOrderByCreatedAtDesc(Long orgId, Pageable pageable);

    Optional<OrgAnnouncement> findByIdAndOrgId(Long id, Long orgId);

    long countByOrgIdAndCreatedAtAfter(Long orgId, LocalDateTime since);

    @Modifying
    @Transactional
    int deleteByCreatedAtBefore(LocalDateTime cutoff);
}
