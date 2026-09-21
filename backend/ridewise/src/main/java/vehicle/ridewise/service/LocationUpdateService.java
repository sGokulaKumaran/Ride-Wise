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
    private final vehicle.ridewise.repository.RideRepository rideRepository; // Ride lookup for writer validation
    private final vehicle.ridewise.repository.RideParticipantRepository rideParticipantRepository; // Participant lookup

    // Constructor injection — Spring automatically wires the repositories
    public LocationUpdateService(LocationUpdateRepository locationUpdateRepository,
                                 vehicle.ridewise.repository.RideRepository rideRepository,
                                 vehicle.ridewise.repository.RideParticipantRepository rideParticipantRepository) { // Constructor
        this.locationUpdateRepository = locationUpdateRepository; // Assign repository
        this.rideRepository = rideRepository; // Assign ride repository
        this.rideParticipantRepository = rideParticipantRepository; // Assign participant repository
    } // End constructor

    // ============================================================
    // SAVE LOCATION — persist a single GPS fix for a ride
    //
    // INPUT:  rideId (from URL path), LocationUpdateRequest body
    // OUTPUT: LocationUpdateResponse with db-generated id + receivedAt
    //
    // Writer validation: for SOLO rides the writer must be the ride owner;
    // for GROUP rides the writer must be an ACTIVE participant. Requests
    // without a userId are still accepted to preserve demo/local behavior.
    // ============================================================
    public LocationUpdateResponse saveLocation(Long rideId, LocationUpdateRequest req) { // Save method
        if (req.getUserId() == null) {
            throw vehicle.ridewise.exception.ApiException.badRequest("Authenticated user is required");
        }
        if (req.getLat() == null || req.getLat() < -90 || req.getLat() > 90 ||
                req.getLng() == null || req.getLng() < -180 || req.getLng() > 180) {
            throw vehicle.ridewise.exception.ApiException.badRequest("Invalid GPS coordinates");
        }

        vehicle.ridewise.entity.Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> vehicle.ridewise.exception.ApiException.notFound("Ride not found"));
        if (!"active".equals(ride.getStatus())) {
            throw vehicle.ridewise.exception.ApiException.badRequest("Cannot share location for an inactive ride");
        }

        assertRideAccess(ride, req.getUserId(), true);

        LocationUpdate lu = new LocationUpdate(); // Create entity

        lu.setRideId(rideId); // Link to ride
        lu.setUserId(req.getUserId()); // Link to user
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
    public List<LocationUpdateResponse> getTrack(Long rideId, Long userId) { // Get track method
        vehicle.ridewise.entity.Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> vehicle.ridewise.exception.ApiException.notFound("Ride not found"));
        assertRideAccess(ride, userId, false);

        return locationUpdateRepository                    // Query repository
                .findByRideIdOrderByReceivedAtDesc(rideId) // Find all, sorted
                .stream()                                  // Convert to stream
                .map(LocationUpdateResponse::from)         // Map entity → DTO
                .collect(Collectors.toList());             // Collect as list
    } // End method

    private void assertRideAccess(vehicle.ridewise.entity.Ride ride, Long userId, boolean requireActiveParticipant) {
        if (ride.getUserId().equals(userId)) return;

        boolean allowed = rideParticipantRepository.findByRideIdAndUserId(ride.getId(), userId)
                .map(p -> !requireActiveParticipant || "active".equals(p.getStatus()))
                .orElse(false);
        if (!allowed) {
            throw vehicle.ridewise.exception.ApiException.forbidden("You are not an active participant in this ride");
        }
    }
} // End of class
