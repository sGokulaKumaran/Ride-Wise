package vehicle.ridewise.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

// ============================================================
// VehicleSessionPoint — one point of the path a trip really took
//
// Used to replay a past trip on the map. NOT every GPS fix is stored:
// a point is kept only after the vehicle has moved a fair distance (or
// some time has passed), so a two-hour trip is a few hundred rows, not
// several thousand. Old points are removed by DataCleanupService.
// ============================================================
@Entity
@Table(name = "vehicle_session_points",
    indexes = @Index(name = "idx_vsession_point_session", columnList = "session_id, recorded_at"))
public class VehicleSessionPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id")
    private Long sessionId;

    private Double lat;
    private Double lng;

    @Column(name = "speed_kmh")
    private Double speedKmh;

    @Column(name = "recorded_at")
    private LocalDateTime recordedAt;

    public VehicleSessionPoint() {}

    public VehicleSessionPoint(Long sessionId, Double lat, Double lng, Double speedKmh, LocalDateTime recordedAt) {
        this.sessionId = sessionId;
        this.lat = lat;
        this.lng = lng;
        this.speedKmh = speedKmh;
        this.recordedAt = recordedAt;
    }

    public Long getId()                     { return id; }
    public Long getSessionId()              { return sessionId; }
    public Double getLat()                  { return lat; }
    public Double getLng()                  { return lng; }
    public Double getSpeedKmh()             { return speedKmh; }
    public LocalDateTime getRecordedAt()    { return recordedAt; }

    public void setId(Long id)                             { this.id = id; }
    public void setSessionId(Long sessionId)               { this.sessionId = sessionId; }
    public void setLat(Double lat)                         { this.lat = lat; }
    public void setLng(Double lng)                         { this.lng = lng; }
    public void setSpeedKmh(Double speedKmh)               { this.speedKmh = speedKmh; }
    public void setRecordedAt(LocalDateTime recordedAt)    { this.recordedAt = recordedAt; }
}
