package vehicle.ridewise.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.dto.OrgDtos.DriverTrip;
import vehicle.ridewise.dto.OrgDtos.PageDto;
import vehicle.ridewise.dto.OrgDtos.PositionRequest;
import vehicle.ridewise.dto.OrgDtos.SessionDto;
import vehicle.ridewise.dto.OrgDtos.SessionRouteDto;
import vehicle.ridewise.dto.OrgDtos.SessionTrack;
import vehicle.ridewise.dto.OrgDtos.StartSessionRequest;
import vehicle.ridewise.dto.OrgDtos.StopDto;
import vehicle.ridewise.dto.OrgDtos.TrackPoint;
import vehicle.ridewise.entity.OrgMember;
import vehicle.ridewise.entity.OrgRoute;
import vehicle.ridewise.entity.Organization;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.entity.Vehicle;
import vehicle.ridewise.entity.VehicleSession;
import vehicle.ridewise.entity.VehicleSessionPoint;
import vehicle.ridewise.entity.VehicleSessionRoute;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.repository.OrgMemberRepository;
import vehicle.ridewise.repository.OrgRouteRepository;
import vehicle.ridewise.repository.UserRepository;
import vehicle.ridewise.repository.VehicleRepository;
import vehicle.ridewise.repository.VehicleSessionPointRepository;
import vehicle.ridewise.repository.VehicleSessionRepository;
import vehicle.ridewise.repository.VehicleSessionRouteRepository;
import vehicle.ridewise.websocket.FleetBroadcaster;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// ============================================================
// VehicleSessionService — trips: a driver takes a vehicle out, its
// position goes live, the trip ends.
//
// THE LOCK
//   One vehicle  → one running trip.   One driver → one running trip.
//   start() checks both first, to give a clear message ("BUS-01 is in use
//   by Arun"). The guarantee itself comes from the database: the two
//   unique "active key" columns of VehicleSession refuse a second running
//   trip even when two drivers tap Start in the same instant.
//
// POSITIONS (the hot path — every running vehicle, every few seconds)
//   Each accepted fix is
//     1. checked (valid coordinates, not a flood, not a wild GPS jump),
//     2. kept in memory as the trip's live state,
//     3. broadcast to everyone watching the vehicle or its organization,
//     4. written to the database only every few seconds (latest position
//        + distance so far), plus a thinned-out track point for replays.
//   So ten people or ten thousand watching a bus cost the database the
//   same, and a position is never older than a few seconds on disk.
//
//   Distance, top speed and "over the limit" are measured HERE, from the
//   fixes — never taken from what a device claims to have driven.
//
// ENDING A TRIP
//   by the driver · by an admin (a forgotten trip) · automatically after
//   no position for a long time · because the driver, the vehicle or the
//   organization was removed. Every path goes through finish(), so the
//   vehicle is always unlocked and watchers are always told.
//
// SINGLE SERVER NOTE
//   The live state and the watcher lists are in this server's memory.
//   That is right for one backend instance; several instances would need
//   a shared message bus between them.
// ============================================================
@Service
public class VehicleSessionService {

    private static final Logger log = LoggerFactory.getLogger(VehicleSessionService.class);

    static final String ACTIVE = "ACTIVE";

    // ── Position handling ──
    private static final long MIN_FIX_INTERVAL_MS = 800;      // faster than this = a flood, dropped
    private static final long PERSIST_INTERVAL_MS = 5_000;    // database write cadence per trip
    private static final double IGNORE_ACCURACY_M = 200;      // vaguer than this is not a position
    private static final double TRUSTED_ACCURACY_M = 60;      // only these fixes measure distance / speed
    private static final double MIN_HOP_M = 5;                // below this it is GPS wobble
    private static final double MAX_HOP_SPEED_MPS = 45;       // 162 km/h — faster is a GPS jump
    private static final double MAX_REPORTED_SPEED_MPS = 60;

    // ── Replay track (thinned) ──
    private static final double TRACK_MIN_DISTANCE_M = 40;
    private static final long TRACK_MAX_GAP_MS = 30_000;
    private static final int MAX_TRACK_POINTS = 4_000;

    // ── Stored route sizes (same order of magnitude rides allow) ──
    private static final int MAX_ROUTE_CHARS = 1_500_000;
    private static final int MAX_STEPS_CHARS = 400_000;
    private static final int MAX_NAME = 255;

    /** What is known right now about one running trip. Guarded by its own monitor. */
    private static final class LiveState {
        final long sessionId;
        final long vehicleId;
        final long orgId;
        final long driverUserId;
        final String vehicleCode;
        Integer speedLimitKmh;

        boolean hasFix;
        double lat;
        double lng;
        Double speed;      // m/s
        Double heading;    // degrees
        Double accuracy;   // metres
        long fixAt;        // server clock, ms

        double distance;
        double maxSpeedKmh;
        int overspeedCount;
        boolean overspeeding;
        int jumpsRefused;  // consecutive fixes refused as "impossible jump"

