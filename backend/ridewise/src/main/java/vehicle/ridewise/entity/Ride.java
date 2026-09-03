package vehicle.ridewise.entity; // Package declaration

import jakarta.persistence.*; // Import JPA annotations
import java.time.LocalDateTime; // Import LocalDateTime

@Entity // Mark as JPA entity
@Table(name = "rides") // Specify table name
public class Ride { // Define class

    @Id // Mark as primary key
    @GeneratedValue(strategy = GenerationType.IDENTITY) // Auto-increment ID
    private Long id; // ID field

    @Column(name = "user_id") // Column for user ID
    private Long userId; // User ID field

    @Column(name = "from_name") // Column for origin name
    private String fromName; // Origin name field

    @Column(name = "from_lat") // Column for origin latitude
    private Double fromLat; // Origin latitude field

    @Column(name = "from_lng") // Column for origin longitude
    private Double fromLng; // Origin longitude field

    @Column(name = "destination_name") // Column for destination name
    private String destinationName; // Destination name field

    @Column(name = "destination_lat") // Column for destination latitude
    private Double destinationLat; // Destination latitude field

    @Column(name = "destination_lng") // Column for destination longitude
    private Double destinationLng; // Destination longitude field

    @Column(name = "route_coordinates", columnDefinition = "TEXT") // Column for route coordinates
    private String routeCoordinates; // Route coordinates field

    @Column(name = "distance_meters") // Column for distance
    private Double distanceMeters; // Distance field

    @Column(name = "duration_seconds") // Column for duration
    private Double durationSeconds; // Duration field

    @Column(name = "ride_type") // Column for ride type
    private String rideType; // Ride type field

    @Column(name = "status") // Column for status
    private String status; // Status field

    @Column(name = "created_at", updatable = false) // Column for creation time
    private LocalDateTime createdAt; // Creation time field

    @Column(name = "ended_at") // Column for end time
    private LocalDateTime endedAt; // End time field

    @PrePersist // Called before persist
    protected void onCreate() { // onCreate method
        this.createdAt = LocalDateTime.now(); // Set creation time
    } // End of method

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
} // End of class
