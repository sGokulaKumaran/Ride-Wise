package vehicle.ridewise.service; // Package declaration

import org.springframework.stereotype.Service; // Import Service annotation
import org.springframework.transaction.annotation.Transactional; // Import Transactional
import vehicle.ridewise.repository.RideRepository; // Import RideRepository
import vehicle.ridewise.entity.Ride; // Import Ride entity
import vehicle.ridewise.dto.RideRequest; // Import RideRequest dto
import vehicle.ridewise.dto.RideResponse; // Import RideResponse dto
import vehicle.ridewise.exception.ApiException; // Import ApiException
import vehicle.ridewise.repository.LocationUpdateRepository; // Import LocationUpdateRepository
import java.util.List; // Import List
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.stream.Collectors; // Import Collectors
import vehicle.ridewise.repository.RideParticipantRepository;
import vehicle.ridewise.repository.ConnectionRepository;
import vehicle.ridewise.repository.UserRepository;
import vehicle.ridewise.entity.RideParticipant;
import vehicle.ridewise.dto.RideParticipantResponse;
import vehicle.ridewise.entity.User;
import java.time.LocalDateTime; // Import LocalDateTime

@Service // Mark as service
public class RideService { // Define class

    private final RideRepository rideRepository;
    private final LocationUpdateRepository locationUpdateRepository;
    private final RideParticipantRepository rideParticipantRepository;
    private final NotificationService notificationService;
    private final DataCleanupService dataCleanupService;
    private final UserRepository userRepository;
    private final ConnectionRepository connectionRepository;

    public RideService(RideRepository rideRepository, LocationUpdateRepository locationUpdateRepository,
                       RideParticipantRepository rideParticipantRepository, NotificationService notificationService,
                       DataCleanupService dataCleanupService,
                       UserRepository userRepository, ConnectionRepository connectionRepository) {
        this.rideRepository = rideRepository;
        this.locationUpdateRepository = locationUpdateRepository;
        this.rideParticipantRepository = rideParticipantRepository;
        this.notificationService = notificationService;
        this.dataCleanupService = dataCleanupService;
        this.userRepository = userRepository;
        this.connectionRepository = connectionRepository;
    } // End constructor