        // Last time the driver's device sent ANYTHING for this trip — also a
        // fix that was not used (too vague, too soon). Tells an abandoned
        // trip from a bus that is merely standing in a depot.
        volatile long heardAt = System.currentTimeMillis();

        long lastPersistAt;
        boolean hasTrackPoint;
        double trackLat;
        double trackLng;
        long trackAt;
        int trackPoints;

        LiveState(VehicleSession s, Integer speedLimitKmh) {
            this.sessionId = s.getId();
            this.vehicleId = s.getVehicleId();
            this.orgId = s.getOrgId();
            this.driverUserId = s.getDriverUserId();
            this.vehicleCode = s.getVehicleCode();
            this.speedLimitKmh = speedLimitKmh;
            this.distance = s.getDistanceMeters() == null ? 0 : s.getDistanceMeters();
            this.maxSpeedKmh = s.getMaxSpeedKmh() == null ? 0 : s.getMaxSpeedKmh();
            this.overspeedCount = s.getOverspeedCount() == null ? 0 : s.getOverspeedCount();
            if (s.getLastLat() != null && s.getLastLng() != null) {
                this.hasFix = true;
                this.lat = s.getLastLat();
                this.lng = s.getLastLng();
                this.speed = s.getLastSpeed();
                this.heading = s.getLastHeading();
                this.accuracy = s.getLastAccuracy();
                this.fixAt = s.getLastLocationAt() == null ? System.currentTimeMillis()
                        : s.getLastLocationAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
            }
        }
    }

    /** The newest position of a running trip, for the services that build API answers. */
    public record LiveSnapshot(double lat, double lng, Double speed, Double heading, Double accuracy,
                               long fixAtMs, double distanceMeters, double maxSpeedKmh, int overspeedCount) {}

    private final Map<Long, LiveState> live = new ConcurrentHashMap<>(); // session id → state

    private final VehicleSessionRepository sessionRepository;
    private final VehicleSessionRouteRepository sessionRouteRepository;
    private final VehicleSessionPointRepository pointRepository;
    private final VehicleRepository vehicleRepository;
    private final OrgRouteRepository routeRepository;
    private final OrgMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final OrgGuard guard;
    private final FleetBroadcaster broadcaster;
    private final NotificationService notificationService;
    private final OrgAuditService audit;
    private final VehicleAlertService alertService;
    private final ObjectMapper objectMapper;

    @PersistenceContext
    private EntityManager entityManager;

    public VehicleSessionService(VehicleSessionRepository sessionRepository,
                                 VehicleSessionRouteRepository sessionRouteRepository,
                                 VehicleSessionPointRepository pointRepository,
                                 VehicleRepository vehicleRepository,
                                 OrgRouteRepository routeRepository,
                                 OrgMemberRepository memberRepository,
                                 UserRepository userRepository,
                                 OrgGuard guard,
                                 FleetBroadcaster broadcaster,
                                 NotificationService notificationService,
                                 OrgAuditService audit,
                                 VehicleAlertService alertService,
                                 ObjectMapper objectMapper) {
        this.sessionRepository = sessionRepository;
        this.sessionRouteRepository = sessionRouteRepository;
        this.pointRepository = pointRepository;
        this.vehicleRepository = vehicleRepository;
        this.routeRepository = routeRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.guard = guard;
        this.broadcaster = broadcaster;
        this.notificationService = notificationService;
        this.audit = audit;
        this.alertService = alertService;
        this.objectMapper = objectMapper;
    }

