package vehicle.ridewise.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import vehicle.ridewise.dto.RideParticipantResponse;
import vehicle.ridewise.dto.RideRequest;
import vehicle.ridewise.dto.RideResponse;
import vehicle.ridewise.entity.Ride;
import vehicle.ridewise.entity.RideParticipant;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.repository.ConnectionRepository;
import vehicle.ridewise.repository.RideParticipantRepository;
import vehicle.ridewise.repository.RideRepository;
import vehicle.ridewise.repository.UserRepository;
import vehicle.ridewise.websocket.RideLocationBroadcaster;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

// ============================================================
// RideService — rides and their riders
//
// RULES ENFORCED HERE (never trusted to the client)
//   • a ride is ended only by its owner (solo) or its admin (group)
//   • a member can only leave as themself; the admin ends instead
//   • riders are added to a group ride only by its admin, and only
//     from the admin's own connections
//   • every value of a new ride is validated and sized before it is saved
//
// REAL-TIME
//   When a ride ends, or its riders change, everyone watching it over the
//   ride socket is told at once ("ride-ended", "participants-changed") —
//   after the database transaction has committed, so a client that reacts
//   immediately always reads the new state.
// ============================================================
@Service
public class RideService {

    private static final int MAX_NAME_LENGTH = 255;       // column size of from_name / destination_name
    private static final int MAX_ROUTE_CHARS = 4_000_000; // ≈ a 2,000 km route at full detail
    private static final int MAX_STEPS_CHARS = 2_000_000;
    private static final int MAX_GROUP_SIZE = 50;

    private final RideRepository rideRepository;
    private final RideParticipantRepository rideParticipantRepository;
    private final NotificationService notificationService;
    private final DataCleanupService dataCleanupService;
    private final UserRepository userRepository;
    private final ConnectionRepository connectionRepository;
    private final UserLocationService userLocationService;
    private final RideLocationBroadcaster broadcaster;

    public RideService(RideRepository rideRepository,
                       RideParticipantRepository rideParticipantRepository,
                       NotificationService notificationService,
                       DataCleanupService dataCleanupService,
                       UserRepository userRepository,
                       ConnectionRepository connectionRepository,
                       UserLocationService userLocationService,
                       RideLocationBroadcaster broadcaster) {
        this.rideRepository = rideRepository;
        this.rideParticipantRepository = rideParticipantRepository;
        this.notificationService = notificationService;
        this.dataCleanupService = dataCleanupService;
        this.userRepository = userRepository;
        this.connectionRepository = connectionRepository;
        this.userLocationService = userLocationService;
        this.broadcaster = broadcaster;
    }

    // ============================================================
    // CREATE
    // ============================================================
    @Transactional // ride + participants + notifications succeed or fail together
    public RideResponse createRide(RideRequest req) {
        Long ownerId = req.getUserId();
        if (ownerId == null) throw ApiException.badRequest("Authenticated user is required");

        String rideType = req.getRideType();
        if (!"solo".equals(rideType) && !"group".equals(rideType)) {
            throw ApiException.badRequest("Ride type must be solo or group");
        }

        // Place names come from a geocoder and can be longer than the column.
        // Trimmed to fit, instead of failing the whole ride with a SQL error.
        String fromName = cleanName(req.getFromName());
        String destinationName = cleanName(req.getDestinationName());
        if (fromName == null || destinationName == null
                || !validCoordinate(req.getFromLat(), req.getFromLng())
                || !validCoordinate(req.getDestinationLat(), req.getDestinationLng())) {
            throw ApiException.badRequest("Ride start and destination are required");
        }
        if (tooLong(req.getRouteCoordinates(), MAX_ROUTE_CHARS) || tooLong(req.getRouteSteps(), MAX_STEPS_CHARS)) {
            throw ApiException.badRequest("This route is too long to save. Try a shorter ride.");
        }

        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> ApiException.notFound("User not found"));

        // Invited riders: no nulls, no duplicates, never the owner
        Set<Long> participantIds = new LinkedHashSet<>();
        if (req.getParticipantIds() != null) {
            for (Long id : req.getParticipantIds()) {
                if (id != null && !id.equals(ownerId)) participantIds.add(id);
            }
        }

