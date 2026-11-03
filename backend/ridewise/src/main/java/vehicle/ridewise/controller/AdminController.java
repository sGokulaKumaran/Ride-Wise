package vehicle.ridewise.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vehicle.ridewise.config.SessionAuthInterceptor;
import vehicle.ridewise.dto.OrgDtos.AdminOrgPatch;
import vehicle.ridewise.dto.OrgDtos.PageDto;
import vehicle.ridewise.service.AdminService;
import vehicle.ridewise.service.OrganizationService;

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
 *   PATCH  /api/admin/users/{id}              → Edit user account (username, email, password, role, etc.)
 *   PATCH  /api/admin/users/{id}/status       → Enable/disable user
 *   DELETE /api/admin/users/{id}              → Permanently delete user account
 *   GET    /api/admin/rides?status=&type=&page=&size= → Paginated ride list
 *   GET    /api/admin/rides/{id}              → Single ride detail
 *   PATCH  /api/admin/rides/{id}/end          → Force-end an active ride
 *   DELETE /api/admin/rides/{id}              → Delete a single ride
 *   DELETE /api/admin/rides/cleanup?olderThanDays= → Bulk delete finished rides
 *   GET    /api/admin/organizations?search=&page=&size= → Paginated organization list
 *   PATCH  /api/admin/organizations/{id}      → Verify / suspend / restore / delete an organization
 *   DELETE /api/admin/organizations/{id}      → Delete an organization
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;
    private final OrganizationService organizationService;

    public AdminController(AdminService adminService, OrganizationService organizationService) {
        this.adminService = adminService;
        this.organizationService = organizationService;
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

    @PatchMapping("/users/{id}")
    public ResponseEntity<Map<String, Object>> updateUser(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        Long adminUserId = SessionAuthInterceptor.requireUserId(request);
        return ResponseEntity.ok(adminService.updateUser(id, body, adminUserId));
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

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(
            @PathVariable Long id,
            HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        Long adminUserId = SessionAuthInterceptor.requireUserId(request);
        adminService.deleteUser(id, adminUserId);
        return ResponseEntity.noContent().build();
    }

    // ── Ride Monitoring & Management ─────────────────────────────────

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

    @PatchMapping("/rides/{id}/end")
    public ResponseEntity<Map<String, Object>> endRide(
            @PathVariable Long id,
            HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        Long adminUserId = SessionAuthInterceptor.requireUserId(request);
        return ResponseEntity.ok(adminService.endRide(id, adminUserId));
    }

    @DeleteMapping("/rides/{id}")
    public ResponseEntity<Void> deleteRide(
            @PathVariable Long id,
            HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        Long adminUserId = SessionAuthInterceptor.requireUserId(request);
        adminService.deleteRide(id, adminUserId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/rides/cleanup")
    public ResponseEntity<Map<String, Object>> cleanupFinishedRides(
            @RequestParam(required = false) Integer olderThanDays,
            HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        return ResponseEntity.ok(adminService.cleanupFinishedRides(olderThanDays));
    }

    // ── Organizations ────────────────────────────────────────────────

    @GetMapping("/organizations")
    public ResponseEntity<PageDto<Map<String, Object>>> getOrganizations(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        return ResponseEntity.ok(organizationService.adminList(search, page, size));
    }

    // Body: { "verified": true|false } and/or { "status": "ACTIVE"|"SUSPENDED"|"DELETED" }
    @PatchMapping("/organizations/{id}")
    public ResponseEntity<Void> updateOrganization(
            @PathVariable Long id,
            @RequestBody AdminOrgPatch body,
            HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        Long adminUserId = SessionAuthInterceptor.requireUserId(request);
        organizationService.adminPatch(id, adminUserId, body);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/organizations/{id}")
    public ResponseEntity<Void> deleteOrganization(
            @PathVariable Long id,
            HttpServletRequest request) {
        SessionAuthInterceptor.requireAdminRole(request);
        Long adminUserId = SessionAuthInterceptor.requireUserId(request);
        organizationService.adminDelete(id, adminUserId);
        return ResponseEntity.noContent().build();
    }
}
