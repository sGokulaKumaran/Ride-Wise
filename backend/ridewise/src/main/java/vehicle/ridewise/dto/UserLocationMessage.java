package vehicle.ridewise.dto; // Package declaration

// ============================================================
// UserLocationMessage — inbound WebSocket message from the browser
//
// The client sends one of:
//   { "type": "subscribe",   "rideId": 12 }
//   { "type": "unsubscribe" }
//   { "type": "location", "rideId": 12, "lat": 13.08, "lng": 80.27, "accuracy": 8 }
//
// The authenticated user id is NEVER taken from this message — it comes
// from the session resolved during the WebSocket handshake.
// ============================================================
public class UserLocationMessage {

    private String type;     // "subscribe" | "unsubscribe" | "location"
    private Long   rideId;   // target group ride
    private Double lat;      // GPS latitude
    private Double lng;      // GPS longitude
    private Double accuracy; // GPS accuracy radius in metres (optional)

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
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
} // End of class
