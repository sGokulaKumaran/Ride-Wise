package vehicle.ridewise.entity;

import jakarta.persistence.*;

// ============================================================
// VehicleSessionRoute — the road a trip is meant to follow
//
// One row per trip (same id as the trip). Kept apart from VehicleSession
// because it is large and only two screens need it: the driver's own map
// and the map of someone tracking that vehicle.
//
// It is a COPY of the saved route taken when the trip starts, so editing
// or deleting the saved route later never changes a trip already driven.
//
//   routeCoordinates  JSON [[lng, lat], …]
//   routeSteps        JSON turn-by-turn steps
//   stopsJson         JSON [{ "name": "..", "lat": .., "lng": .. }, …]
// ============================================================
@Entity
@Table(name = "vehicle_session_routes")
public class VehicleSessionRoute {

    @Id
    @Column(name = "session_id")
    private Long sessionId;

    @Column(name = "route_coordinates", columnDefinition = "TEXT")
    private String routeCoordinates;

    @Column(name = "route_steps", columnDefinition = "TEXT")
    private String routeSteps;

    @Column(name = "stops_json", columnDefinition = "TEXT")
    private String stopsJson;

    public VehicleSessionRoute() {}

    public VehicleSessionRoute(Long sessionId, String routeCoordinates, String routeSteps, String stopsJson) {
        this.sessionId = sessionId;
        this.routeCoordinates = routeCoordinates;
        this.routeSteps = routeSteps;
        this.stopsJson = stopsJson;
    }

    public Long getSessionId()            { return sessionId; }
    public String getRouteCoordinates()   { return routeCoordinates; }
    public String getRouteSteps()         { return routeSteps; }
    public String getStopsJson()          { return stopsJson; }

    public void setSessionId(Long sessionId)                 { this.sessionId = sessionId; }
    public void setRouteCoordinates(String routeCoordinates) { this.routeCoordinates = routeCoordinates; }
    public void setRouteSteps(String routeSteps)             { this.routeSteps = routeSteps; }
    public void setStopsJson(String stopsJson)               { this.stopsJson = stopsJson; }
}
