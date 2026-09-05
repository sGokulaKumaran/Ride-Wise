package vehicle.ridewise.service; // Package declaration

import org.springframework.stereotype.Service; // Import Service annotation
import vehicle.ridewise.repository.LocationUpdateRepository; // Import repository
import vehicle.ridewise.entity.LocationUpdate; // Import entity
import vehicle.ridewise.dto.LocationUpdateRequest; // Import request DTO
import vehicle.ridewise.dto.LocationUpdateResponse; // Import response DTO
import java.util.List; // Import List
import java.util.stream.Collectors; // Import Collectors

// ============================================================
// LocationUpdateService — business logic for GPS position storage
//
// Called by RideController when the frontend sends a live GPS fix.
// Saves the position to the location_updates table and returns
// a confirmation response with the database-generated row ID.
//
// Also provides a method to retrieve the full GPS track for a ride
// (used in ride history to show the actual path driven).
// ============================================================
@Service // Marks this as a Spring-managed service bean
public class LocationUpdateService { // Define class

    private final LocationUpdateRepository locationUpdateRepository; // Repository instance

    // Constructor injection — Spring automatically wires the repository
    public LocationUpdateService(LocationUpdateRepository locationUpdateRepository) { // Constructor
        this.locationUpdateRepository = locationUpdateRepository; // Assign repository
    } // End constructor

    // ============================================================
    // SAVE LOCATION — persist a single GPS fix for a ride
    //
    // INPUT:  rideId (from URL path), LocationUpdateRequest body
    // OUTPUT: LocationUpdateResponse with db-generated id + receivedAt
    // ============================================================
    public LocationUpdateResponse saveLocation(Long rideId, LocationUpdateRequest req) { // Save method
        LocationUpdate lu = new LocationUpdate(); // Create entity

        lu.setRideId(rideId); // Link to ride
        lu.setLat(req.getLat()); // Set latitude
        lu.setLng(req.getLng()); // Set longitude
        lu.setCapturedAt(req.getTimestamp()); // Set client capture time
        // receivedAt is set automatically by @PrePersist in the entity

        LocationUpdate saved = locationUpdateRepository.save(lu); // Persist to DB
        return LocationUpdateResponse.from(saved); // Return DTO
    } // End method

    // ============================================================
    // GET TRACK — retrieve all GPS fixes for a ride (newest first)
    //
    // Used by ride history to reconstruct the actual path taken.
    // Returns newest first so the frontend can easily get the last
    // known position by reading [0].
    // ============================================================
    public List<LocationUpdateResponse> getTrack(Long rideId) { // Get track method
        return locationUpdateRepository                    // Query repository
                .findByRideIdOrderByReceivedAtDesc(rideId) // Find all, sorted
                .stream()                                  // Convert to stream
                .map(LocationUpdateResponse::from)         // Map entity → DTO
                .collect(Collectors.toList());             // Collect as list
    } // End method
} // End of class
