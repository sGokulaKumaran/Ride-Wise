package vehicle.ridewise.dto; // Package declaration

// ============================================================
// LocationUpdateRequest — DTO for incoming GPS position updates
//
// Sent by the frontend (ActiveRideOverlay) as JSON:
//   POST /api/rides/{rideId}/location
//   Body: { "lat": 13.0827, "lng": 80.2707, "timestamp": "2026-09-05T15:30:00.000Z" }
//
// Fields:
//   lat       — decimal degrees latitude  (north-south, e.g. 13.0827)
//   lng       — decimal degrees longitude (east-west,  e.g. 80.2707)
//   timestamp — ISO 8601 client-side capture time
// ============================================================
public class LocationUpdateRequest { // Define class

    private Double lat; // Latitude from GPS

    private Double lng; // Longitude from GPS

    // ISO 8601 timestamp sent from the browser.
    // We store it as-is (not parsed) to preserve the client's exact value.
    private String timestamp; // Client-side capture time

    private Long userId; // The user sending the fix

    // ── Getters and setters ──

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

    public String getTimestamp() { // Get timestamp
        return timestamp; // Return timestamp
    } // End getter

    public void setTimestamp(String timestamp) { // Set timestamp
        this.timestamp = timestamp; // Assign timestamp
    } // End setter

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }
} // End of class