    // ============================================================
    // START A TRIP
    // ============================================================
    @Transactional
    public DriverTrip start(Long userId, StartSessionRequest request) {
        if (request == null || request.orgId() == null || request.vehicleId() == null) {
            throw ApiException.badRequest("Choose a vehicle to start a trip");
        }
        Organization org = guard.requireOrg(request.orgId());
        guard.requireDriver(org, userId);

        Vehicle vehicle = vehicleRepository.findByIdAndOrgId(request.vehicleId(), org.getId())
                .orElseThrow(() -> ApiException.notFound("Vehicle not found"));
        if (!"ACTIVE".equals(vehicle.getStatus())) {
            throw ApiException.conflict(vehicle.getVehicleCode() + " is not available right now");
        }

        // Clear messages for the ordinary cases …
        sessionRepository.findFirstByDriverUserIdAndStatus(userId, ACTIVE).ifPresent(running -> {
            throw ApiException.conflict("You already have a trip in progress on " + running.getVehicleCode()
                    + ". End it before starting another.");
        });
        sessionRepository.findFirstByVehicleIdAndStatus(vehicle.getId(), ACTIVE).ifPresent(running -> {
            throw ApiException.conflict(vehicle.getVehicleCode() + " is in use by "
                    + running.getDriverName() + " right now.");
        });

        User driver = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));

        VehicleSession session = new VehicleSession();
        session.setOrgId(org.getId());
        session.setVehicleId(vehicle.getId());
        session.setVehicleCode(vehicle.getVehicleCode());
        session.setDriverUserId(userId);
        session.setDriverName(driver.getUsername() != null ? driver.getUsername() : "Driver");
        session.setStatus(ACTIVE);
        session.setStartedAt(LocalDateTime.now());

        String coordinates;
        String steps;
        String stopsJson = null;

        if (request.routeId() != null) {
            // A saved route: the trip gets its own copy, so later edits to
            // the route never change a trip that is already under way.
            OrgRoute route = routeRepository.findByIdAndOrgId(request.routeId(), org.getId())
                    .orElseThrow(() -> ApiException.notFound("That route no longer exists"));
            session.setRouteId(route.getId());
            session.setRouteName(route.getName());
            session.setFromName(route.getFromName());
            session.setFromLat(route.getFromLat());
            session.setFromLng(route.getFromLng());
            session.setDestinationName(route.getDestinationName());
            session.setDestinationLat(route.getDestinationLat());
            session.setDestinationLng(route.getDestinationLng());
            session.setPlannedDistanceMeters(route.getDistanceMeters());
            session.setPlannedDurationSeconds(route.getDurationSeconds());
            coordinates = route.getRouteCoordinates();
            steps = route.getRouteSteps();
            stopsJson = route.getStopsJson();
        } else {
            // A destination of the driver's own choosing.
            if (!GeoMath.validLatLng(request.destinationLat(), request.destinationLng())) {
                throw ApiException.badRequest("Choose a route or a destination for this trip");
            }
            boolean hasFrom = request.fromLat() != null || request.fromLng() != null;
            if (hasFrom && !GeoMath.validLatLng(request.fromLat(), request.fromLng())) {
                throw ApiException.badRequest("The starting point is not a valid location");
            }
            coordinates = limited(request.routeCoordinates(), MAX_ROUTE_CHARS, "This route is too long to save");
            steps = limited(request.routeSteps(), MAX_STEPS_CHARS, "This route has too many steps to save");
            session.setFromName(cleanName(request.fromName()));
            session.setFromLat(request.fromLat());
            session.setFromLng(request.fromLng());
            session.setDestinationName(cleanName(request.destinationName()));
            session.setDestinationLat(request.destinationLat());
            session.setDestinationLng(request.destinationLng());
            session.setPlannedDistanceMeters(GeoMath.nonNegative(request.distanceMeters()));
            session.setPlannedDurationSeconds(GeoMath.nonNegative(request.durationSeconds()));
        }

        // … and the database for the rare one: two starts at the same instant.
        session.setActiveVehicleKey(vehicle.getId());
        session.setActiveDriverKey(userId);
        VehicleSession saved;
        try {
            saved = sessionRepository.saveAndFlush(session);
        } catch (DataIntegrityViolationException e) {
            throw ApiException.conflict(vehicle.getVehicleCode()
                    + " was taken a moment ago, or you already started a trip. Refresh and try again.");
        }

        VehicleSessionRoute routeRow = null;
        if (coordinates != null || steps != null || stopsJson != null) {
            routeRow = sessionRouteRepository.save(
                    new VehicleSessionRoute(saved.getId(), coordinates, steps, stopsJson));
        }

        audit.record(org.getId(), userId, "trip.start",
                "started a trip on " + vehicle.getVehicleCode() + destinationWords(saved));

        LiveState state = new LiveState(saved, org.getSpeedLimitKmh());
        Tx.afterCommit(() -> {
            live.put(saved.getId(), state);
            broadcaster.publish(saved.getOrgId(), saved.getVehicleId(), event("session-started", saved));
        });

        return new DriverTrip(toDto(saved), toRouteDto(routeRow), org.getName(), vehicle.getVehicleType(),
                org.getSpeedLimitKmh());
    }

    // ============================================================
    // END A TRIP
    // ============================================================

    /** The driver ends their own trip. */
    @Transactional
    public SessionDto stop(Long sessionId, Long userId) {
        VehicleSession session = requireSession(sessionId);
        if (!session.getDriverUserId().equals(userId)) {
            throw ApiException.forbidden("Only the driver of this trip can end it");
        }
        return toDto(finish(session, "DRIVER", userId));
    }

    /** An admin ends a trip its driver did not (phone died, forgot to stop). */
    @Transactional
    public SessionDto forceEnd(Long sessionId, Long managerId) {
        VehicleSession session = requireSession(sessionId);
        guard.requireManager(session.getOrgId(), managerId);
        if (!session.isActive()) return toDto(session);
        return toDto(finish(session, "ADMIN", managerId));
    }

    /**
     * No position for too long (see VehicleSessionSweeper). Returns true
     * when the trip was ended. A trip whose device is still talking to the
     * server — standing still, or with a GPS signal too poor to use — is
     * left alone.
     */
    @Transactional
    public boolean endByTimeout(Long sessionId, long minutes) {
        LiveState state = live.get(sessionId);
        if (state != null && System.currentTimeMillis() - state.heardAt < minutes * 60_000L) return false;

        VehicleSession session = sessionRepository.findById(sessionId).orElse(null);
        if (session == null || !session.isActive()) return false;

        finish(session, "TIMEOUT", null);
        notificationService.notifyWithLink(session.getDriverUserId(), "vehicle_session_ended",
                "Trip ended automatically",
                "Your trip on " + session.getVehicleCode() + " was ended because nothing was received from your phone for "
                        + minutes + " minutes.",
                "/driver");
        return true;
    }

    /** A driver was removed or suspended: their running trip in that organization ends. */
    @Transactional
    public void endForDriver(Long orgId, Long driverUserId, String reason, Long actorUserId) {
        for (VehicleSession session : sessionRepository.findByOrgIdAndDriverUserIdAndStatus(orgId, driverUserId, ACTIVE)) {
            finish(session, reason, actorUserId);
        }
    }

    /** The account itself was suspended: whatever it is driving ends. */
    @Transactional
    public void endForUser(Long driverUserId, Long actorUserId) {
        sessionRepository.findFirstByDriverUserIdAndStatus(driverUserId, ACTIVE)
                .ifPresent(session -> finish(session, "REMOVED", actorUserId));
    }

    /** The organization was deleted or suspended: every running trip ends. */
    @Transactional
    public void endAllForOrg(Long orgId, String reason, Long actorUserId) {
        for (VehicleSession session : sessionRepository.findByOrgIdAndStatus(orgId, ACTIVE)) {
            finish(session, reason, actorUserId);
        }
    }

    /** Is this vehicle on a trip right now? */
    public VehicleSession activeForVehicle(Long vehicleId) {
        return sessionRepository.findFirstByVehicleIdAndStatus(vehicleId, ACTIVE).orElse(null);
    }

    // The one way a trip ends. Unlocks the vehicle and the driver, keeps
    // the last position on the vehicle, and tells everyone watching.
    private VehicleSession finish(VehicleSession session, String reason, Long actorUserId) {
        if (!session.isActive()) return session;

        // Whatever is still only in memory goes onto the row first.
        LiveState state = live.get(session.getId());
        if (state != null) {
            synchronized (state) {
                copyOnto(session, state);
            }
        }

        boolean moved = session.getLastLat() != null;
        session.setStatus(moved ? "COMPLETED" : "CANCELLED"); // never produced a position → not a trip
        session.setEndReason(reason);
        session.setEndedAt(LocalDateTime.now());
        if (session.getStartedAt() != null) {
            session.setDurationSeconds(Math.max(0,
                    java.time.Duration.between(session.getStartedAt(), session.getEndedAt()).getSeconds()));
        }
        session.setActiveVehicleKey(null);
        session.setActiveDriverKey(null);
        session.setSosActive(false);
        VehicleSession saved = sessionRepository.save(session);

        if (moved) {
            vehicleRepository.findById(saved.getVehicleId()).ifPresent(vehicle -> {
                vehicle.setLastLat(saved.getLastLat());
                vehicle.setLastLng(saved.getLastLng());
                vehicle.setLastLocationAt(saved.getLastLocationAt());
                vehicleRepository.save(vehicle);
            });
        }

        if ("ADMIN".equals(reason) && actorUserId != null && !actorUserId.equals(saved.getDriverUserId())) {
            notificationService.notifyWithLink(saved.getDriverUserId(), "vehicle_session_ended",
                    "Trip ended by an admin",
                    "Your trip on " + saved.getVehicleCode() + " was ended by an admin of your organization.",
                    "/driver");
        }
        audit.record(saved.getOrgId(), actorUserId, "trip.end", endWords(saved, reason));

        Tx.afterCommit(() -> {
            live.remove(saved.getId());
            Map<String, Object> payload = event("session-ended", saved);
            payload.put("reason", reason);
            broadcaster.publish(saved.getOrgId(), saved.getVehicleId(), payload);
        });
        return saved;
    }

    // ============================================================
    // POSITION — one GPS fix from the driver's device
    //
    // Returns true when the fix was used, false when it was ignored
    // (too soon after the last one, or too vague). Throws when the trip
    // is over or is not this person's, so the device stops sending.
    // ============================================================
    public boolean acceptPosition(Long sessionId, Long userId, PositionRequest fix) {
        if (sessionId == null || fix == null) throw ApiException.badRequest("A trip and a position are required");
        if (!GeoMath.validLatLng(fix.lat(), fix.lng())) throw ApiException.badRequest("Invalid GPS coordinates");

        LiveState state = stateFor(sessionId);
        if (state == null) throw ApiException.conflict("This trip has ended");
        if (state.driverUserId != userId) throw ApiException.forbidden("Only the driver of this trip can send its position");

        state.heardAt = System.currentTimeMillis();

        Double accuracy = GeoMath.nonNegative(fix.accuracy());
        if (accuracy != null && accuracy > IGNORE_ACCURACY_M) return false;
        boolean trusted = accuracy == null || accuracy <= TRUSTED_ACCURACY_M;

        Double speed = GeoMath.nonNegative(fix.speed());
        if (speed != null && speed > MAX_REPORTED_SPEED_MPS) speed = null;
        Double heading = fix.heading() == null || fix.heading().isNaN() || fix.heading().isInfinite()
                ? null : ((fix.heading() % 360) + 360) % 360;

        long now = System.currentTimeMillis();
        boolean persist;
        boolean addTrackPoint;
        Map<String, Object> payload;
        double lat = fix.lat();
        double lng = fix.lng();

        synchronized (state) {
            if (state.hasFix && now - state.fixAt < MIN_FIX_INTERVAL_MS) return false;

            if (state.hasFix) {
                double hop = GeoMath.distanceMeters(state.lat, state.lng, lat, lng);
                double seconds = (now - state.fixAt) / 1000.0;
                double hopSpeed = seconds > 0 ? hop / seconds : Double.MAX_VALUE;

                // A fix that would need an impossible speed is a GPS jump:
                // keep the last good position rather than teleport the marker.
                // But if the device keeps insisting on the new place, it is
                // the OLD position that was wrong (a bad first fix) — after
                // three in a row the vehicle is moved there, and that leap is
                // not counted as distance driven.
                boolean jump = hopSpeed > MAX_HOP_SPEED_MPS && hop > 150;
                if (jump && state.jumpsRefused < 3) {
                    state.jumpsRefused++;
                    return false;
                }
                state.jumpsRefused = 0;

                if (!jump) {
                    if (trusted && hop >= MIN_HOP_M) state.distance += hop;
                    if (speed == null && trusted && seconds >= 1 && seconds <= 30) {
                        speed = hop < MIN_HOP_M ? 0.0 : hopSpeed;
                    }
                }
            }

            state.lat = lat;
            state.lng = lng;
            state.speed = speed;
            state.heading = heading != null ? heading : state.heading;
            state.accuracy = accuracy;
            state.fixAt = now;
            boolean first = !state.hasFix;
            state.hasFix = true;

            if (speed != null && trusted) {
                double kmh = speed * 3.6;
                if (kmh > state.maxSpeedKmh) state.maxSpeedKmh = kmh;
                Integer limit = state.speedLimitKmh;
                if (limit != null && limit > 0) {
                    // Counted once per stretch over the limit, with a little
                    // slack either side so GPS noise does not count it twice.
                    if (kmh > limit + 3) {
                        if (!state.overspeeding) {
                            state.overspeeding = true;
                            state.overspeedCount++;
                        }
                    } else if (kmh < limit - 2) {
                        state.overspeeding = false;
                    }
                }
            }

            persist = first || now - state.lastPersistAt >= PERSIST_INTERVAL_MS;
            addTrackPoint = false;
            if (persist) {
                state.lastPersistAt = now;
                if (state.trackPoints < MAX_TRACK_POINTS && trusted) {
                    boolean farEnough = !state.hasTrackPoint
                            || GeoMath.distanceMeters(state.trackLat, state.trackLng, lat, lng) >= TRACK_MIN_DISTANCE_M;
                    boolean longAgo = state.hasTrackPoint && now - state.trackAt >= TRACK_MAX_GAP_MS
                            && GeoMath.distanceMeters(state.trackLat, state.trackLng, lat, lng) >= MIN_HOP_M;
                    if (farEnough || longAgo) {
                        addTrackPoint = true;
                        state.hasTrackPoint = true;
                        state.trackLat = lat;
                        state.trackLng = lng;
                        state.trackAt = now;
                        state.trackPoints++;
                    }
                }
            }

            payload = positionEvent(state);
        }

        // 3. everyone watching sees it now
        broadcaster.publish(state.orgId, state.vehicleId, payload);

        // 4. the database every few seconds
        if (persist) persist(state, addTrackPoint);
        return true;
    }

    /**
     * "Still here" from the driver's device when it has no position to
     * report (no GPS signal inside a depot or a tunnel). It claims nothing
     * about where the vehicle is — people watching still see the signal as
     * lost — but the trip is not mistaken for an abandoned one.
     */
    public void touch(Long sessionId, Long userId) {
        LiveState state = sessionId == null ? null : stateFor(sessionId);
        if (state == null) throw ApiException.conflict("This trip has ended");
        if (state.driverUserId != userId) throw ApiException.forbidden("Only the driver of this trip can do that");
        state.heardAt = System.currentTimeMillis();
    }

    private void persist(LiveState state, boolean addTrackPoint) {
        double lat;
        double lng;
        Double speed;
        Double heading;
        Double accuracy;
        double distance;
        double maxSpeed;
        int overspeed;
        synchronized (state) {
            lat = state.lat;
            lng = state.lng;
            speed = state.speed;
            heading = state.heading;
            accuracy = state.accuracy;
            distance = state.distance;
            maxSpeed = state.maxSpeedKmh;
            overspeed = state.overspeedCount;
        }
        LocalDateTime at = LocalDateTime.now();
        try {
            int updated = sessionRepository.updateLivePosition(state.sessionId, lat, lng, speed, heading, accuracy,
                    at, distance, maxSpeed, overspeed);
            if (updated == 0) {
                // Ended meanwhile (an admin, the sweeper): nothing more to store.
                live.remove(state.sessionId);
                return;
            }
            if (addTrackPoint) {
                pointRepository.save(new VehicleSessionPoint(state.sessionId, lat, lng,
                        speed == null ? null : speed * 3.6, at));
            }
            alertService.onPosition(state.sessionId, state.orgId, state.vehicleId, state.vehicleCode, lat, lng);
        } catch (Exception e) {
            // The live broadcast already happened; the next write catches up.
            log.warn("Could not store the position of trip #{}: {}", state.sessionId, e.getMessage());
        }
    }

    // The live state of a running trip — from memory, or rebuilt from the
    // database after a restart. Null when the trip is not running.
    private LiveState stateFor(Long sessionId) {
        LiveState state = live.get(sessionId);
        if (state != null) return state;

        VehicleSession session = sessionRepository.findById(sessionId).orElse(null);
        if (session == null || !session.isActive()) return null;
        Integer limit = guard.requireOrg(session.getOrgId()).getSpeedLimitKmh();
        return live.computeIfAbsent(sessionId, id -> new LiveState(session, limit));
    }

    /** The organization changed its speed limit: running trips use the new one at once. */
    public void speedLimitChanged(Long orgId, Integer speedLimitKmh) {
        live.values().forEach(state -> {
            if (state.orgId == orgId) {
                synchronized (state) {
                    state.speedLimitKmh = speedLimitKmh;
                    state.overspeeding = false;
                }
            }
        });
    }

    /** The newest in-memory position of a running trip, or null. */
    public LiveSnapshot snapshot(Long sessionId) {
        LiveState state = sessionId == null ? null : live.get(sessionId);
        if (state == null) return null;
        synchronized (state) {
            if (!state.hasFix) return null;
            return new LiveSnapshot(state.lat, state.lng, state.speed, state.heading, state.accuracy,
                    state.fixAt, state.distance, state.maxSpeedKmh, state.overspeedCount);
        }
    }

    // ============================================================
    // SOS and seats — set by the driver during a trip
    // ============================================================

    /**
     * Raise or clear an emergency. The driver raises it; the driver or an
     * admin clears it. Admins are notified, the map shows it at once, and
     * everyone tracking the vehicle sees a notice.
     */
    @Transactional
    public SessionDto setSos(Long sessionId, Long userId, boolean active, String message) {
        VehicleSession session = requireSession(sessionId);
        if (!session.isActive()) throw ApiException.conflict("This trip has ended");

        boolean isDriver = session.getDriverUserId().equals(userId);
        boolean isManager = guard.isManager(session.getOrgId(), userId);
        if (active && !isDriver) throw ApiException.forbidden("Only the driver can raise an emergency");
        if (!active && !isDriver && !isManager) throw ApiException.forbidden("You cannot change this trip");
        if (Boolean.TRUE.equals(session.getSosActive()) == active) return toDto(session); // nothing to change

        String note = message == null ? null : message.trim();
        if (note != null && note.length() > 200) note = note.substring(0, 200);

        session.setSosActive(active);
        session.setSosAt(active ? LocalDateTime.now() : session.getSosAt());
        session.setSosMessage(active ? (note == null || note.isEmpty() ? null : note) : null);
        VehicleSession saved = sessionRepository.save(session);

        if (active) {
            List<Long> managers = new ArrayList<>();
            for (OrgMember member : memberRepository.findByOrgIdAndStatusAndRoleIn(
                    saved.getOrgId(), ACTIVE, List.of("OWNER", "ADMIN"))) {
                if (!member.getUserId().equals(userId)) managers.add(member.getUserId());
            }
            notificationService.notifyManyWithLink(managers, "vehicle_sos",
                    "Emergency on " + saved.getVehicleCode(),
                    saved.getDriverName() + " raised an emergency"
                            + (saved.getSosMessage() != null ? ": " + saved.getSosMessage() : "."),
                    "/org-admin/" + saved.getOrgId() + "/map?vehicle=" + saved.getVehicleId());
        }
        audit.record(saved.getOrgId(), userId, active ? "trip.sos" : "trip.sos.clear",
                active ? "raised an emergency on " + saved.getVehicleCode()
                        : "cleared the emergency on " + saved.getVehicleCode());

        Tx.afterCommit(() -> {
            Map<String, Object> payload = event("sos", saved);
            payload.put("active", active);
            payload.put("message", saved.getSosMessage());
            broadcaster.publish(saved.getOrgId(), saved.getVehicleId(), payload);
        });
        return toDto(saved);
    }

    /** How full the vehicle is: UNKNOWN | LOW | MEDIUM | FULL. */
    @Transactional
    public SessionDto setCrowd(Long sessionId, Long userId, String level) {
        VehicleSession session = requireSession(sessionId);
        if (!session.isActive()) throw ApiException.conflict("This trip has ended");
        if (!session.getDriverUserId().equals(userId)) {
            throw ApiException.forbidden("Only the driver of this trip can update this");
        }
        String value = level == null ? "" : level.trim().toUpperCase();
        if (!List.of("UNKNOWN", "LOW", "MEDIUM", "FULL").contains(value)) {
            throw ApiException.badRequest("Unknown seat level");
        }
        session.setCrowdLevel(value);
        VehicleSession saved = sessionRepository.save(session);
        Tx.afterCommit(() -> {
            Map<String, Object> payload = event("crowd", saved);
            payload.put("level", value);
            broadcaster.publish(saved.getOrgId(), saved.getVehicleId(), payload);
        });
        return toDto(saved);
    }

    // ============================================================
    // READ
    // ============================================================

    /** The trip this person is driving right now, with its road — or null. */
    public DriverTrip myActiveTrip(Long userId) {
        VehicleSession session = sessionRepository.findFirstByDriverUserIdAndStatus(userId, ACTIVE).orElse(null);
        if (session == null) return null;
        Organization org = guard.requireOrg(session.getOrgId());
        String vehicleType = vehicleRepository.findById(session.getVehicleId())
                .map(Vehicle::getVehicleType).orElse("OTHER");
        return new DriverTrip(toDto(session), routeOf(session.getId()), org.getName(), vehicleType,
                org.getSpeedLimitKmh());
    }

    /** Light version for the navigation ("you have a trip in progress"). */
    public SessionDto myActiveSummary(Long userId) {
        return sessionRepository.findFirstByDriverUserIdAndStatus(userId, ACTIVE).map(this::toDto).orElse(null);
    }

    /** One trip with the path it really took — for its driver and for the organization's admins. */
    public SessionTrack track(Long sessionId, Long userId) {
        VehicleSession session = requireSession(sessionId);
        if (!session.getDriverUserId().equals(userId)) guard.requireManager(session.getOrgId(), userId);

        List<TrackPoint> points = pointRepository.findBySessionIdOrderByRecordedAtAsc(sessionId).stream()
                .map(p -> new TrackPoint(p.getLat(), p.getLng(), p.getSpeedKmh(), p.getRecordedAt()))
                .toList();
        return new SessionTrack(toDto(session), routeOf(sessionId), points);
    }

    /** Past and running trips of an organization, newest first (admins only). */
    public PageDto<SessionDto> history(Long orgId, Long userId, Long vehicleId, Long driverId,
                                       String status, int page, int size) {
        guard.requireOrg(orgId);
        guard.requireManager(orgId, userId);
        return query(" WHERE s.orgId = :orgId", Map.of("orgId", orgId), vehicleId, driverId, status, page, size);
    }

    /** The trips this person has driven, in every organization. */
    public PageDto<SessionDto> myHistory(Long userId, int page, int size) {
        return query(" WHERE s.driverUserId = :me", Map.of("me", userId), null, null, null, page, size);
    }

    private PageDto<SessionDto> query(String baseWhere, Map<String, Object> baseParams,
                                      Long vehicleId, Long driverId, String status, int page, int size) {
        int pageSize = Math.max(1, Math.min(size, 100));
        int pageIndex = Math.max(0, page);

        StringBuilder where = new StringBuilder(baseWhere);
        Map<String, Object> params = new HashMap<>(baseParams);
        if (vehicleId != null) { where.append(" AND s.vehicleId = :vehicleId"); params.put("vehicleId", vehicleId); }
        if (driverId != null) { where.append(" AND s.driverUserId = :driverId"); params.put("driverId", driverId); }
        if (status != null && !status.isBlank()) {
            where.append(" AND s.status = :status");
            params.put("status", status.trim().toUpperCase());
        }

        TypedQuery<VehicleSession> rows = entityManager.createQuery(
                "SELECT s FROM VehicleSession s" + where + " ORDER BY s.startedAt DESC", VehicleSession.class);
        TypedQuery<Long> count = entityManager.createQuery(
                "SELECT COUNT(s) FROM VehicleSession s" + where, Long.class);
        params.forEach((name, value) -> { rows.setParameter(name, value); count.setParameter(name, value); });

        long total = count.getSingleResult();
        List<SessionDto> items = rows.setFirstResult(pageIndex * pageSize).setMaxResults(pageSize)
                .getResultList().stream().map(this::toDto).toList();
        return new PageDto<>(items, total, pageIndex, pageSize, (int) Math.ceil(total / (double) pageSize));
    }

    // ============================================================
    // MAPPING
    // ============================================================

    /** A trip as the API returns it; a running trip shows its newest in-memory figures. */
    public SessionDto toDto(VehicleSession s) {
        LiveSnapshot now = s.isActive() ? snapshot(s.getId()) : null;
        return new SessionDto(
                s.getId(), s.getOrgId(), s.getVehicleId(), s.getVehicleCode(),
                s.getDriverUserId(), s.getDriverName(),
                s.getRouteId(), s.getRouteName(),
                s.getFromName(), s.getFromLat(), s.getFromLng(),
                s.getDestinationName(), s.getDestinationLat(), s.getDestinationLng(),
                s.getStatus(), s.getEndReason(),
                s.getStartedAt(), s.getEndedAt(),
                now != null ? Double.valueOf(now.distanceMeters()) : s.getDistanceMeters(),
                s.getPlannedDistanceMeters(), s.getPlannedDurationSeconds(),
                now != null ? Double.valueOf(now.maxSpeedKmh()) : s.getMaxSpeedKmh(),
                now != null ? Integer.valueOf(now.overspeedCount()) : s.getOverspeedCount(),
                now != null ? Double.valueOf(now.lat()) : s.getLastLat(),
                now != null ? Double.valueOf(now.lng()) : s.getLastLng(),
                s.getLastLocationAt(),
                s.getCrowdLevel(), Boolean.TRUE.equals(s.getSosActive()), s.getSosMessage());
    }

    /** The planned road of a trip, or null when none was stored. */
    public SessionRouteDto routeOf(Long sessionId) {
        return toRouteDto(sessionRouteRepository.findById(sessionId).orElse(null));
    }

    private SessionRouteDto toRouteDto(VehicleSessionRoute row) {
        if (row == null) return null;
        return new SessionRouteDto(row.getRouteCoordinates(), row.getRouteSteps(), readStops(row.getStopsJson()));
    }

    List<StopDto> readStops(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<StopDto>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private VehicleSession requireSession(Long sessionId) {
        if (sessionId == null) throw ApiException.badRequest("A trip is required");
        return sessionRepository.findById(sessionId)
                .orElseThrow(() -> ApiException.notFound("Trip not found"));
    }

    private static void copyOnto(VehicleSession session, LiveState state) {
        session.setDistanceMeters(state.distance);
        session.setMaxSpeedKmh(state.maxSpeedKmh);
        session.setOverspeedCount(state.overspeedCount);
        if (state.hasFix) {
            session.setLastLat(state.lat);
            session.setLastLng(state.lng);
            session.setLastSpeed(state.speed);
            session.setLastHeading(state.heading);
            session.setLastAccuracy(state.accuracy);
            session.setLastLocationAt(
                    LocalDateTime.ofInstant(Instant.ofEpochMilli(state.fixAt), ZoneId.systemDefault()));
        }
    }

    // ── Live events (never carry personal data — details come from the API) ──

    private static Map<String, Object> event(String type, VehicleSession s) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("orgId", s.getOrgId());
        payload.put("vehicleId", s.getVehicleId());
        payload.put("sessionId", s.getId());
        return payload;
    }

    private static Map<String, Object> positionEvent(LiveState state) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "position");
        payload.put("orgId", state.orgId);
        payload.put("vehicleId", state.vehicleId);
        payload.put("sessionId", state.sessionId);
        payload.put("lat", state.lat);
        payload.put("lng", state.lng);
        payload.put("speed", state.speed);
        payload.put("heading", state.heading);
        payload.put("accuracy", state.accuracy);
        payload.put("at", state.fixAt);
        payload.put("distanceMeters", state.distance);
        return payload;
    }

    // ── Words ──

    private static String destinationWords(VehicleSession s) {
        if (s.getRouteName() != null) return " (" + s.getRouteName() + ")";
        if (s.getDestinationName() != null) return " to " + shortName(s.getDestinationName());
        return "";
    }

    private static String endWords(VehicleSession s, String reason) {
        String what = "the trip on " + s.getVehicleCode();
        return switch (reason) {
            case "DRIVER" -> "ended " + what;
            case "ADMIN" -> "ended " + what + " (driven by " + s.getDriverName() + ")";
            case "TIMEOUT" -> "ended " + what + " automatically — no location was received";
            case "REMOVED" -> "ended " + what + " — its driver is no longer active";
            default -> "ended " + what;
        };
    }

    private static String shortName(String name) {
        int comma = name.indexOf(',');
        return comma > 0 ? name.substring(0, comma) : name;
    }

    private static String cleanName(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return null;
        return trimmed.length() > MAX_NAME ? trimmed.substring(0, MAX_NAME) : trimmed;
    }

    private static String limited(String value, int max, String tooLong) {
        if (value == null || value.isBlank()) return null;
        if (value.length() > max) throw ApiException.badRequest(tooLong);
        return value;
    }
}
