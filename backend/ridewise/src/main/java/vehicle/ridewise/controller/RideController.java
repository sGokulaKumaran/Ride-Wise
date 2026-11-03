package vehicle.ridewise.controller; // Package declaration

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*; // Import web annotations
import org.springframework.http.ResponseEntity; // Import ResponseEntity
import vehicle.ridewise.config.SessionAuthInterceptor;
import vehicle.ridewise.service.RideService; // Import RideService
import vehicle.ridewise.service.LocationUpdateService; // Import LocationUpdateService
import vehicle.ridewise.service.UserLocationService; // Import UserLocationService
import vehicle.ridewise.dto.LiveLocationResponse; // Import LiveLocationResponse dto
import vehicle.ridewise.dto.RideRequest; // Import RideRequest dto
import vehicle.ridewise.dto.RideResponse; // Import RideResponse dto
import vehicle.ridewise.dto.LocationUpdateRequest; // Import LocationUpdateRequest
import vehicle.ridewise.dto.LocationUpdateResponse; // Import LocationUpdateResponse
import vehicle.ridewise.dto.RideStatusRequest; // Import RideStatusRequest dto
import java.util.List; // Import List
import java.util.Map; // Import Map

// ============================================================
// RideController — REST endpoints for ride management
//
// BASE PATH: /api/rides
//
// Endpoints:
//   POST   /api/rides/            → create a new ride
//   GET    /api/rides/user/{id}   → get all rides for a user (?summary=true: without routes)
//   GET    /api/rides/user/{id}/active → get active rides for a user
//   DELETE /api/rides/user/{id}/finished → clear all completed/cancelled rides for a user
//   PATCH  /api/rides/{id}/status → update ride status (active/completed)
//                                   body may include actualDistanceMeters
//   DELETE /api/rides/{id}        → permanently delete a ride (or remove finished group ride from history)
//   GET    /api/rides/{id}        → get a single ride by ID
//
//   POST   /api/rides/{id}/location  → record a GPS position fix
//   GET    /api/rides/{id}/location  → get full GPS track for a ride
//   GET    /api/rides/{id}/live-locations   → current member positions (group)
//   DELETE /api/rides/{id}/live-location    → stop sharing my live position
// ============================================================
@RestController // Mark as REST controller (returns JSON by default)
@RequestMapping("/api/rides") // All endpoints start with /api/rides
public class RideController { // Define class
    private final RideService rideService; // Service for ride operations
    private final LocationUpdateService locationService; // Service for GPS tracking history
    private final UserLocationService userLocationService; // Service for LIVE latest locations

    // Constructor injection — Spring wires all services automatically
    public RideController(RideService rideService,
                          LocationUpdateService locationService,
                          UserLocationService userLocationService) { // Constructor
        this.rideService         = rideService; // Assign ride service
        this.locationService     = locationService; // Assign location history service
        this.userLocationService = userLocationService; // Assign live location service
    } // End constructor

    // ── CREATE RIDE ──────────────────────────────────────────
    @PostMapping({"", "/"}) // Post endpoint for creating rides
    public ResponseEntity<RideResponse> createRide(@RequestBody RideRequest request, HttpServletRequest httpRequest) { // Create ride handler
        request.setUserId(SessionAuthInterceptor.requireUserId(httpRequest)); // Session identity is authoritative
        RideResponse res = rideService.createRide(request); // Call service
        return ResponseEntity.ok(res); // Return 200 OK with body
    } // End handler

