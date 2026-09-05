package vehicle.ridewise.controller; // Package declaration

import org.springframework.web.bind.annotation.*; // Import web annotations
import org.springframework.http.ResponseEntity; // Import ResponseEntity
import vehicle.ridewise.service.RideService; // Import RideService
import vehicle.ridewise.service.LocationUpdateService; // Import LocationUpdateService
import vehicle.ridewise.dto.RideRequest; // Import RideRequest dto
import vehicle.ridewise.dto.RideResponse; // Import RideResponse dto
import vehicle.ridewise.dto.LocationUpdateRequest; // Import LocationUpdateRequest
import vehicle.ridewise.dto.LocationUpdateResponse; // Import LocationUpdateResponse
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
//   DELETE /api/rides/{id}        → permanently delete a ride
//   GET    /api/rides/{id}        → get a single ride by ID
//
//   POST   /api/rides/{id}/location  → record a GPS position fix
//   GET    /api/rides/{id}/location  → get full GPS track for a ride
// ============================================================
@RestController // Mark as REST controller (returns JSON by default)
@RequestMapping("/api/rides") // All endpoints start with /api/rides
@CrossOrigin("*") // Allow CORS from any origin (dev convenience; restrict in production)
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
    @PostMapping("/") // Post endpoint for creating rides
    public ResponseEntity<RideResponse> createRide(@RequestBody RideRequest request) { // Create ride handler
        RideResponse res = rideService.createRide(request); // Call service
        return ResponseEntity.ok(res); // Return 200 OK with body
    } // End handler

    // ── GET ALL RIDES FOR USER ───────────────────────────────
    // GET /api/rides/user/{userId}
    // Returns: List of RideResponse, newest first
    @GetMapping("/user/{userId}") // Get user rides endpoint
    public ResponseEntity<List<RideResponse>> getUserRides(@PathVariable Long userId) { // Get user rides handler
        List<RideResponse> res = rideService.getUserRides(userId); // Call service
        return ResponseEntity.ok(res); // Return 200 OK with list
    } // End handler

    // ── GET ACTIVE RIDES FOR USER ────────────────────────────
    // GET /api/rides/user/{userId}/active
    // Returns: List of active RideResponse (status = "active")
    @GetMapping("/user/{userId}/active") // Get active rides endpoint
    public ResponseEntity<List<RideResponse>> getActiveRides(@PathVariable Long userId) { // Get active rides handler
        List<RideResponse> res = rideService.getActiveRides(userId); // Call service
        return ResponseEntity.ok(res); // Return list
    } // End handler

    // ── UPDATE RIDE STATUS ───────────────────────────────────
    // PATCH /api/rides/{rideId}/status
    // Body: { "status": "completed" }
    @PatchMapping("/{rideId}/status") // Patch status endpoint
    public ResponseEntity<RideResponse> updateStatus(
            @PathVariable Long rideId,
            @RequestBody Map<String, String> body) { // Update status handler
        String status = body.get("status"); // Extract status from body
        RideResponse res = rideService.updateStatus(rideId, status); // Call service
        return ResponseEntity.ok(res); // Return updated ride
    } // End handler

    // ── DELETE RIDE ──────────────────────────────────────────
    // DELETE /api/rides/{rideId}
    @DeleteMapping("/{rideId}") // Delete endpoint
    public ResponseEntity<Void> deleteRide(@PathVariable Long rideId) { // Delete ride handler
        rideService.deleteRide(rideId); // Call service
        return ResponseEntity.noContent().build(); // Return 204 No Content
    } // End handler

    // ── GET SINGLE RIDE ──────────────────────────────────────
    // GET /api/rides/{rideId}
    @GetMapping("/{rideId}") // Get single ride endpoint
    public ResponseEntity<RideResponse> getRide(@PathVariable Long rideId) { // Get ride handler
        RideResponse res = rideService.getRide(rideId); // Call service
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
            @RequestBody LocationUpdateRequest req) { // Save location handler
        LocationUpdateResponse res = locationService.saveLocation(rideId, req); // Delegate to service
        return ResponseEntity.ok(res); // Return 200 OK with saved row data
    } // End handler

    // ── GET GPS TRACK FOR A RIDE ─────────────────────────────
    // GET /api/rides/{rideId}/location
    // Returns: List of LocationUpdateResponse (newest first)
    //
    // Used by ride history to show the actual path driven on a map.
    @GetMapping("/{rideId}/location") // Get GPS track endpoint
    public ResponseEntity<List<LocationUpdateResponse>> getTrack(@PathVariable Long rideId) { // Get track handler
        List<LocationUpdateResponse> res = locationService.getTrack(rideId); // Delegate to service
        return ResponseEntity.ok(res); // Return GPS track
    } // End handler
} // End of class
