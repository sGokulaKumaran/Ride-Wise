package vehicle.ridewise.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

// ============================================================
// OrgRoute — a route an organization runs again and again
// ("Route 12 · Depot → College"), with its stops.
//
// An admin plans it once; drivers pick it when they start a trip, so
// every trip on that route follows the same road and people tracking a
// vehicle see the same stops each day.
//
//   routeCoordinates  JSON [[lng, lat], …] exactly as the routing service
//                     returned it (same format rides use)
//   routeSteps        JSON turn-by-turn steps (same format rides use)
//   stopsJson         JSON [{ "name": "..", "lat": .., "lng": .. }, …]
//                     in the order the vehicle reaches them
// ============================================================
@Entity
@Table(name = "org_routes", indexes = @Index(name = "idx_org_route_org", columnList = "org_id"))
public class OrgRoute {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "org_id")
    private Long orgId;

    @Column(name = "name", length = 120)
    private String name;

    @Column(name = "from_name")
    private String fromName;

    @Column(name = "from_lat")
    private Double fromLat;

    @Column(name = "from_lng")
    private Double fromLng;

    @Column(name = "destination_name")
    private String destinationName;

    @Column(name = "destination_lat")
    private Double destinationLat;

    @Column(name = "destination_lng")
    private Double destinationLng;

    @Column(name = "route_coordinates", columnDefinition = "TEXT")
    private String routeCoordinates;

    @Column(name = "route_steps", columnDefinition = "TEXT")
    private String routeSteps;

    @Column(name = "stops_json", columnDefinition = "TEXT")
    private String stopsJson;

    @Column(name = "distance_meters")
    private Double distanceMeters;

    @Column(name = "duration_seconds")
    private Double durationSeconds;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId()                    { return id; }
    public Long getOrgId()                 { return orgId; }
    public String getName()                { return name; }
    public String getFromName()            { return fromName; }
    public Double getFromLat()             { return fromLat; }
    public Double getFromLng()             { return fromLng; }
    public String getDestinationName()     { return destinationName; }
    public Double getDestinationLat()      { return destinationLat; }
    public Double getDestinationLng()      { return destinationLng; }
    public String getRouteCoordinates()    { return routeCoordinates; }
    public String getRouteSteps()          { return routeSteps; }
    public String getStopsJson()           { return stopsJson; }
    public Double getDistanceMeters()      { return distanceMeters; }
    public Double getDurationSeconds()     { return durationSeconds; }
    public LocalDateTime getCreatedAt()    { return createdAt; }
    public LocalDateTime getUpdatedAt()    { return updatedAt; }

    public void setId(Long id)                               { this.id = id; }
    public void setOrgId(Long orgId)                         { this.orgId = orgId; }
    public void setName(String name)                         { this.name = name; }
    public void setFromName(String fromName)                 { this.fromName = fromName; }
    public void setFromLat(Double fromLat)                   { this.fromLat = fromLat; }
    public void setFromLng(Double fromLng)                   { this.fromLng = fromLng; }
    public void setDestinationName(String destinationName)   { this.destinationName = destinationName; }
    public void setDestinationLat(Double destinationLat)     { this.destinationLat = destinationLat; }
    public void setDestinationLng(Double destinationLng)     { this.destinationLng = destinationLng; }
    public void setRouteCoordinates(String routeCoordinates) { this.routeCoordinates = routeCoordinates; }
    public void setRouteSteps(String routeSteps)             { this.routeSteps = routeSteps; }
    public void setStopsJson(String stopsJson)               { this.stopsJson = stopsJson; }
    public void setDistanceMeters(Double distanceMeters)     { this.distanceMeters = distanceMeters; }
    public void setDurationSeconds(Double durationSeconds)   { this.durationSeconds = durationSeconds; }
}
