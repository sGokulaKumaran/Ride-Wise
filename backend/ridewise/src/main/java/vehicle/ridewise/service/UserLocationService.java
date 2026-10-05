package vehicle.ridewise.service; // Package declaration

import org.springframework.stereotype.Service; // Import Service annotation
import vehicle.ridewise.dto.LiveLocationResponse; // Import response DTO
import vehicle.ridewise.entity.Ride; // Import Ride entity
import vehicle.ridewise.entity.UserLocation; // Import UserLocation entity
import vehicle.ridewise.exception.ApiException; // Import ApiException
import vehicle.ridewise.repository.RideParticipantRepository; // Membership lookup
import vehicle.ridewise.repository.RideRepository; // Ride lookup
import vehicle.ridewise.repository.UserLocationRepository; // Latest location lookup
import vehicle.ridewise.websocket.RideLocationBroadcaster; // WebSocket fan-out

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// ============================================================
// UserLocationService — live group-ride location logic
//
// This is the single source of truth for "where is each rider right now".
// Both transports call into it:
//   • REST  POST /api/rides/{rideId}/location
//   • WS    { "type": "location", ... }
//
// For every accepted fix it:
//   1. validates the coordinates,
//   2. proves the ride is active and the user belongs to it,
//   3. UPSERTS the one user_locations row (never a row per tick),
//   4. broadcasts the new position to that ride's WebSocket group only.
// ============================================================
@Service
public class UserLocationService {

    // A rider's app sends a position every ~1.5 s. Anything arriving faster
    // than this is dropped before it reaches the database or the group — a
    // buggy or hostile client cannot flood either.
    private static final long MIN_UPDATE_INTERVAL_MS = 250;

    // userId → time of the last accepted position
    private final Map<Long, Long> lastAccepted = new java.util.concurrent.ConcurrentHashMap<>();

    private final UserLocationRepository userLocationRepository;
    private final RideRepository rideRepository;
    private final RideParticipantRepository rideParticipantRepository;
    private final RideLocationBroadcaster broadcaster;

    public UserLocationService(UserLocationRepository userLocationRepository,
                               RideRepository rideRepository,
                               RideParticipantRepository rideParticipantRepository,
                               RideLocationBroadcaster broadcaster) {
        this.userLocationRepository = userLocationRepository;
        this.rideRepository = rideRepository;
        this.rideParticipantRepository = rideParticipantRepository;
        this.broadcaster = broadcaster;
    }

    // ============================================================
    // UPDATE LOCATION — accept one GPS fix, store it as "latest",
    // then push it to everyone in the same group ride.
    //
    // requireActiveParticipant = true: only an ACTIVE member (or the ride
    // owner) may publish a position. A rider who left is rejected.
    // ============================================================
    @org.springframework.transaction.annotation.Transactional
    public LiveLocationResponse updateLocation(Long rideId, Long userId,
                                               Double lat, Double lng, Double accuracy) {
        if (userId == null) {
            throw ApiException.badRequest("Authenticated user is required");
        }
        if (rideId == null) {
            throw ApiException.badRequest("rideId is required");
        }
        if (lat == null || lat.isNaN() || lat < -90 || lat > 90
                || lng == null || lng.isNaN() || lng < -180 || lng > 180) {
            throw ApiException.badRequest("Invalid GPS coordinates");
        }
        // Accuracy is informational; a nonsensical value is simply not stored.
        if (accuracy != null && (accuracy.isNaN() || accuracy.isInfinite() || accuracy < 0)) {
            accuracy = null;
        }

        // Too soon after the previous one → ignore (see MIN_UPDATE_INTERVAL_MS)
        long now = System.currentTimeMillis();
        Long previous = lastAccepted.get(userId);
        if (previous != null && now - previous < MIN_UPDATE_INTERVAL_MS) {
            return null;
        }

        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> ApiException.notFound("Ride not found"));
        if (!"active".equals(ride.getStatus())) {
            throw ApiException.badRequest("Cannot share location for an inactive ride");
        }

        // Live latest-location sharing is a GROUP-ride feature. Solo rides keep
        // posting GPS history to location_updates, but must not create a live
        // location row (requirement 1: track only while in a group ride).
        if (!"group".equals(ride.getRideType())) {
            return null;
        }

