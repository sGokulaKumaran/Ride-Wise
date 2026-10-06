package vehicle.ridewise.dto;

import java.time.LocalDateTime;
import java.util.List;

// ============================================================
// OrgDtos — every request and response shape of the organization /
// fleet API, in one place.
//
// Java records: each is an immutable bundle of named values that Jackson
// reads from / writes to JSON by component name. Keeping them together
// makes the API readable top to bottom — this file IS the contract the
// frontend's orgApi.js talks to.
//
// Privacy note: nothing here ever carries a password hash, and a driver's
// phone number is filled in only where the service decided the viewer may
// see it (see FleetService.tripFor).
// ============================================================
public final class OrgDtos {

    private OrgDtos() {}

    // ════════════════════════════════════════════════════════
    // REQUESTS
    // ════════════════════════════════════════════════════════

    /** Create / edit an organization. Null fields are left unchanged on edit. */
    public record OrgRequest(
            String name, String orgType, String visibility, String accessPassword,
            String description, String address, Double lat, Double lng,
            String contactPhone, Boolean showDriverPhone, Integer speedLimitKmh) {}

    /** Open a private organization. */
    public record AccessRequest(String orgCode, String password) {}

    /** Set a new access password; revokeExisting makes everyone enter it again. */
    public record AccessPasswordRequest(String password, Boolean revokeExisting) {}

    /** Invite someone by username or email. role: ADMIN | DRIVER | VIEWER. */
    public record InviteRequest(String identifier, String role) {}

    /** Change a member's role, or suspend / reactivate them. */
    public record MemberPatch(String role, String status) {}

    public record TransferRequest(Long memberId) {}

    public record VehicleRequest(
            String vehicleCode, String vehicleType, String registrationNumber,
            Integer capacity, String description) {}

    public record StatusRequest(String status) {}

    public record StopDto(String name, Double lat, Double lng) {}

    public record RouteRequest(
            String name,
            String fromName, Double fromLat, Double fromLng,
            String destinationName, Double destinationLat, Double destinationLng,
            String routeCoordinates, String routeSteps,
            Double distanceMeters, Double durationSeconds,
            List<StopDto> stops) {}

    public record AnnouncementRequest(
            String title, String message, String level, Long vehicleId, Integer expiresInHours) {}

    /**
     * Start a trip. Either routeId (a saved route) or a destination of the
     * driver's own choosing (with the route the app planned for it).
     */
    public record StartSessionRequest(
            Long orgId, Long vehicleId, Long routeId,
            String fromName, Double fromLat, Double fromLng,
            String destinationName, Double destinationLat, Double destinationLng,
            String routeCoordinates, String routeSteps,
            Double distanceMeters, Double durationSeconds) {}

    /** One GPS fix from the driver's device. speed in m/s, heading in degrees. */
    public record PositionRequest(
            Double lat, Double lng, Double accuracy, Double speed, Double heading, Long timestamp) {}

    public record SosRequest(Boolean active, String message) {}

    public record CrowdRequest(String level) {}

    public record AlertRequest(Long vehicleId, String label, Double lat, Double lng, Integer radiusMeters) {}

    /** Platform admin: verify / suspend an organization. */
    public record AdminOrgPatch(Boolean verified, String status) {}

    // ════════════════════════════════════════════════════════
    // RESPONSES
    // ════════════════════════════════════════════════════════

    /**
     * An organization as it appears in lists.
     *   myRole  OWNER | ADMIN | DRIVER | VIEWER, or null when not a member
     *   saved   on the viewer's own list
     */
    public record OrgCard(
            Long id, String orgCode, String name, String orgType, String visibility,
            boolean verified, String status, String description, String address,
            long vehicleCount, long activeTrips,
            String myRole, String myStatus, boolean saved) {}

    /** The full organization page. Manager-only values are null for everyone else. */
    public record OrgDetail(
            OrgCard card,
            Double lat, Double lng,
            String contactPhone,
            boolean showDriverPhone,
            Integer speedLimitKmh,
            boolean canManage, boolean owner, boolean canDrive,
            Long memberCount, Long accessCount,
            LocalDateTime createdAt) {}

    /** What the navigation needs to know about the signed-in person. */
    public record MySummary(
            List<OrgCard> managed,
            List<OrgCard> driving,
            List<Invitation> invitations,
            long savedCount,
            SessionDto activeTrip) {}

    public record Invitation(
            Long memberId, Long orgId, String orgName, String orgType, boolean verified,
            String role, String invitedByName, LocalDateTime invitedAt) {}

    public record MemberDto(
            Long id, Long userId, String username, String email, String mobile,
            String role, String status, String invitedByName,
            LocalDateTime joinedAt, LocalDateTime invitedAt,
            boolean onTrip, String tripVehicleCode) {}

