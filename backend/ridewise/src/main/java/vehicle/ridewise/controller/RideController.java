package vehicle.ridewise.controller; // Package declaration

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*; // Import web annotations
import org.springframework.http.ResponseEntity; // Import ResponseEntity
import vehicle.ridewise.config.SessionAuthInterceptor;
import vehicle.ridewise.service.RideService; // Import RideService
import vehicle.ridewise.service.LocationUpdateService; // Import LocationUpdateService
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
//   GET    /api/rides/user/{id}   → get all rides for a user
//   GET    /api/rides/user/{id}/active → get active rides for a user
//   PATCH  /api/rides/{id}/status → update ride status (active/completed)
//                                   body may include actualDistanceMeters
//   DELETE /api/rides/{id}        → permanently delete a ride
//   GET    /api/rides/{id}        → get a single ride by ID
//
//   POST   /api/rides/{id}/location  → record a GPS position fix
//   GET    /api/rides/{id}/location  → get full GPS track for a ride
// ============================================================
@RestController // Mark as REST controller (returns JSON by default)
@RequestMapping("/api/rides") // All endpoints start with /api/rides
public class RideController { // Define class
    private final RideService rideService; // Service for ride operations
    private final LocationUpdateService locationService; // Service for GPS tracking

    // Constructor injection — Spring wires both services automatically
    public RideController(RideService rideService, LocationUpdateService locationService) { // Constructor
        this.rideService      = rideService; // Assign ride service
        this.locationService  = locationService; // Assign location service
    } // End constructor

    // ── CREATE RIDE ──────────────────────────────────────────
    // POST /api/rides/
    // Body: RideRequest JSON
    // Returns: RideResponse JSON with generated id + createdAt
    @PostMapping({"", "/"}) // Post endpoint for creating rides
    public ResponseEntity<RideResponse> createRide(@RequestBody RideRequest request, HttpServletRequest httpRequest) { // Create ride handler
        request.setUserId(SessionAuthInterceptor.requireUserId(httpRequest)); // Session identity is authoritative
        RideResponse res = rideService.createRide(request); // Call service
        return ResponseEntity.ok(res); // Return 200 OK with body
    } // End handler

    // ── GET ALL RIDES FOR USER ───────────────────────────────
    // GET /api/rides/user/{userId}
    // Returns: List of RideResponse, newest first
    @GetMapping("/user/{userId}") // Get user rides endpoint
    public ResponseEntity<List<RideResponse>> getUserRides(@PathVariable Long userId, HttpServletRequest request) { // Get user rides handler
        Long currentUserId = SessionAuthInterceptor.requireUserId(request);
        if (!currentUserId.equals(userId)) throw vehicle.ridewise.exception.ApiException.forbidden("You can only view your own rides");
        return ResponseEntity.ok(rideService.getUserRides(currentUserId)); // Return 200 OK with list
    } // End handler

    // ── GET ACTIVE RIDES FOR USER ────────────────────────────
    // GET /api/rides/user/{userId}/active
    // Returns: List of active RideResponse (status = "active")
    @GetMapping("/user/{userId}/active") // Get active rides endpoint
    public ResponseEntity<List<RideResponse>> getActiveRides(@PathVariable Long userId, HttpServletRequest request) { // Get active rides handler
        Long currentUserId = SessionAuthInterceptor.requireUserId(request);
        if (!currentUserId.equals(userId)) throw vehicle.ridewise.exception.ApiException.forbidden("You can only view your own rides");
        return ResponseEntity.ok(rideService.getActiveRides(currentUserId)); // Return list
    } // End handler

    // ── UPDATE RIDE STATUS ───────────────────────────────────
    // PATCH /api/rides/{rideId}/status
    // Body: { "status": "completed" }
    // ── UPDATE RIDE STATUS ───────────────────────────────────
    // PATCH /api/rides/{rideId}/status
    // Body: { "status": "completed", "userId": "123" }  (userId optional)
    // For GROUP rides, ending (completed/cancelled) requires userId of the
    // active admin participant / ride owner. Omitting userId keeps legacy behavior.
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
    // DELETE /api/rides/{rideId}
    @DeleteMapping("/{rideId}") // Delete endpoint
    public ResponseEntity<Void> deleteRide(@PathVariable Long rideId, HttpServletRequest request) { // Delete ride handler
        rideService.deleteRide(rideId, SessionAuthInterceptor.requireUserId(request)); // Call service
        return ResponseEntity.noContent().build(); // Return 204 No Content
    } // End handler

