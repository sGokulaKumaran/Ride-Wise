package vehicle.ridewise.service; // Package declaration

import org.springframework.stereotype.Service; // Import Service annotation
import vehicle.ridewise.repository.RideRepository; // Import RideRepository
import vehicle.ridewise.entity.Ride; // Import Ride entity
import vehicle.ridewise.dto.RideRequest; // Import RideRequest dto
import vehicle.ridewise.dto.RideResponse; // Import RideResponse dto
import vehicle.ridewise.repository.LocationUpdateRepository; // Import LocationUpdateRepository
import java.util.List; // Import List
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors; // Import Collectors
import vehicle.ridewise.repository.RideParticipantRepository;
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
    private final UserRepository userRepository;

    public RideService(RideRepository rideRepository, LocationUpdateRepository locationUpdateRepository,
                       RideParticipantRepository rideParticipantRepository, NotificationService notificationService,
                       UserRepository userRepository) {
        this.rideRepository = rideRepository;
        this.locationUpdateRepository = locationUpdateRepository;
        this.rideParticipantRepository = rideParticipantRepository;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    } // End constructor

    public RideResponse createRide(RideRequest req) { // Create ride method
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
        if ("group".equals(req.getRideType()) && req.getParticipantIds() != null && !req.getParticipantIds().isEmpty()) {
            RideParticipant admin = new RideParticipant();
            admin.setRideId(saved.getId());
            admin.setUserId(req.getUserId());
            admin.setRole("admin");
            admin.setStatus("active");
            rideParticipantRepository.save(admin);
            
            User adminUser = userRepository.findById(req.getUserId()).orElse(null);
            String adminUsername = adminUser != null ? adminUser.getUsername() : "Someone";
            
            for (Long participantId : req.getParticipantIds()) {
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
        List<Long> activeRideIds = rideParticipantRepository.findActiveRideIdsByUserId(userId);
        List<Ride> participantRides = activeRideIds.isEmpty() ? new ArrayList<>() : rideRepository.findByIdInOrderByCreatedAtDesc(activeRideIds);
        
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

    public RideResponse updateStatus(Long rideId, String status) { // Update status method
        Ride ride = rideRepository.findById(rideId) // Find ride
                .orElseThrow(() -> new RuntimeException("Ride not found")); // Throw if not found
        ride.setStatus(status); // Set status
        if ("completed".equals(status) || "cancelled".equals(status)) { // Check status
            ride.setEndedAt(LocalDateTime.now()); // Set endedAt
        } // End if
        Ride saved = rideRepository.save(ride); // Save changes
        return RideResponse.from(saved); // Return DTO
    } // End method

    public void deleteRide(Long rideId) { // Delete ride method
        locationUpdateRepository.deleteByRideId(rideId);
        rideParticipantRepository.deleteByRideId(rideId);
        rideRepository.deleteById(rideId); // Delete by ID
    } // End method

    public RideResponse getRide(Long rideId) { // Get ride method
        Ride ride = rideRepository.findById(rideId) // Find ride
                .orElseThrow(() -> new RuntimeException("Ride not found")); // Throw if not found
        RideResponse resp = RideResponse.from(ride); // Return DTO
        if ("group".equals(ride.getRideType())) {
            populateGroupRideData(resp);
        }
        return resp;
    } // End method
    
    private void populateGroupRideData(RideResponse response) {
        if ("group".equals(response.getRideType())) {
            List<RideParticipantResponse> participantResponses = getParticipants(response.getId());
            response.setParticipants(participantResponses);
            
            for (RideParticipantResponse pr : participantResponses) {
                if ("admin".equals(pr.getRole())) {
                    response.setCreatorUsername(pr.getUsername());
                    break;
                }
            }
        }
    }

    public List<RideParticipantResponse> getParticipants(Long rideId) {
        List<RideParticipant> participants = rideParticipantRepository.findByRideId(rideId);
        return participants.stream().map(p -> {
            User u = userRepository.findById(p.getUserId()).orElse(null);
            return RideParticipantResponse.from(p, u);
        }).collect(Collectors.toList());
    }

    public void updateParticipantStatus(Long rideId, Long userId, String status) {
        RideParticipant participant = rideParticipantRepository.findByRideIdAndUserId(rideId, userId).orElse(null);
        if (participant != null) {
            participant.setStatus(status);
            rideParticipantRepository.save(participant);
        }
    }
} // End of class
