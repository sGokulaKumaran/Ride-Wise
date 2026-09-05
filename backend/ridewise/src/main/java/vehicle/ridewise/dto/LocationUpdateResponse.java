package vehicle.ridewise.dto; // Package declaration

import vehicle.ridewise.entity.LocationUpdate; // Import entity
import java.time.LocalDateTime; // Import LocalDateTime

// ============================================================
// LocationUpdateResponse — DTO returned after saving a GPS fix
//
// Returned by POST /api/rides/{rideId}/location
// Confirms what was saved: the generated ID + the server-side
// receivedAt timestamp (useful for debugging drift between
// client timestamp and server receive time).
// ============================================================
public class LocationUpdateResponse { // Define class

    private Long          id;         // Auto-generated database row ID
    private Long          rideId;     // Which ride this fix belongs to
    private Double        lat;        // Saved latitude
    private Double        lng;        // Saved longitude
    private String        capturedAt; // Client-side capture timestamp (ISO 8601)
    private LocalDateTime receivedAt; // Server-side receive timestamp

    // ── Static factory — builds response from saved entity ──
    public static LocationUpdateResponse from(LocationUpdate lu) { // Factory method
        LocationUpdateResponse r = new LocationUpdateResponse(); // Create response
        r.setId(lu.getId()); // Set ID
        r.setRideId(lu.getRideId()); // Set ride ID
        r.setLat(lu.getLat()); // Set lat
        r.setLng(lu.getLng()); // Set lng
        r.setCapturedAt(lu.getCapturedAt()); // Set capturedAt
        r.setReceivedAt(lu.getReceivedAt()); // Set receivedAt
        return r; // Return response
    } // End method

    // ── Getters and setters ──

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