        if ("group".equals(rideType)) {
            if (participantIds.isEmpty()) {
                throw ApiException.badRequest("Select at least one friend for a group ride");
            }
            if (participantIds.size() + 1 > MAX_GROUP_SIZE) {
                throw ApiException.badRequest("A group ride can have at most " + MAX_GROUP_SIZE + " riders");
            }
            for (Long participantId : participantIds) {
                User invited = userRepository.findById(participantId)
                        .orElseThrow(() -> ApiException.notFound("Selected rider not found"));
                if (Boolean.FALSE.equals(invited.getEnabled())) {
                    throw ApiException.badRequest("One of the selected riders is not available");
                }
                if (!areConnected(ownerId, participantId)) {
                    throw ApiException.badRequest("You can only add connected friends to a group ride");
                }
            }
        }

        Ride ride = new Ride();
        ride.setUserId(ownerId);
        ride.setFromName(fromName);
        ride.setFromLat(req.getFromLat());
        ride.setFromLng(req.getFromLng());
        ride.setDestinationName(destinationName);
        ride.setDestinationLat(req.getDestinationLat());
        ride.setDestinationLng(req.getDestinationLng());
        ride.setRouteCoordinates(blankToNull(req.getRouteCoordinates()));
        ride.setRouteSteps(blankToNull(req.getRouteSteps()));
        ride.setDistanceMeters(nonNegative(req.getDistanceMeters()));
        ride.setDurationSeconds(nonNegative(req.getDurationSeconds()));
        ride.setRideType(rideType);
        ride.setStatus("active");
        Ride saved = rideRepository.save(ride);

        if ("group".equals(rideType)) {
            saveParticipant(saved.getId(), ownerId, "admin");

            String ownerName = owner.getUsername() != null ? owner.getUsername() : "Someone";
            String message = ownerName + " invited you to a group ride from " + fromName + " to " + destinationName;
            for (Long participantId : participantIds) {
                saveParticipant(saved.getId(), participantId, "member");
                notificationService.createNotification(
                        participantId, "group_ride_invite", "Group ride invitation", message, saved.getId());
            }
        }

