package vehicle.ridewise.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import vehicle.ridewise.dto.OrgDtos.ActivityDto;
import vehicle.ridewise.entity.OrgAuditLog;
import vehicle.ridewise.repository.OrgAuditLogRepository;
import vehicle.ridewise.repository.UserRepository;

import java.util.List;

// ============================================================
// OrgAuditService — writes and reads the organization activity log
// (see OrgAuditLog).
//
// record() never throws: failing to write a log line must not undo the
// action it describes.
// ============================================================
@Service
public class OrgAuditService {

    private static final Logger log = LoggerFactory.getLogger(OrgAuditService.class);
    private static final int MAX_SUMMARY = 300;

    private final OrgAuditLogRepository auditRepository;
    private final UserRepository userRepository;

    public OrgAuditService(OrgAuditLogRepository auditRepository, UserRepository userRepository) {
        this.auditRepository = auditRepository;
        this.userRepository = userRepository;
    }

    /**
     * @param actorUserId who did it — null for something the system did
     * @param action      short code, e.g. "vehicle.status"
     * @param summary     the sentence people read, e.g. "set BUS-01 to Repair"
     */
    public void record(Long orgId, Long actorUserId, String action, String summary) {
        if (orgId == null || summary == null) return;
        try {
            OrgAuditLog entry = new OrgAuditLog();
            entry.setOrgId(orgId);
            entry.setActorUserId(actorUserId);
            entry.setActorName(actorUserId == null ? "RideWise" : nameOf(actorUserId));
            entry.setAction(action);
            entry.setSummary(summary.length() > MAX_SUMMARY ? summary.substring(0, MAX_SUMMARY) : summary);
            auditRepository.save(entry);
        } catch (Exception e) {
            log.warn("Could not write the activity log of organization #{}: {}", orgId, e.getMessage());
        }
    }

    public List<ActivityDto> recent(Long orgId, int limit) {
        int size = Math.max(1, Math.min(limit, 100));
        return auditRepository.findByOrgIdOrderByCreatedAtDesc(orgId, PageRequest.of(0, size)).stream()
                .map(e -> new ActivityDto(e.getId(), e.getActorName(), e.getAction(), e.getSummary(), e.getCreatedAt()))
                .toList();
    }

    private String nameOf(Long userId) {
        return userRepository.findById(userId)
                .map(u -> u.getUsername() != null ? u.getUsername() : "A member")
                .orElse("A member");
    }
}