    // ── GET ALL RIDES FOR USER ───────────────────────────────
    @GetMapping("/user/{userId}") // Get user rides endpoint
    public ResponseEntity<List<RideResponse>> getUserRides(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "false") boolean summary,
            HttpServletRequest request) { // Get user rides handler
        Long currentUserId = SessionAuthInterceptor.requireUserId(request);
        if (!currentUserId.equals(userId)) throw vehicle.ridewise.exception.ApiException.forbidden("You can only view your own rides");
        rideService.purgeExpiredRidesIfConfigured(currentUserId);
        return ResponseEntity.ok(rideService.getUserRides(currentUserId, summary)); // Return 200 OK with list
    } // End handler

    // ── GET ACTIVE RIDES FOR USER ────────────────────────────
    @GetMapping("/user/{userId}/active") // Get active rides endpoint
    public ResponseEntity<List<RideResponse>> getActiveRides(@PathVariable Long userId, HttpServletRequest request) { // Get active rides handler
        Long currentUserId = SessionAuthInterceptor.requireUserId(request);
        if (!currentUserId.equals(userId)) throw vehicle.ridewise.exception.ApiException.forbidden("You can only view your own rides");
        return ResponseEntity.ok(rideService.getActiveRides(currentUserId)); // Return list
    } // End handler

    // ── CLEAR ALL FINISHED RIDES FOR USER ────────────────────
    @DeleteMapping("/user/{userId}/finished")
    public ResponseEntity<Map<String, Object>> clearFinishedRides(@PathVariable Long userId, HttpServletRequest request) {
        Long currentUserId = SessionAuthInterceptor.requireUserId(request);
        if (!currentUserId.equals(userId)) throw vehicle.ridewise.exception.ApiException.forbidden("You can only clear your own rides");
        int deletedCount = rideService.clearFinishedRidesForUser(currentUserId);
        return ResponseEntity.ok(Map.of(
                "deletedCount", deletedCount,
                "message", deletedCount == 0
                        ? "No finished rides to clear."
                        : "Cleared " + deletedCount + " finished ride" + (deletedCount == 1 ? "" : "s") + "."
        ));
    }

    // ── UPDATE RIDE STATUS ───────────────────────────────────
    @PatchMapping("/{rideId}/status") // Patch status endpoint
    public ResponseEntity<RideResponse> updateStatus(
            @PathVariable Long rideId,
            @RequestBody RideStatusRequest body,
            HttpServletRequest request) { // Update status handler
        RideResponse res = rideService.updateStatus(
                rideId,
                body.getStatus(),                            // "completed" / "cancelled"
                SessionAuthInterceptor.requireUserId(request), // session identity (authoritative)
                body.getActualDistanceMeters());             // real travelled distance (may be null)
        return ResponseEntity.ok(res); // Return updated ride
    } // End handler

    // ── DELETE RIDE ──────────────────────────────────────────
    @DeleteMapping("/{rideId}") // Delete endpoint
    public ResponseEntity<Void> deleteRide(@PathVariable Long rideId, HttpServletRequest request) { // Delete ride handler
        rideService.deleteRide(rideId, SessionAuthInterceptor.requireUserId(request)); // Call service
        return ResponseEntity.noContent().build(); // Return 204 No Content
    } // End handler

    // ── GET SINGLE RIDE ──────────────────────────────────────
    @GetMapping("/{rideId}") // Get single ride endpoint
    public ResponseEntity<RideResponse> getRide(
            @PathVariable Long rideId,
            @RequestParam(defaultValue = "false") boolean summary,
            HttpServletRequest request) { // Get ride handler
        RideResponse res = rideService.getRide(rideId, SessionAuthInterceptor.requireUserId(request), summary); // Call service
        return ResponseEntity.ok(res); // Return ride
    } // End handler

    // ── RECORD GPS POSITION FIX ──────────────────────────────
    @PostMapping("/{rideId}/location") // Save GPS position endpoint
    public ResponseEntity<LocationUpdateResponse> saveLocation(
            @PathVariable Long rideId,
            @RequestBody LocationUpdateRequest req,
            HttpServletRequest request) { // Save location handler
        req.setUserId(SessionAuthInterceptor.requireUserId(request)); // Session identity is authoritative
        LocationUpdateResponse res = locationService.saveLocation(rideId, req); // Save history row

        // ALSO update the single latest-location row and broadcast it to the
        // group ride. This keeps the REST path (used as a WS fallback) from
        // producing a second, divergent location system.
        userLocationService.updateLocation(
                rideId, req.getUserId(), req.getLat(), req.getLng(), req.getAccuracy());

        return ResponseEntity.ok(res); // Return 200 OK with saved row data
    } // End handler

    // ── GET LIVE LOCATIONS FOR A RIDE ────────────────────────
    @GetMapping("/{rideId}/live-locations")
    public ResponseEntity<List<LiveLocationResponse>> getLiveLocations(
            @PathVariable Long rideId, HttpServletRequest request) {
        return ResponseEntity.ok(
                userLocationService.getLiveLocations(rideId, SessionAuthInterceptor.requireUserId(request)));
    }

    // ── STOP SHARING MY LIVE LOCATION ────────────────────────
    @DeleteMapping("/{rideId}/live-location")
    public ResponseEntity<Void> clearLiveLocation(@PathVariable Long rideId, HttpServletRequest request) {
        userLocationService.clearLocation(rideId, SessionAuthInterceptor.requireUserId(request));
        return ResponseEntity.noContent().build(); // 204
    }

    // ── GET GPS TRACK FOR A RIDE ─────────────────────────────
    @GetMapping("/{rideId}/location") // Get GPS track endpoint
    public ResponseEntity<List<LocationUpdateResponse>> getTrack(@PathVariable Long rideId, HttpServletRequest request) { // Get track handler
        List<LocationUpdateResponse> res = locationService.getTrack(rideId, SessionAuthInterceptor.requireUserId(request)); // Delegate to service
        return ResponseEntity.ok(res); // Return GPS track
    } // End handler
    
    // ── GROUP RIDE PARTICIPANTS ──────────────────────────────
    @GetMapping("/{rideId}/participants")
    public ResponseEntity<List<vehicle.ridewise.dto.RideParticipantResponse>> getParticipants(@PathVariable Long rideId, HttpServletRequest request) {
        return ResponseEntity.ok(rideService.getParticipants(rideId, SessionAuthInterceptor.requireUserId(request)));
    }

    @PostMapping("/{rideId}/participants")
    public ResponseEntity<vehicle.ridewise.dto.RideParticipantResponse> addParticipant(
            @PathVariable Long rideId, @RequestBody Map<String, String> body, HttpServletRequest request) {
        Long adminId = SessionAuthInterceptor.requireUserId(request);
        Long userId = parseLong(body.get("userId"));
        return ResponseEntity.ok(rideService.addParticipant(rideId, adminId, userId));
    }

    @PatchMapping("/{rideId}/participants/{userId}/status")
    public ResponseEntity<Map<String, Object>> updateParticipantStatus(
        @PathVariable Long rideId, @PathVariable Long userId, @RequestBody Map<String, String> body, HttpServletRequest request) {
        String status = body.get("status");
        Long actorUserId = SessionAuthInterceptor.requireUserId(request);
        rideService.updateParticipantStatus(rideId, userId, status, actorUserId);
        return ResponseEntity.ok(Map.of("success", true));
    }

    // Safely parse a nullable string ID (accepts null/blank without failing)
    private static Long parseLong(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException ex) {
            throw vehicle.ridewise.exception.ApiException.badRequest("Invalid numeric id: " + value);
        }
    }
} // End of class
