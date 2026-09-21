package vehicle.ridewise.dto; // Package declaration

import vehicle.ridewise.entity.Ride; // Import Ride entity
import java.time.LocalDateTime; // Import LocalDateTime

public class RideResponse { // Define class

    private Long id; // ID field
    private Long userId; // User ID field
    private String fromName; // Origin name field
    private Double fromLat; // Origin latitude field
    private Double fromLng; // Origin longitude field
    private String destinationName; // Destination name field
    private Double destinationLat; // Destination latitude field
    private Double destinationLng; // Destination longitude field
    private String routeCoordinates; // Route coordinates field
    private String routeSteps;       // Route turn-by-turn steps field
    private Double distanceMeters; // Distance field
    private Double durationSeconds; // Duration field
    private String rideType; // Ride type field
    private String status; // Status field
    private LocalDateTime createdAt; // Creation time field
    private LocalDateTime endedAt; // End time field

    private java.util.List<RideParticipantResponse> participants;
    private String creatorUsername;

    public static RideResponse from(Ride ride) { // Static factory method
        RideResponse res = new RideResponse(); // Create response instance
        res.setId(ride.getId()); // Set ID
        res.setUserId(ride.getUserId()); // Set User ID
        res.setFromName(ride.getFromName()); // Set Origin Name
        res.setFromLat(ride.getFromLat()); // Set Origin Lat
        res.setFromLng(ride.getFromLng()); // Set Origin Lng
        res.setDestinationName(ride.getDestinationName()); // Set Destination Name
        res.setDestinationLat(ride.getDestinationLat()); // Set Destination Lat
        res.setDestinationLng(ride.getDestinationLng()); // Set Destination Lng
        res.setRouteCoordinates(ride.getRouteCoordinates()); // Set Route
        res.setRouteSteps(ride.getRouteSteps()); // Set Route Steps
        res.setDistanceMeters(ride.getDistanceMeters()); // Set Distance
        res.setDurationSeconds(ride.getDurationSeconds()); // Set Duration
        res.setRideType(ride.getRideType()); // Set Type
        res.setStatus(ride.getStatus()); // Set Status
        res.setCreatedAt(ride.getCreatedAt()); // Set Created At
        res.setEndedAt(ride.getEndedAt()); // Set Ended At
        return res; // Return response
    } // End method

    // Getters and setters
    public Long getId() { // Get ID
        return id; // Return ID
    } // End getter

    public void setId(Long id) { // Set ID
        this.id = id; // Assign ID
    } // End setter

    public Long getUserId() { // Get userId
        return userId; // Return userId
    } // End getter

    public void setUserId(Long userId) { // Set userId
        this.userId = userId; // Assign userId
    } // End setter

    public String getFromName() { // Get fromName
        return fromName; // Return fromName
    } // End getter

    public void setFromName(String fromName) { // Set fromName
        this.fromName = fromName; // Assign fromName
    } // End setter

    public Double getFromLat() { // Get fromLat
        return fromLat; // Return fromLat
    } // End getter

    public void setFromLat(Double fromLat) { // Set fromLat
        this.fromLat = fromLat; // Assign fromLat
    } // End setter

    public Double getFromLng() { // Get fromLng
        return fromLng; // Return fromLng
    } // End getter

    public void setFromLng(Double fromLng) { // Set fromLng
        this.fromLng = fromLng; // Assign fromLng
    } // End setter

    public String getDestinationName() { // Get destinationName
        return destinationName; // Return destinationName
    } // End getter

    public void setDestinationName(String destinationName) { // Set destinationName
        this.destinationName = destinationName; // Assign destinationName
    } // End setter

    public Double getDestinationLat() { // Get destinationLat
        return destinationLat; // Return destinationLat
    } // End getter

    public void setDestinationLat(Double destinationLat) { // Set destinationLat
        this.destinationLat = destinationLat; // Assign destinationLat
    } // End setter

    public Double getDestinationLng() { // Get destinationLng
        return destinationLng; // Return destinationLng
    } // End getter

    public void setDestinationLng(Double destinationLng) { // Set destinationLng
        this.destinationLng = destinationLng; // Assign destinationLng
    } // End setter

    public String getRouteCoordinates() { // Get routeCoordinates
        return routeCoordinates; // Return routeCoordinates
    } // End getter

    public void setRouteCoordinates(String routeCoordinates) { // Set routeCoordinates
        this.routeCoordinates = routeCoordinates; // Assign routeCoordinates
    } // End setter

    public String getRouteSteps() { // Get routeSteps
        return routeSteps; // Return routeSteps
    } // End getter

    public void setRouteSteps(String routeSteps) { // Set routeSteps
        this.routeSteps = routeSteps; // Assign routeSteps
    } // End setter

    public Double getDistanceMeters() { // Get distanceMeters
        return distanceMeters; // Return distanceMeters
    } // End getter

    public void setDistanceMeters(Double distanceMeters) { // Set distanceMeters
        this.distanceMeters = distanceMeters; // Assign distanceMeters
    } // End setter

    public Double getDurationSeconds() { // Get durationSeconds
        return durationSeconds; // Return durationSeconds
    } // End getter

    public void setDurationSeconds(Double durationSeconds) { // Set durationSeconds
        this.durationSeconds = durationSeconds; // Assign durationSeconds
    } // End setter

    public String getRideType() { // Get rideType
        return rideType; // Return rideType
    } // End getter

    public void setRideType(String rideType) { // Set rideType
        this.rideType = rideType; // Assign rideType
    } // End setter

    public String getStatus() { // Get status
        return status; // Return status
    } // End getter

    public void setStatus(String status) { // Set status
        this.status = status; // Assign status
    } // End setter

    public LocalDateTime getCreatedAt() { // Get createdAt
        return createdAt; // Return createdAt
    } // End getter

    public void setCreatedAt(LocalDateTime createdAt) { // Set createdAt
        this.createdAt = createdAt; // Assign createdAt
    } // End setter

    public LocalDateTime getEndedAt() { // Get endedAt
        return endedAt; // Return endedAt
    } // End getter

    public void setEndedAt(LocalDateTime endedAt) { // Set endedAt
        this.endedAt = endedAt; // Assign endedAt
    } // End setter

    public java.util.List<RideParticipantResponse> getParticipants() {
        return participants;
    }

    public void setParticipants(java.util.List<RideParticipantResponse> participants) {
        this.participants = participants;
    }

    public String getCreatorUsername() {
        return creatorUsername;
    }

    public void setCreatorUsername(String creatorUsername) {
        this.creatorUsername = creatorUsername;
    }
} // End of class
