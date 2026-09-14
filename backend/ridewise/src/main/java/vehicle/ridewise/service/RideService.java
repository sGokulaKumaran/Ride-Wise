package vehicle.ridewise.service; // Package declaration

import org.springframework.stereotype.Service; // Import Service annotation
import vehicle.ridewise.repository.RideRepository; // Import RideRepository
import vehicle.ridewise.entity.Ride; // Import Ride entity
import vehicle.ridewise.dto.RideRequest; // Import RideRequest dto
import vehicle.ridewise.dto.RideResponse; // Import RideResponse dto
import java.util.List; // Import List
import java.util.stream.Collectors; // Import Collectors
import java.time.LocalDateTime; // Import LocalDateTime

@Service // Mark as service
public class RideService { // Define class

    private final RideRepository rideRepository; // Repository instance

    public RideService(RideRepository rideRepository) { // Constructor injection
        this.rideRepository = rideRepository; // Assign repository
    } // End constructor

    public RideResponse createRide(RideRequest req) { // Create ride method
        Ride ride = new Ride(); // Create entity
        ride.setUserId(req.getUserId()); // Set user ID
        ride.setFromName(req.getFromName()); // Set from name
        ride.setFromLat(req.getFromLat()); // Set from lat
        ride.setFromLng(req.getFromLng()); // Set from lng
        ride.setDestinationName(req.getDestinationName()); // Set dest name
        ride.setDestinationLat(req.getDestinationLat()); // Set dest lat
        ride.setDestinationLng(req.getDestinationLng()); // Set dest lng
        ride.setRouteCoordinates(req.getRouteCoordinates()); // Set route
        ride.setRouteSteps(req.getRouteSteps()); // Set route steps (turn-by-turn navigation)
        ride.setDistanceMeters(req.getDistanceMeters()); // Set distance
        ride.setDurationSeconds(req.getDurationSeconds()); // Set duration
        ride.setRideType(req.getRideType()); // Set type
        ride.setStatus("active"); // Set default status
        Ride saved = rideRepository.save(ride); // Save entity
        return RideResponse.from(saved); // Return DTO
    } // End method

    public List<RideResponse> getUserRides(Long userId) { // Get user rides method
        return rideRepository.findByUserIdOrderByCreatedAtDesc(userId) // Find and sort
                .stream() // Convert to stream
                .map(RideResponse::from) // Map to DTO
                .collect(Collectors.toList()); // Collect as list
    } // End method

    public List<RideResponse> getActiveRides(Long userId) { // Get active rides method
        return rideRepository.findByUserIdAndStatus(userId, "active") // Find active
                .stream() // Convert to stream
                .map(RideResponse::from) // Map to DTO
                .collect(Collectors.toList()); // Collect as list
    } // End method

    public RideResponse updateStatus(Long rideId, String status) { // Update status method
        Ride ride = rideRepository.findById(rideId) // Find ride
                .orElseThrow(() -> new RuntimeException("Ride not found")); // Throw if not found
        ride.setStatus(status); // Set status
        if ("completed".equals(status) || "cancelled".equals(status)) { // Check status
            ride.setEndedAt(LocalDateTime.now()); // Set endedAt
        } // End if
        Ride saved = rideRepository.save(ride); // Save changes
        return RideResponse.from(saved); // Return DTO
    } // End method

    public void deleteRide(Long rideId) { // Delete ride method
        rideRepository.deleteById(rideId); // Delete by ID
    } // End method

    public RideResponse getRide(Long rideId) { // Get ride method
        Ride ride = rideRepository.findById(rideId) // Find ride
                .orElseThrow(() -> new RuntimeException("Ride not found")); // Throw if not found
        return RideResponse.from(ride); // Return DTO
    } // End method
} // End of class