    public record AccessHolder(Long userId, String username, LocalDateTime grantedAt, LocalDateTime lastAccessedAt) {}

    /**
     * A running trip, as seen by someone watching the vehicle.
     *   ageSeconds   how old the position is, computed on the SERVER — the
     *                viewer's clock may be wrong, the server's is the same
     *                one that stamped the position
     *   driverPhone  null unless the organization shows it (or the viewer
     *                manages the organization)
     */
    public record LiveTrip(
            Long sessionId, Long routeId, String routeName,
            String fromName, String destinationName,
            Double destinationLat, Double destinationLng,
            String driverName, String driverPhone,
            LocalDateTime startedAt,
            Double lat, Double lng, Double speed, Double heading, Double accuracy,
            LocalDateTime locationAt, Long ageSeconds,
            Double distanceMeters, Double plannedDistanceMeters, Double plannedDurationSeconds,
            String crowdLevel, boolean sos, String sosMessage) {}

    public record VehicleDto(
            Long id, Long orgId, String vehicleCode, String vehicleType,
            String registrationNumber, Integer capacity, String description, String status,
            Double lastLat, Double lastLng, LocalDateTime lastLocationAt,
            LiveTrip trip) {}

    public record RouteDto(
            Long id, Long orgId, String name,
            String fromName, Double fromLat, Double fromLng,
            String destinationName, Double destinationLat, Double destinationLng,
            Double distanceMeters, Double durationSeconds,
            List<StopDto> stops,
            String routeCoordinates, String routeSteps) {}

    public record SessionDto(
            Long id, Long orgId, Long vehicleId, String vehicleCode,
            Long driverUserId, String driverName,
            Long routeId, String routeName,
            String fromName, Double fromLat, Double fromLng,
            String destinationName, Double destinationLat, Double destinationLng,
            String status, String endReason,
            LocalDateTime startedAt, LocalDateTime endedAt,
            Double distanceMeters, Double plannedDistanceMeters, Double plannedDurationSeconds,
            Double maxSpeedKmh, Integer overspeedCount,
            Double lastLat, Double lastLng, LocalDateTime lastLocationAt,
            String crowdLevel, boolean sosActive, String sosMessage) {}

    /** The planned road of a trip: geometry, turn-by-turn steps, stops. */
    public record SessionRouteDto(String routeCoordinates, String routeSteps, List<StopDto> stops) {}

    /**
     * Everything the driver's screen needs for the trip in progress.
     * speedLimitKmh is the organization's own limit (null = none), so the
     * driver's screen can warn before the server has to count it.
     */
    public record DriverTrip(
            SessionDto session, SessionRouteDto route, String orgName, String vehicleType,
            Integer speedLimitKmh) {}

    public record TrackPoint(double lat, double lng, Double speedKmh, LocalDateTime at) {}

    /** A finished (or running) trip with the path it really took. */
    public record SessionTrack(SessionDto session, SessionRouteDto route, List<TrackPoint> points) {}

    public record AlertDto(Long vehicleId, String label, Double lat, Double lng, Integer radiusMeters) {}

    /** The tracking screen: the vehicle, its planned road, the viewer's own alert. */
    public record VehicleDetail(
            VehicleDto vehicle, SessionRouteDto route, OrgCard org,
            String orgContactPhone, AlertDto myAlert, SessionDto lastTrip) {}

    public record AnnouncementDto(
            Long id, Long orgId, String title, String message, String level,
            Long vehicleId, String vehicleCode, String authorName,
            LocalDateTime createdAt, LocalDateTime expiresAt) {}

    public record ActivityDto(Long id, String actorName, String action, String summary, LocalDateTime createdAt) {}

    public record PageDto<T>(List<T> items, long total, int page, int size, int totalPages) {}

    // ── Admin overview and statistics ──

    /** The numbers at the top of an organization's admin dashboard. */
    public record Dashboard(
            long vehicles, long vehiclesAvailable, long vehiclesOnTrip, long vehiclesOff,
            long drivers, long members, long pendingInvites, long followers,
            long tripsToday, double distanceTodayMeters, long sosActive,
            List<ActivityDto> activity) {}

    /** One calendar day (in the viewer's own time zone). */
    public record DayStat(String date, long trips, double distanceMeters, long drivingSeconds) {}

    public record DriverStat(
            Long userId, String name, long trips, double distanceMeters, long drivingSeconds,
            double maxSpeedKmh, long overspeedCount) {}

    public record VehicleStat(
            Long vehicleId, String vehicleCode, long trips, double distanceMeters, long drivingSeconds) {}

    public record Analytics(
            int days, long trips, double distanceMeters, long drivingSeconds, long overspeedCount,
            long cancelledTrips, Integer speedLimitKmh,
            List<DayStat> daily, List<DriverStat> drivers, List<VehicleStat> vehicles) {}
}