    @Transactional // Multi-write: ride + participants + notifications
    public RideResponse createRide(RideRequest req) { // Create ride method
        if (req.getUserId() == null) throw ApiException.badRequest("Authenticated user is required");
        if (!"solo".equals(req.getRideType()) && !"group".equals(req.getRideType())) {
            throw ApiException.badRequest("Ride type must be solo or group");
        }
        if (req.getFromName() == null || req.getFromName().isBlank() ||
                req.getDestinationName() == null || req.getDestinationName().isBlank() ||
                req.getFromLat() == null || req.getFromLng() == null ||
                req.getDestinationLat() == null || req.getDestinationLng() == null) {
            throw ApiException.badRequest("Ride start and destination are required");
        }

        User adminUser = userRepository.findById(req.getUserId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        List<Long> participantIds = req.getParticipantIds() != null
                ? req.getParticipantIds().stream()
                    .filter(id -> id != null && !id.equals(req.getUserId()))
                    .collect(Collectors.collectingAndThen(Collectors.toCollection(LinkedHashSet::new), List::copyOf))
                : List.of();

        if ("group".equals(req.getRideType())) {
            if (participantIds.isEmpty()) throw ApiException.badRequest("Select at least one friend for a group ride");
            for (Long participantId : participantIds) {
                if (participantId == null || participantId.equals(req.getUserId())) continue;
                if (!userRepository.existsById(participantId)) throw ApiException.notFound("Selected rider not found");
                if (!areConnected(req.getUserId(), participantId)) {
                    throw ApiException.badRequest("You can only add connected friends to a group ride");
                }
            }
        }

        Ride ride = new Ride(); // Create entity
        ride.setUserId(req.getUserId()); // Set user ID
        ride.setFromName(req.getFromName()); // Set from name
        ride.setFromLat(req.getFromLat()); // Set from lat
        ride.setFromLng(req.getFromLng()); // Set from lng
        ride.setDestinationName(req.getDestinationName()); // Set dest name
        ride.setDestinationLat(req.getDestinationLat()); // Set dest lat
        ride.setDestinationLng(req.getDestinationLng()); // Set dest lng
        ride.setRouteCoordinates(req.getRouteCoordinates()); // Set route
        ride.setRouteSteps(req.getRouteSteps()); // Set route steps (turn-by-turn navigation)
        ride.setDistanceMeters(req.getDistanceMeters()); // Set distance
        ride.setDurationSeconds(req.getDurationSeconds()); // Set duration
        ride.setRideType(req.getRideType()); // Set type
        ride.setStatus("active"); // Set default status
        Ride saved = rideRepository.save(ride); // Save entity
        RideResponse response = RideResponse.from(saved); // Return DTO
        if ("group".equals(req.getRideType())) { // Group ride: register admin + members
            RideParticipant admin = new RideParticipant();
            admin.setRideId(saved.getId());
            admin.setUserId(req.getUserId());
            admin.setRole("admin");
            admin.setStatus("active");
            rideParticipantRepository.save(admin);

            String adminUsername = adminUser.getUsername() != null ? adminUser.getUsername() : "Someone";

            // Dedupe participant IDs and skip the admin's own ID (already added above)
            for (Long participantId : new LinkedHashSet<>(participantIds)) {
                if (participantId == null || participantId.equals(req.getUserId())) {
                    continue;
                }
                RideParticipant member = new RideParticipant();
                member.setRideId(saved.getId());
                member.setUserId(participantId);
                member.setRole("member");
                member.setStatus("active");
                rideParticipantRepository.save(member);

                String message = adminUsername + " invited you to a group ride from " + req.getFromName() + " to " + req.getDestinationName();
                notificationService.createNotification(participantId, "group_ride_invite", "Group Ride Invitation", message, saved.getId());
            }
            populateGroupRideData(response);
        }
        return response;
    } // End method

    public List<RideResponse> getUserRides(Long userId) { // Get user rides method
        List<Ride> userRides = rideRepository.findByUserIdOrderByCreatedAtDesc(userId);
        List<Long> visibleRideIds = rideParticipantRepository.findVisibleRideIdsByUserId(userId);
        List<Ride> participantRides = visibleRideIds.isEmpty() ? new ArrayList<>() : rideRepository.findByIdInOrderByCreatedAtDesc(visibleRideIds);
        
        Map<Long, Ride> uniqueRides = new LinkedHashMap<>();
        for (Ride r : userRides) {
            uniqueRides.put(r.getId(), r);
        }
        for (Ride r : participantRides) {
            uniqueRides.putIfAbsent(r.getId(), r);
        }
        
        List<Ride> allRides = new ArrayList<>(uniqueRides.values());
        allRides.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
        
        return allRides.stream().map(r -> {
            RideResponse resp = RideResponse.from(r);
            if ("group".equals(r.getRideType())) {
                populateGroupRideData(resp);
            }
            return resp;
        }).collect(Collectors.toList());
    } // End method

    public List<RideResponse> getActiveRides(Long userId) { // Get active rides method
        List<Ride> activeRides = rideRepository.findByUserIdAndStatus(userId, "active");
        List<Long> activeRideIds = rideParticipantRepository.findActiveRideIdsByUserId(userId);
        List<Ride> activeParticipantRides = activeRideIds.isEmpty() ? new ArrayList<>() : rideRepository.findByIdInOrderByCreatedAtDesc(activeRideIds)
                .stream().filter(r -> "active".equals(r.getStatus())).collect(Collectors.toList());
        
        Map<Long, Ride> uniqueRides = new LinkedHashMap<>();
        for (Ride r : activeRides) {
            uniqueRides.put(r.getId(), r);
        }
        for (Ride r : activeParticipantRides) {
            uniqueRides.putIfAbsent(r.getId(), r);
        }
        
        return uniqueRides.values().stream().map(r -> {
            RideResponse resp = RideResponse.from(r);
            if ("group".equals(r.getRideType())) {
                populateGroupRideData(resp);
            }
            return resp;
        }).collect(Collectors.toList());
    } // End method

    public RideResponse updateStatus(Long rideId, String status) { // Legacy entry point (no actor check)
        return updateStatus(rideId, status, null, null); // Delegate with null actor + no distance
    } // End method

    public RideResponse updateStatus(Long rideId, String status, Long actorUserId) { // Backwards-compatible entry point
        return updateStatus(rideId, status, actorUserId, null); // Delegate without travelled distance
    } // End method

    @Transactional // Multi-write: ride (+ participant statuses on group end)
    public RideResponse updateStatus(Long rideId, String status, Long actorUserId, Double actualDistanceMeters) { // Update status method
        if (actorUserId == null) throw ApiException.badRequest("Authenticated user is required");
        if (!"completed".equals(status) && !"cancelled".equals(status)) {
            throw ApiException.badRequest("Ride status can only be changed to completed or cancelled");
        }

        Ride ride = rideRepository.findById(rideId) // Find ride
                .orElseThrow(() -> ApiException.notFound("Ride not found")); // Throw if not found
        if (!"active".equals(ride.getStatus())) {
            throw ApiException.badRequest("Only an active ride can be ended");
        }

        if ("group".equals(ride.getRideType())) {
            if (!isActiveAdmin(ride, actorUserId)) {
                throw ApiException.forbidden("Only the ride admin can end this group ride");
            }
        } else if (!ride.getUserId().equals(actorUserId)) {
            throw ApiException.forbidden("Only the ride owner can end this ride");
        }

        ride.setStatus(status); // Set status
        ride.setEndedAt(LocalDateTime.now()); // Set endedAt

        // Real travelled distance reported by the client when the ride ends
        // (route-accurate, GPS-noise filtered). Stored only for completed rides
        // and only when it is a sane, non-negative number.
        if ("completed".equals(status)
                && actualDistanceMeters != null
                && !actualDistanceMeters.isNaN()
                && !actualDistanceMeters.isInfinite()
                && actualDistanceMeters >= 0) {
            ride.setActualDistanceMeters(actualDistanceMeters); // Persist real distance
        }

        Ride saved = rideRepository.save(ride); // Save changes

        if ("group".equals(saved.getRideType())) {
            List<RideParticipant> all = rideParticipantRepository.findByRideId(rideId);
            for (RideParticipant participant : all) {
                if ("active".equals(participant.getStatus())) participant.setStatus("completed");
            }
            rideParticipantRepository.saveAll(all);
        }

        RideResponse response = RideResponse.from(saved); // Return DTO
        if ("group".equals(saved.getRideType())) populateGroupRideData(response, true);

        // Clean up GPS breadcrumbs — they've served their purpose.
        // The actual distance is already saved on the ride row.
        dataCleanupService.cleanupRideLocationData(rideId);

        return response; // Return DTO
    } // End method

    @Transactional // Multi-write: location updates + participants + ride
    public void deleteRide(Long rideId, Long actorUserId) { // Delete ride method
        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> ApiException.notFound("Ride not found"));
        if ("group".equals(ride.getRideType())) {
            if (!ride.getUserId().equals(actorUserId)) {
                throw ApiException.forbidden("Only the group ride admin can delete this shared ride");
            }
        } else if (!ride.getUserId().equals(actorUserId)) {
            throw ApiException.forbidden("Only the ride owner can delete this ride");
        }
        locationUpdateRepository.deleteByRideId(rideId);
        rideParticipantRepository.deleteByRideId(rideId);
        rideRepository.deleteById(rideId); // Delete by ID
    } // End method

