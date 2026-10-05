package vehicle.ridewise.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vehicle.ridewise.config.SessionAuthInterceptor;
import vehicle.ridewise.dto.RiderResponse;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.service.RidersService;

import java.util.List;
import java.util.Map;

// ============================================================
// RidersController — /api/riders
//
//   GET   /search?query=       riders matching a username / email
//   GET   /nearby              riders within 50 km of my saved location
//                              (saved with PATCH /api/auth/profile/{id} { lat, lng })
//   GET   /connections         riders I am connected with
//   POST  /add    { riderId }  connect
//   POST  /remove { riderId }  disconnect
//
// The acting user ALWAYS comes from the session. A `userId` sent by an
// older client is still accepted, but only if it matches the session.
// ============================================================
@RestController
@RequestMapping("/api/riders")
public class RidersController {

    private final RidersService ridersService;

    public RidersController(RidersService ridersService) {
        this.ridersService = ridersService;
    }

    @GetMapping("/search")
    public ResponseEntity<List<RiderResponse>> search(
            @RequestParam String query,
            @RequestParam(required = false) Long userId,
            HttpServletRequest request) {
        Long currentUserId = SessionAuthInterceptor.requireUserId(request);
        assertRequestedUserMatches(currentUserId, userId);
        return ResponseEntity.ok(ridersService.searchRiders(query, currentUserId));
    }

    @GetMapping("/nearby")
    public ResponseEntity<List<RiderResponse>> nearby(
            @RequestParam(required = false) Long userId,
            HttpServletRequest request) {
        Long currentUserId = SessionAuthInterceptor.requireUserId(request);
        assertRequestedUserMatches(currentUserId, userId);
        return ResponseEntity.ok(ridersService.getNearRiders(currentUserId));
    }

    @GetMapping("/connections")
    public ResponseEntity<List<RiderResponse>> connections(
            @RequestParam(required = false) Long userId,
            HttpServletRequest request) {
        Long currentUserId = SessionAuthInterceptor.requireUserId(request);
        assertRequestedUserMatches(currentUserId, userId);
        return ResponseEntity.ok(ridersService.getConnections(currentUserId));
    }

    @PostMapping("/add")
    public ResponseEntity<Map<String, Object>> addRider(
            @RequestBody Map<String, Long> body,
            HttpServletRequest request) {
        Long currentUserId = SessionAuthInterceptor.requireUserId(request);
        assertRequestedUserMatches(currentUserId, body.get("userId"));
        boolean success = ridersService.addRider(currentUserId, body.get("riderId"));
        return ResponseEntity.ok(Map.of("success", success));
    }

    @PostMapping("/remove")
    public ResponseEntity<Map<String, Object>> removeRider(
            @RequestBody Map<String, Long> body,
            HttpServletRequest request) {
        Long currentUserId = SessionAuthInterceptor.requireUserId(request);
        assertRequestedUserMatches(currentUserId, body.get("userId"));
        boolean success = ridersService.removeRider(currentUserId, body.get("riderId"));
        return ResponseEntity.ok(Map.of("success", success));
    }

    private void assertRequestedUserMatches(Long currentUserId, Long requestedUserId) {
        if (requestedUserId != null && !currentUserId.equals(requestedUserId)) {
            throw ApiException.forbidden("You can only access your own rider data");
        }
    }
}
