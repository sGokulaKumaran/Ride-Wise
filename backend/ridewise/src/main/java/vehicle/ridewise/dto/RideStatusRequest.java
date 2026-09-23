package vehicle.ridewise.dto; // Package declaration

// ============================================================
// 🏁 RideStatusRequest — body of PATCH /api/rides/{rideId}/status
//
// Used when a ride ends:
//   status               — "completed" or "cancelled"
//   userId               — the actor (session identity is authoritative;
//                          kept for backwards compatibility)
//   actualDistanceMeters — how far the rider REALLY rode, tracked live
//                          on the client (route-accurate + GPS filtered).
//                          Optional: older clients simply omit it.
// ============================================================

public class RideStatusRequest { // Define class

    private String status; // New ride status
    private Long userId; // Acting user (ride admin for group rides)
    private Double actualDistanceMeters; // Distance actually ridden, in metres

    // Getters and setters

    public String getStatus() { // Get status
        return status; // Return status
    } // End getter

    public void setStatus(String status) { // Set status
        this.status = status; // Assign status
    } // End setter

    public Long getUserId() { // Get userId
        return userId; // Return userId
    } // End getter

    public void setUserId(Long userId) { // Set userId
        this.userId = userId; // Assign userId
    } // End setter

    public Double getActualDistanceMeters() { // Get actualDistanceMeters
        return actualDistanceMeters; // Return actualDistanceMeters
    } // End getter

    public void setActualDistanceMeters(Double actualDistanceMeters) { // Set actualDistanceMeters
        this.actualDistanceMeters = actualDistanceMeters; // Assign actualDistanceMeters
    } // End setter
} // End of class