    public RideResponse getRide(Long rideId, Long userId) { // Get ride method
        Ride ride = rideRepository.findById(rideId) // Find ride
                .orElseThrow(() -> ApiException.notFound("Ride not found")); // Throw if not found
        assertRideAccess(ride, userId);
        RideResponse resp = RideResponse.from(ride); // Return DTO
        if ("group".equals(ride.getRideType())) {
            populateGroupRideData(resp, !"active".equals(ride.getStatus()));
        }
        return resp;
    } // End method
    
    private void populateGroupRideData(RideResponse response) {
        populateGroupRideData(response, false);
    }

    private void populateGroupRideData(RideResponse response, boolean includeInactive) {
        if (!"group".equals(response.getRideType())) return;
        List<RideParticipantResponse> participantResponses = includeInactive
                ? getAllParticipants(response.getId())
                : getParticipants(response.getId());
        response.setParticipants(participantResponses);

        for (RideParticipantResponse pr : participantResponses) {
            if ("admin".equals(pr.getRole())) {
                response.setCreatorUsername(pr.getUsername());
                break;
            }
        }
    }

    public List<RideParticipantResponse> getParticipants(Long rideId) {
        // Only ACTIVE participants are returned (used by the live map + active RideResponse).
        return getAllParticipants(rideId).stream()
                .filter(p -> "active".equals(p.getStatus()))
                .collect(Collectors.toList());
    }

