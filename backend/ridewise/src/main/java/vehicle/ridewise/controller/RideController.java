package vehicle.ridewise.controller; // Package declaration

import org.springframework.web.bind.annotation.*; // Import web annotations
import org.springframework.http.ResponseEntity; // Import ResponseEntity
import vehicle.ridewise.service.RideService; // Import RideService
import vehicle.ridewise.dto.RideRequest; // Import RideRequest dto
import vehicle.ridewise.dto.RideResponse; // Import RideResponse dto
import java.util.List; // Import List
import java.util.Map; // Import Map

@RestController // Mark as REST controller
@RequestMapping("/api/rides") // Set base path
@CrossOrigin("*") // Enable CORS
public class RideController { // Define class

    private final RideService rideService; // Service instance

    public RideController(RideService rideService) { // Constructor injection
        this.rideService = rideService; // Assign service
    } // End constructor

    @PostMapping("/") // Post endpoint
    public ResponseEntity<RideResponse> createRide(@RequestBody RideRequest request) { // Create ride handler
        RideResponse res = rideService.createRide(request); // Call service
        return ResponseEntity.ok(res); // Return response
    } // End handler

    @GetMapping("/user/{userId}") // Get user rides endpoint
    public ResponseEntity<List<RideResponse>> getUserRides(@PathVariable Long userId) { // Get user rides handler
        List<RideResponse> res = rideService.getUserRides(userId); // Call service
        return ResponseEntity.ok(res); // Return response
    } // End handler

    @GetMapping("/user/{userId}/active") // Get active rides endpoint
    public ResponseEntity<List<RideResponse>> getActiveRides(@PathVariable Long userId) { // Get active rides handler
        List<RideResponse> res = rideService.getActiveRides(userId); // Call service
        return ResponseEntity.ok(res); // Return response
    } // End handler

    @PatchMapping("/{rideId}/status") // Patch status endpoint
    public ResponseEntity<RideResponse> updateStatus(@PathVariable Long rideId, @RequestBody Map<String, String> body) { // Update status handler
        String status = body.get("status"); // Extract status
        RideResponse res = rideService.updateStatus(rideId, status); // Call service
        return ResponseEntity.ok(res); // Return response
    } // End handler

    @DeleteMapping("/{rideId}") // Delete endpoint
    public ResponseEntity<Void> deleteRide(@PathVariable Long rideId) { // Delete ride handler
        rideService.deleteRide(rideId); // Call service
        return ResponseEntity.noContent().build(); // Return empty response
    } // End handler

    @GetMapping("/{rideId}") // Get single ride endpoint
    public ResponseEntity<RideResponse> getRide(@PathVariable Long rideId) { // Get ride handler
        RideResponse res = rideService.getRide(rideId); // Call service
        return ResponseEntity.ok(res); // Return response
    } // End handler
} // End of class