        RideResponse response = RideResponse.from(saved);
        attachGroupData(List.of(response));
        return response;
    }

    private void saveParticipant(Long rideId, Long userId, String role) {
        RideParticipant participant = new RideParticipant();
        participant.setRideId(rideId);
        participant.setUserId(userId);
        participant.setRole(role);
        participant.setStatus("active");
        rideParticipantRepository.save(participant);
    }

    // ============================================================
    // READ
    // ============================================================

    // A rider's rides — the ones they created plus the group rides they are
    // part of — newest first.
    //
    // summary = true returns lightweight rows without the route geometry
    // (each carries hasRoute instead). That is what the app's ride list
    // uses; the full route is fetched with getRide() when a ride is opened.
    @Transactional(readOnly = true)
    public List<RideResponse> getUserRides(Long userId, boolean summary) {
        List<Long> joined = rideParticipantRepository.findVisibleRideIdsByUserId(userId);
        Collection<Long> rideIds = joined.isEmpty() ? List.of(-1L) : joined; // IN () must not be empty

        List<RideResponse> rides = summary
                ? rideRepository.findSummariesForUser(userId, rideIds)
                : rideRepository.findAllForUser(userId, rideIds).stream()
                        .map(RideResponse::from)
                        .collect(Collectors.toList());

        attachGroupData(rides);
        return rides;
    }

    @Transactional(readOnly = true)
    public List<RideResponse> getActiveRides(Long userId) {
        return getUserRides(userId, true).stream()
                .filter(ride -> "active".equals(ride.getStatus()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public RideResponse getRide(Long rideId, Long userId, boolean summary) {
        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> ApiException.notFound("Ride not found"));
        assertRideAccess(ride, userId);
        RideResponse response = summary ? RideResponse.summaryOf(ride) : RideResponse.from(ride);
        attachGroupData(List.of(response));
        return response;
    }

    // Fill `participants` and `creatorUsername` for every GROUP ride in the
    // list with two queries in total — however many rides there are. (The
    // old code ran two queries per ride.)
    //
    //   active ride → riders currently in it
    //   ended ride  → everyone who rode it (those who left are not listed)
    private void attachGroupData(List<RideResponse> rides) {
        List<Long> groupRideIds = rides.stream()
                .filter(ride -> "group".equals(ride.getRideType()))
                .map(RideResponse::getId)
                .collect(Collectors.toList());
        if (groupRideIds.isEmpty()) return;

        List<RideParticipant> participants = rideParticipantRepository.findByRideIdIn(groupRideIds);
        Map<Long, User> users = usersById(participants.stream()
                .map(RideParticipant::getUserId)
                .collect(Collectors.toSet()));
        Map<Long, List<RideParticipant>> byRide = participants.stream()
                .collect(Collectors.groupingBy(RideParticipant::getRideId));

        for (RideResponse ride : rides) {
            if (!"group".equals(ride.getRideType())) continue;
            List<RideParticipant> ofRide = byRide.getOrDefault(ride.getId(), List.of());
            boolean active = "active".equals(ride.getStatus());

            ride.setParticipants(ofRide.stream()
                    .filter(p -> active
                            ? "active".equals(p.getStatus())
                            : !"left".equals(p.getStatus()) && !"declined".equals(p.getStatus()))
                    .map(p -> RideParticipantResponse.from(p, users.get(p.getUserId())))
                    .collect(Collectors.toList()));

            ofRide.stream()
                    .filter(p -> "admin".equals(p.getRole()))
                    .findFirst()
                    .map(p -> users.get(p.getUserId()))
                    .ifPresent(admin -> ride.setCreatorUsername(admin.getUsername()));
        }
    }

    private Map<Long, User> usersById(Collection<Long> ids) {
        if (ids.isEmpty()) return Map.of();
        return userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, user -> user));
    }

    // ACTIVE riders of a ride (the live map)
    @Transactional(readOnly = true)
    public List<RideParticipantResponse> getParticipants(Long rideId, Long userId) {
        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> ApiException.notFound("Ride not found"));
        assertRideAccess(ride, userId);

        List<RideParticipant> active = rideParticipantRepository.findByRideId(rideId).stream()
                .filter(p -> "active".equals(p.getStatus()))
                .collect(Collectors.toList());
        Map<Long, User> users = usersById(active.stream()
                .map(RideParticipant::getUserId)
                .collect(Collectors.toSet()));
        return active.stream()
                .map(p -> RideParticipantResponse.from(p, users.get(p.getUserId())))
                .collect(Collectors.toList());
    }

    private void assertRideAccess(Ride ride, Long userId) {
        if (Objects.equals(ride.getUserId(), userId)) return;
        boolean participant = rideParticipantRepository.findByRideIdAndUserId(ride.getId(), userId).isPresent();
        if (!participant) throw ApiException.forbidden("You are not a participant in this ride");
    }

    // ============================================================
    // END A RIDE
    // ============================================================
    @Transactional
    public RideResponse updateStatus(Long rideId, String status, Long actorUserId, Double actualDistanceMeters) {
        if (actorUserId == null) throw ApiException.badRequest("Authenticated user is required");
        if (!"completed".equals(status) && !"cancelled".equals(status)) {
            throw ApiException.badRequest("Ride status can only be changed to completed or cancelled");
        }

        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> ApiException.notFound("Ride not found"));
        if (!"active".equals(ride.getStatus())) {
            throw ApiException.badRequest("Only an active ride can be ended");
        }

        if ("group".equals(ride.getRideType())) {
            if (!isActiveAdmin(ride, actorUserId)) {
                throw ApiException.forbidden("Only the ride admin can end this group ride");
            }
        } else if (!Objects.equals(ride.getUserId(), actorUserId)) {
            throw ApiException.forbidden("Only the ride owner can end this ride");
        }

        return finish(ride, status, actualDistanceMeters, actorUserId);
    }

    // End a ride that was left "active" long ago (see StaleRideSweeper).
    // A system action: there is no acting rider and no reported distance.
    @Transactional
    public void endAbandonedRide(Long rideId) {
        rideRepository.findById(rideId)
                .filter(ride -> "active".equals(ride.getStatus()))
                .ifPresent(ride -> finish(ride, "completed", null, null));
    }

    private RideResponse finish(Ride ride, String status, Double actualDistanceMeters, Long actorUserId) {
        Long rideId = ride.getId();
        ride.setStatus(status);
        ride.setEndedAt(LocalDateTime.now());

        // The distance really ridden, reported by the client when the ride
        // ends. Stored only for completed rides and only when it is sane.
        Double distance = nonNegative(actualDistanceMeters);
        if ("completed".equals(status) && distance != null) {
            ride.setActualDistanceMeters(distance);
        }
        Ride saved = rideRepository.save(ride);

        if ("group".equals(saved.getRideType())) {
            List<RideParticipant> participants = rideParticipantRepository.findByRideId(rideId);
            String route = saved.getFromName() + " to " + saved.getDestinationName();
            for (RideParticipant participant : participants) {
                if (!"active".equals(participant.getStatus())) continue;
                participant.setStatus("completed");
                // Tell the other riders, including those not looking at the map
                if (!Objects.equals(participant.getUserId(), actorUserId)) {
                    notificationService.createNotification(participant.getUserId(), "group_ride_ended",
                            "Group ride ended", "The group ride from " + route + " has ended", rideId);
                }
            }
            rideParticipantRepository.saveAll(participants);
        }

        // GPS breadcrumbs and live positions have served their purpose —
        // the distance is saved on the ride itself.
        dataCleanupService.cleanupRideLocationData(rideId);

        announceRideEnded(rideId, status, actorUserId);

        RideResponse response = RideResponse.from(saved);
        attachGroupData(List.of(response));
        return response;
    }

    // ============================================================
    // DELETE
    // ============================================================
    @Transactional
    public void deleteRide(Long rideId, Long actorUserId) {
        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> ApiException.notFound("Ride not found"));
        if (!Objects.equals(ride.getUserId(), actorUserId)) {
            throw ApiException.forbidden("group".equals(ride.getRideType())
                    ? "Only the group ride admin can delete this shared ride"
                    : "Only the ride owner can delete this ride");
        }

        boolean wasActive = "active".equals(ride.getStatus());

        // Everything that points at the ride goes with it: GPS history, live
        // positions (no ghost markers), riders, and notifications that would
        // otherwise open a ride that no longer exists.
        dataCleanupService.cleanupRideLocationData(rideId);
        rideParticipantRepository.deleteByRideId(rideId);
        notificationService.deleteForRide(rideId);
        rideRepository.deleteById(rideId);

        // Riders still on the map of a ride that was deleted mid-way
        if (wasActive) announceRideEnded(rideId, "deleted", actorUserId);
    }

    // ============================================================
    // GROUP MEMBERSHIP
    // ============================================================

    // A non-admin ACTIVE participant leaves themself. Members cannot end
    // the ride via this route; the admin uses updateStatus().
    @Transactional
    public void updateParticipantStatus(Long rideId, Long userId, String status, Long actorUserId) {
        if (!"left".equals(status)) {
            throw ApiException.badRequest("Members can only leave a ride via this endpoint; the admin ends the ride via the ride status endpoint");
        }
        if (actorUserId == null) {
            throw ApiException.badRequest("actorUserId is required");
        }
        if (!actorUserId.equals(userId)) {
            throw ApiException.forbidden("You can only leave a ride as yourself");
        }
        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> ApiException.notFound("Ride not found"));
        RideParticipant participant = rideParticipantRepository.findByRideIdAndUserId(rideId, userId)
                .orElseThrow(() -> ApiException.notFound("Participant not found in this ride"));
        if (!"active".equals(participant.getStatus())) {
            throw ApiException.badRequest("Participant is not active in this ride");
        }
        if ("admin".equals(participant.getRole())) {
            throw ApiException.forbidden("The ride admin cannot leave; end the ride instead");
        }
        participant.setStatus("left");
        rideParticipantRepository.save(participant);

        // Their marker must not stay on the others' maps
        userLocationService.clearLocation(rideId, userId);

        User leaver = userRepository.findById(userId).orElse(null);
        String leaverName = leaver != null && leaver.getUsername() != null ? leaver.getUsername() : "A rider";
        notificationService.createNotification(ride.getUserId(), "group_ride_member_left",
                "A rider left your ride", leaverName + " left your group ride", rideId);

        announceParticipantsChanged(rideId);
    }

    // Only the ACTIVE admin of an ACTIVE group ride can add a rider, and
    // only one of their own connections. Re-adding someone who left
    // re-activates them; adding an already-active rider is a conflict.
    @Transactional
    public RideParticipantResponse addParticipant(Long rideId, Long adminId, Long userId) {
        if (adminId == null || userId == null) {
            throw ApiException.badRequest("adminId and userId are required");
        }
        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> ApiException.notFound("Ride not found"));
        if (!"group".equals(ride.getRideType())) {
            throw ApiException.badRequest("Participants can only be added to group rides");
        }
        if (!"active".equals(ride.getStatus())) {
            throw ApiException.badRequest("Ride is not active");
        }
        if (!isActiveAdmin(ride, adminId)) {
            throw ApiException.forbidden("Only the ride admin can add riders to this group ride");
        }
        if (adminId.equals(userId)) {
            throw ApiException.badRequest("You are already the ride admin");
        }
        User addedUser = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
        if (Boolean.FALSE.equals(addedUser.getEnabled())) {
            throw ApiException.badRequest("This rider is not available");
        }
        if (!areConnected(adminId, userId)) {
            throw ApiException.badRequest("You can only add connected friends to a group ride");
        }

        RideParticipant participant = rideParticipantRepository.findByRideIdAndUserId(rideId, userId).orElse(null);
        if (participant != null) {
            if ("active".equals(participant.getStatus())) {
                throw ApiException.conflict("User is already an active participant in this ride");
            }
            // Rejoin: re-activate a rider who previously left
            participant.setStatus("active");
            participant.setRole("member");
        } else {
            long riders = rideParticipantRepository.findByRideId(rideId).stream()
                    .filter(p -> "active".equals(p.getStatus()))
                    .count();
            if (riders >= MAX_GROUP_SIZE) {
                throw ApiException.badRequest("A group ride can have at most " + MAX_GROUP_SIZE + " riders");
            }
            participant = new RideParticipant();
            participant.setRideId(rideId);
            participant.setUserId(userId);
            participant.setRole("member");
            participant.setStatus("active");
        }
        participant = rideParticipantRepository.save(participant);

        User adminUser = userRepository.findById(adminId).orElse(null);
        String adminName = adminUser != null && adminUser.getUsername() != null ? adminUser.getUsername() : "Someone";
        notificationService.createNotification(userId, "group_ride_invite", "Group ride invitation",
                adminName + " added you to a group ride from " + ride.getFromName() + " to " + ride.getDestinationName(),
                rideId);

        announceParticipantsChanged(rideId);
        return RideParticipantResponse.from(participant, addedUser);
    }

    // Active admin = ACTIVE participant row with role "admin", or the ride owner.
    private boolean isActiveAdmin(Ride ride, Long userId) {
        RideParticipant participant = rideParticipantRepository.findByRideIdAndUserId(ride.getId(), userId).orElse(null);
        if (participant != null) {
            return "admin".equals(participant.getRole()) && "active".equals(participant.getStatus());
        }
        // Group rides created before admins had a participant row: the owner counts
        return Objects.equals(ride.getUserId(), userId);
    }

    // Connected in EITHER direction (both are written, but older rows may
    // exist in only one).
    private boolean areConnected(Long userId, Long otherUserId) {
        return connectionRepository.existsByUserIdAndConnectedUserId(userId, otherUserId)
                || connectionRepository.existsByUserIdAndConnectedUserId(otherUserId, userId);
    }

    // ============================================================
    // REAL-TIME ANNOUNCEMENTS (sent after the transaction commits)
    // ============================================================
    private void announceRideEnded(Long rideId, String status, Long endedBy) {
        Map<String, Object> payload = new HashMap<>(); // HashMap: endedBy may be null
        payload.put("type", "ride-ended");
        payload.put("rideId", rideId);
        payload.put("status", status);
        payload.put("endedBy", endedBy);
        afterCommit(() -> {
            broadcaster.broadcast(rideId, payload);
            broadcaster.closeRide(rideId);
        });
    }

    private void announceParticipantsChanged(Long rideId) {
        afterCommit(() -> broadcaster.broadcast(rideId,
                Map.of("type", "participants-changed", "rideId", rideId)));
    }

    private static void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    // ============================================================
    // INPUT HELPERS
    // ============================================================
    private static String cleanName(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return null;
        return trimmed.length() > MAX_NAME_LENGTH ? trimmed.substring(0, MAX_NAME_LENGTH) : trimmed;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static boolean tooLong(String value, int max) {
        return value != null && value.length() > max;
    }

    private static boolean validCoordinate(Double lat, Double lng) {
        return lat != null && lng != null && !lat.isNaN() && !lng.isNaN()
                && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    }

    // A finite number >= 0, or null when it is anything else
    private static Double nonNegative(Double value) {
        if (value == null || value.isNaN() || value.isInfinite() || value < 0) return null;
        return value;
    }
}
