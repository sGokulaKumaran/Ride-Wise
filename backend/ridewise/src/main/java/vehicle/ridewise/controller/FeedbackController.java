package vehicle.ridewise.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vehicle.ridewise.config.SessionAuthInterceptor;
import vehicle.ridewise.service.FeedbackService;

import java.util.List;
import java.util.Map;

/**
 * FeedbackController — user feedback / bug reporting + admin review & Gmail forwarding settings.
 *
 * USER ENDPOINTS (authenticated):
 *   POST   /api/feedback                  → Submit feedback or bug report
 *   GET    /api/feedback/mine             → Current user's submitted feedback & replies
 *
 * ADMIN ENDPOINTS (role=ADMIN):
 *   GET    /api/admin/feedback            → Paginated list (status, category, search, page, size)
 *   PATCH  /api/admin/feedback/{id}       → Update status ("OPEN"|"REVIEWED"|"RESOLVED") or adminReply
 *   DELETE /api/admin/feedback/{id}       → Delete feedback entry
 *   GET    /api/admin/feedback/settings   → Get forwarding Gmail setting
 *   PUT    /api/admin/feedback/settings   → Update forwarding Gmail setting
 */
@RestController
public class FeedbackController {

    private final FeedbackService feedbackService;

    public FeedbackController(FeedbackService feedbackService) {
        this.feedbackService = feedbackService;
    }

    // ── User endpoints ───────────────────────────────────────────────

    @PostMapping("/api/feedback")
    public ResponseEntity<Map<String, Object>> submitFeedback(
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        Long userId = SessionAuthInterceptor.requireUserId(request);
        return ResponseEntity.ok(feedbackService.submit(userId, body));
    }

    @GetMapping("/api/feedback/mine")
    public ResponseEntity<List<Map<String, Object>>> getMyFeedback(HttpServletRequest request) {
        Long userId = SessionAuthInterceptor.requireUserId(request);
        return ResponseEntity.ok(feedbackService.getMyFeedback(userId));
    }

    // ── Admin endpoints ──────────────────────────────────────────────

    @GetMapping("/api/admin/feedback")
    public ResponseEntity<Map<String, Object>> adminListFeedback(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        return ResponseEntity.ok(feedbackService.adminList(status, category, search, page, size));
    }

    @PatchMapping("/api/admin/feedback/{id}")
    public ResponseEntity<Map<String, Object>> adminUpdateFeedback(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        return ResponseEntity.ok(feedbackService.adminUpdate(id, body));
    }

    @DeleteMapping("/api/admin/feedback/{id}")
    public ResponseEntity<Void> adminDeleteFeedback(
            @PathVariable Long id,
            HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        feedbackService.adminDelete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/admin/feedback/settings")
    public ResponseEntity<Map<String, Object>> getAdminFeedbackSettings(HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        return ResponseEntity.ok(feedbackService.getAdminSettings());
    }

    @PutMapping("/api/admin/feedback/settings")
    public ResponseEntity<Map<String, Object>> updateAdminFeedbackSettings(
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        return ResponseEntity.ok(feedbackService.updateAdminSettings(body));
    }
}

