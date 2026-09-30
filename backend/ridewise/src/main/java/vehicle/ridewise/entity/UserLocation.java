package vehicle.ridewise.entity; // Package declaration

import jakarta.persistence.*; // Import JPA annotations
import java.time.LocalDateTime; // Import LocalDateTime

// ============================================================
// UserLocation — the LATEST known GPS position for a single user
//
// WHY THIS TABLE EXISTS (and why it is NOT LocationUpdate):
//   • location_updates stores one history row per GPS tick (ride replay).
//   • user_locations stores exactly ONE row per user and UPDATES it in
//     place, so live group-ride tracking never floods the database.
//
// The unique constraint on user_id is what guarantees "only the latest":
// an upsert finds the existing row and overwrites lat/lng/accuracy.
//
// ride_id records which ride the position was captured in, so we can
// broadcast/load only the members of one group ride.
//
// TABLE: user_locations
// ============================================================
@Entity // Mark as a JPA entity so Hibernate creates the table
@Table(name = "user_locations", uniqueConstraints = {
    @UniqueConstraint(name = "uk_user_location_user", columnNames = "user_id")
}, indexes = {
    @Index(name = "idx_user_location_ride_id", columnList = "ride_id")
})
public class UserLocation {

    @Id // Primary key
    @GeneratedValue(strategy = GenerationType.IDENTITY) // Auto-increment PK
    private Long id;

    // One row per user — the unique constraint above enforces this.
    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    // Which ride the position belongs to (used for group broadcast/loading).
    @Column(name = "ride_id")
    private Long rideId;

    @Column(name = "lat", nullable = false)
    private Double lat;

    @Column(name = "lng", nullable = false)
    private Double lng;

    // GPS accuracy radius in metres — lets clients judge how trustworthy
    // a fix is and helps detect "stale/unavailable" positions.
    @Column(name = "accuracy")
    private Double accuracy;

    // Server-side time of the most recent accepted update. Set automatically
    // on insert AND update so it can never be tampered with by the client.
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void touch() {
        this.updatedAt = LocalDateTime.now();
    }

    // ── Getters and setters (no Lombok — incompatible with Java 25) ──

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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
