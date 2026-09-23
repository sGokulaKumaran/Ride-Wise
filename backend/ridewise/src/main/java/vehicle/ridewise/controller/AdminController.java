package vehicle.ridewise.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vehicle.ridewise.config.SessionAuthInterceptor;
import vehicle.ridewise.service.AdminService;

import java.util.Map;

/**
 * AdminController — REST endpoints for platform administration.
 *
 * Every endpoint calls SessionAuthInterceptor.requireAdminRole(request) as its
 * first operation. This enforces that only authenticated users with role=ADMIN
 * can access these endpoints. Normal users receive 403 Forbidden.
 *
 * ENDPOINT MAP:
 *   GET    /api/admin/dashboard               → Dashboard stats
 *   GET    /api/admin/users?search=&page=&size= → Paginated user list
 *   GET    /api/admin/users/{id}              → Single user detail
 *   PATCH  /api/admin/users/{id}/status       → Enable/disable user
 *   GET    /api/admin/rides?status=&type=&page=&size= → Paginated ride list
 *   GET    /api/admin/rides/{id}              → Single ride detail
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    // ── Dashboard ────────────────────────────────────────────────────

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboard(HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        return ResponseEntity.ok(adminService.getDashboardStats());
    }

    // ── User Management ──────────────────────────────────────────────

    @GetMapping("/users")
    public ResponseEntity<Map<String, Object>> getUsers(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        return ResponseEntity.ok(adminService.getUsers(search, page, size));
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<Map<String, Object>> getUserDetail(
            @PathVariable Long id,
            HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        return ResponseEntity.ok(adminService.getUserDetail(id));
    }

    @PatchMapping("/users/{id}/status")
    public ResponseEntity<Map<String, Object>> updateUserStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        Long adminUserId = SessionAuthInterceptor.requireUserId(request);

        Object enabledValue = body.get("enabled");
        if (!(enabledValue instanceof Boolean)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "Field 'enabled' (boolean) is required"
            ));
        }

        return ResponseEntity.ok(adminService.updateUserStatus(id, (Boolean) enabledValue, adminUserId));
    }

    // ── Ride Monitoring ──────────────────────────────────────────────

    @GetMapping("/rides")
    public ResponseEntity<Map<String, Object>> getRides(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        return ResponseEntity.ok(adminService.getRides(status, type, page, size));
    }

    @GetMapping("/rides/{id}")
    public ResponseEntity<Map<String, Object>> getRideDetail(
            @PathVariable Long id,
            HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        return ResponseEntity.ok(adminService.getRideDetail(id));
    }
}
