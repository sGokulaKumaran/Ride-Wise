package vehicle.ridewise.dto; // Package declaration

import vehicle.ridewise.entity.UserLocation; // Import entity
import java.time.LocalDateTime; // Import LocalDateTime

// ============================================================
// LiveLocationResponse — one member's CURRENT position
//
// Returned by GET /api/rides/{rideId}/live-locations (map open) and
// pushed over the WebSocket to every member of the same group ride.
//
// updatedAt is the SERVER time of the last accepted fix, so clients can
// decide whether the position is stale and mark the rider unavailable
// instead of drawing an old marker.
// ============================================================
public class LiveLocationResponse {

    private Long          userId;
    private Long          rideId;
    private Double        lat;
    private Double        lng;
    private Double        accuracy;
    private LocalDateTime updatedAt;

    public static LiveLocationResponse from(UserLocation ul) {
        LiveLocationResponse r = new LiveLocationResponse();
        r.userId    = ul.getUserId();
        r.rideId    = ul.getRideId();
        r.lat       = ul.getLat();
        r.lng       = ul.getLng();
        r.accuracy  = ul.getAccuracy();
        r.updatedAt = ul.getUpdatedAt();
        return r;
    }

    // ── Getters and setters ──

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Long getRideId() {
        return rideId;
    }

    public void setRideId(Long rideId) {
        this.rideId = rideId;
    }

    public Double getLat() {
        return lat;
    }

    public void setLat(Double lat) {
        this.lat = lat;
    }

    public Double getLng() {
        return lng;
    }

    public void setLng(Double lng) {
        this.lng = lng;
    }

    public Double getAccuracy() {
        return accuracy;
    }

    public void setAccuracy(Double accuracy) {
        this.accuracy = accuracy;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
} // End of class
