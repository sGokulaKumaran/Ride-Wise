package vehicle.ridewise.entity; // Package declaration

import jakarta.persistence.*; // Import JPA annotations
import java.time.LocalDateTime; // Import LocalDateTime

// ============================================================
// LocationUpdate — stores a single GPS position snapshot for a ride
//
// Every time a rider's phone sends a GPS tick, we save one row here.
// This lets us:
//   • Reconstruct the actual path taken (not just the planned route)
//   • Show traveled distance in ride history
//   • Support future group-ride live tracking features
//
// TABLE: location_updates
// ============================================================
@Entity // Mark as a JPA entity so Hibernate creates the table
@Table(name = "location_updates") // Explicit table name
public class LocationUpdate { // Define class

    @Id // Primary key
    @GeneratedValue(strategy = GenerationType.IDENTITY) // Auto-increment integer PK
    private Long id; // Unique row ID

    // Foreign key to the rides table — which ride this position belongs to
    // We store just the numeric ID (no @ManyToOne join) for simplicity.
    @Column(name = "ride_id", nullable = false) // Column for ride ID
    private Long rideId; // The ride this GPS fix belongs to

    @Column(name = "lat", nullable = false) // Column for latitude
    private Double lat; // GPS latitude (decimal degrees, e.g. 13.0827)

    @Column(name = "lng", nullable = false) // Column for longitude
    private Double lng; // GPS longitude (decimal degrees, e.g. 80.2707)

    // ISO 8601 timestamp captured on the client device when the GPS fix occurred.
    // Stored as a string to preserve exact client-sent value including timezone.
    @Column(name = "captured_at") // Column for client-side timestamp
    private String capturedAt; // Client timestamp string (e.g. "2026-09-05T15:30:00.000Z")

    // Server-side timestamp: when did we receive and save this update?
    // Set automatically in @PrePersist so it cannot be tampered from the client.
    @Column(name = "received_at", updatable = false) // Server receive time
    private LocalDateTime receivedAt; // When backend saved this row

    // ── @PrePersist — called by JPA just before INSERT ──
    // Sets receivedAt to the current server time automatically.
    @PrePersist // JPA lifecycle callback — runs before first INSERT
    protected void onPersist() { // Set server-side timestamp
        this.receivedAt = LocalDateTime.now(); // Capture server time at save
    } // End method

    // ── Getters and setters (no Lombok — incompatible with Java 25) ──

    public Long getId() { // Get id
        return id; // Return id
    } // End getter

    public void setId(Long id) { // Set id
        this.id = id; // Assign id
    } // End setter

    public Long getRideId() { // Get rideId
        return rideId; // Return rideId
    } // End getter

    public void setRideId(Long rideId) { // Set rideId
        this.rideId = rideId; // Assign rideId
    } // End setter

    public Double getLat() { // Get lat
        return lat; // Return lat
    } // End getter

    public void setLat(Double lat) { // Set lat
        this.lat = lat; // Assign lat
    } // End setter

    public Double getLng() { // Get lng
        return lng; // Return lng
    } // End getter

    public void setLng(Double lng) { // Set lng
        this.lng = lng; // Assign lng
    } // End setter

    public String getCapturedAt() { // Get capturedAt
        return capturedAt; // Return capturedAt
    } // End getter

    public void setCapturedAt(String capturedAt) { // Set capturedAt
        this.capturedAt = capturedAt; // Assign capturedAt
    } // End setter

    public LocalDateTime getReceivedAt() { // Get receivedAt
        return receivedAt; // Return receivedAt
    } // End getter

    public void setReceivedAt(LocalDateTime receivedAt) { // Set receivedAt
        this.receivedAt = receivedAt; // Assign receivedAt
    } // End setter
} // End of class