    public List<RideParticipantResponse> getParticipants(Long rideId, Long userId) {
        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> ApiException.notFound("Ride not found"));
        assertRideAccess(ride, userId);
        return getParticipants(rideId);
    }

    private List<RideParticipantResponse> getAllParticipants(Long rideId) {
        List<RideParticipant> participants = rideParticipantRepository.findByRideId(rideId);
        List<Long> userIds = participants.stream().map(RideParticipant::getUserId).collect(Collectors.toList());
        Map<Long, User> users = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
        return participants.stream()
                .map(p -> RideParticipantResponse.from(p, users.get(p.getUserId())))
                .collect(Collectors.toList());
    }

    private void assertRideAccess(Ride ride, Long userId) {
        if (ride.getUserId().equals(userId)) return;
        boolean participant = rideParticipantRepository.findByRideIdAndUserId(ride.getId(), userId).isPresent();
        if (!participant) throw ApiException.forbidden("You are not a participant in this ride");
    }

    // ── MEMBER LEAVE ─────────────────────────────────────────
    // A non-admin ACTIVE participant leaves themself. Members cannot end the
    // ride via this route; the admin must use PATCH /api/rides/{id}/status.
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

        // Notify the ride admin that a member left (same transaction)
        User leaver = userRepository.findById(userId).orElse(null);
        String leaverName = leaver != null ? leaver.getUsername() : "A rider";
        notificationService.createNotification(ride.getUserId(), "group_ride_member_left",
                "Rider Left Group Ride", leaverName + " left your group ride", rideId);
    }

    // ── LIVE ADD RIDER (ADMIN ONLY) ──────────────────────────
    // Only the ACTIVE admin of an ACTIVE group ride can add a rider.
    // The rider must exist and be a connected friend (either direction).
    // Re-adding a participant who left/declined re-activates them; adding an
    // already-active participant is rejected as a duplicate.
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
        if (!areConnected(adminId, userId)) {
            throw ApiException.badRequest("You can only add connected friends to a group ride");
        }

        RideParticipant participant = rideParticipantRepository.findByRideIdAndUserId(rideId, userId).orElse(null);
        if (participant != null) {
            if ("active".equals(participant.getStatus())) {
                throw ApiException.conflict("User is already an active participant in this ride");
            }
            // Rejoin: re-activate a participant who previously left/declined/was pending
            participant.setStatus("active");
            participant.setRole("member");
            participant = rideParticipantRepository.save(participant);
        } else {
            participant = new RideParticipant();
            participant.setRideId(rideId);
            participant.setUserId(userId);
            participant.setRole("member");
            participant.setStatus("active");
            participant = rideParticipantRepository.save(participant);
        }

        User adminUser = userRepository.findById(adminId).orElse(null);
        String adminUsername = adminUser != null ? adminUser.getUsername() : "Someone";
        String message = adminUsername + " added you to a group ride from " + ride.getFromName() + " to " + ride.getDestinationName();
        notificationService.createNotification(userId, "group_ride_invite", "Group Ride Invitation", message, rideId);

        return RideParticipantResponse.from(participant, addedUser);
    }

    // Active admin = ACTIVE participant row with role "admin", or the ride owner.
    private boolean isActiveAdmin(Ride ride, Long userId) {
        RideParticipant participant = rideParticipantRepository.findByRideIdAndUserId(ride.getId(), userId).orElse(null);
        if (participant != null) {
            return "admin".equals(participant.getRole()) && "active".equals(participant.getStatus());
        }
        // Fallback for legacy group rides with no admin participant row: ride owner counts as admin
        return ride.getUserId() != null && ride.getUserId().equals(userId);
    }

    // Friendship check — connected in EITHER direction (canonical connections logic
    // writes both directions, but legacy rows may exist in only one).
    private boolean areConnected(Long userId, Long otherUserId) {
        return connectionRepository.existsByUserIdAndConnectedUserId(userId, otherUserId)
                || connectionRepository.existsByUserIdAndConnectedUserId(otherUserId, userId);
    }
} // End of class