        // ── Requirement 4: backend proves membership BEFORE accepting ──
        assertRideAccess(ride, userId, true);

        // ── Requirement 5: UPDATE the existing row, never insert per tick ──
        UserLocation ul = userLocationRepository.findByUserId(userId)
                .orElseGet(UserLocation::new);
        ul.setUserId(userId);
        ul.setRideId(rideId);
        ul.setLat(lat);
        ul.setLng(lng);
        ul.setAccuracy(accuracy);
        UserLocation saved = userLocationRepository.save(ul);
        lastAccepted.put(userId, now);

        LiveLocationResponse res = LiveLocationResponse.from(saved);

        // ── Requirement 6: broadcast only to THIS ride's members ──
        broadcaster.broadcast(rideId, Map.of("type", "location", "location", res));

        return res;
    }

    // ============================================================
    // STOP SHARING — the rider turned location sharing OFF.
    //
    // Deletes the rider's single latest-location row so no ghost marker
    // survives, then tells the rest of the group to drop that marker
    // immediately instead of waiting for the staleness timeout.
    //
    // Only the rider's OWN row is ever touched, and only when it belongs
    // to this ride. Membership is checked, but NOT active-ness: a rider
    // who just left the ride must still be able to remove their position.
    // ============================================================
    public void clearLocation(Long rideId, Long userId) {
        if (userId == null) {
            throw ApiException.badRequest("Authenticated user is required");
        }
        if (rideId == null) return; // nothing to clear

        Ride ride = rideRepository.findById(rideId).orElse(null);
        if (ride == null) return; // ride already gone → nothing to broadcast

        // Live positions only exist for group rides (see updateLocation).
        if (!"group".equals(ride.getRideType())) return;

        assertRideAccess(ride, userId, false);

        lastAccepted.remove(userId);

        UserLocation row = userLocationRepository.findByUserId(userId).orElse(null);
        if (row != null && rideId.equals(row.getRideId())) {
            userLocationRepository.delete(row);
            // ── Tell only THIS ride's members to remove the marker ──
            broadcaster.broadcast(rideId, Map.of(
                    "type", "location-cleared",
                    "rideId", rideId,
                    "userId", userId));
        }
    }

    // ============================================================
    // GET LIVE LOCATIONS — every current position for a ride.
    // Used when the map opens, before WebSocket updates take over.
    // Any member (or the owner) may read; outsiders are rejected.
    // ============================================================
    public List<LiveLocationResponse> getLiveLocations(Long rideId, Long requesterId) {
        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> ApiException.notFound("Ride not found"));
        assertRideAccess(ride, requesterId, false);

        return userLocationRepository.findByRideId(rideId)
                .stream()
                .map(LiveLocationResponse::from)
                .collect(Collectors.toList());
    }

    // ============================================================
    // CAN SUBSCRIBE — the WebSocket "subscribe" authorization check.
    // True only when the ride exists, is active, and the user is a
    // member (owner or active participant).
    // ============================================================
    public boolean canSubscribe(Long rideId, Long userId) {
        if (rideId == null || userId == null) return false;
        try {
            Ride ride = rideRepository.findById(rideId).orElse(null);
            if (ride == null || !"active".equals(ride.getStatus())) return false;
            assertRideAccess(ride, userId, true);
            return true;
        } catch (ApiException e) {
            return false;
        }
    }

    // ============================================================
    // ACCESS CHECK — identical rule to LocationUpdateService:
    // allowed if the user owns the ride, otherwise they must have a
    // ride_participants row. When requireActiveParticipant is true the
    // row must also be status "active".
    // ============================================================
    private void assertRideAccess(Ride ride, Long userId, boolean requireActiveParticipant) {
        if (userId == null) {
            throw ApiException.forbidden("You are not a participant in this ride");
        }
        if (ride.getUserId().equals(userId)) return;

        boolean allowed = rideParticipantRepository.findByRideIdAndUserId(ride.getId(), userId)
                .map(p -> !requireActiveParticipant || "active".equals(p.getStatus()))
                .orElse(false);
        if (!allowed) {
            throw ApiException.forbidden("You are not an active participant in this ride");
        }
    }
} // End of class