    // ── GET SINGLE RIDE ──────────────────────────────────────
    // GET /api/rides/{rideId}
    @GetMapping("/{rideId}") // Get single ride endpoint
    public ResponseEntity<RideResponse> getRide(@PathVariable Long rideId, HttpServletRequest request) { // Get ride handler
        RideResponse res = rideService.getRide(rideId, SessionAuthInterceptor.requireUserId(request)); // Call service
        return ResponseEntity.ok(res); // Return ride
    } // End handler

    // ── RECORD GPS POSITION FIX ──────────────────────────────
    // POST /api/rides/{rideId}/location
    // Body: LocationUpdateRequest { lat, lng, timestamp }
    // Returns: LocationUpdateResponse with saved row id + server receivedAt
    //
    // Called by ActiveRideOverlay on every GPS tick while the ride is active.
    // Errors from this endpoint do NOT affect the frontend — the caller uses
    // a try/catch and continues silently if we return an error.
    @PostMapping("/{rideId}/location") // Save GPS position endpoint
    public ResponseEntity<LocationUpdateResponse> saveLocation(
            @PathVariable Long rideId,
            @RequestBody LocationUpdateRequest req,
            HttpServletRequest request) { // Save location handler
        req.setUserId(SessionAuthInterceptor.requireUserId(request)); // Session identity is authoritative
        LocationUpdateResponse res = locationService.saveLocation(rideId, req); // Delegate to service
        return ResponseEntity.ok(res); // Return 200 OK with saved row data
    } // End handler

    // ── GET GPS TRACK FOR A RIDE ─────────────────────────────
    // GET /api/rides/{rideId}/location
    // Returns: List of LocationUpdateResponse (newest first)
    //
    // Used by ride history to show the actual path driven on a map.
    @GetMapping("/{rideId}/location") // Get GPS track endpoint
    public ResponseEntity<List<LocationUpdateResponse>> getTrack(@PathVariable Long rideId, HttpServletRequest request) { // Get track handler
        List<LocationUpdateResponse> res = locationService.getTrack(rideId, SessionAuthInterceptor.requireUserId(request)); // Delegate to service
        return ResponseEntity.ok(res); // Return GPS track
    } // End handler
    
    // ── GROUP RIDE PARTICIPANTS ──────────────────────────────
    // GET /api/rides/{rideId}/participants → ACTIVE participants only (live map)
    @GetMapping("/{rideId}/participants")
    public ResponseEntity<List<vehicle.ridewise.dto.RideParticipantResponse>> getParticipants(@PathVariable Long rideId, HttpServletRequest request) {
        return ResponseEntity.ok(rideService.getParticipants(rideId, SessionAuthInterceptor.requireUserId(request)));
    }

    // POST /api/rides/{rideId}/participants
    // Body: { "adminId": "1", "userId": "2" }
    // Only the active group ride admin can add; the user must exist and be a
    // connected friend. Rejoins left participants; duplicates are rejected.
    @PostMapping("/{rideId}/participants")
    public ResponseEntity<vehicle.ridewise.dto.RideParticipantResponse> addParticipant(
            @PathVariable Long rideId, @RequestBody Map<String, String> body, HttpServletRequest request) {
        Long adminId = SessionAuthInterceptor.requireUserId(request);
        Long userId = parseLong(body.get("userId"));
        return ResponseEntity.ok(rideService.addParticipant(rideId, adminId, userId));
    }

    // PATCH /api/rides/{rideId}/participants/{userId}/status
    // Body: { "status": "left", "actorUserId": "2" }
    // A non-admin active participant leaves themself. Members cannot end the
    // ride via this route (admin uses PATCH /api/rides/{rideId}/status).
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
