package vehicle.ridewise;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import vehicle.ridewise.entity.Connection;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.repository.*;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// ============================================================
// RideFlowTests — focused MockMvc tests for the group-ride role flow:
//   • admin-only group ride end          (PATCH /api/rides/{id}/status)
//   • member self-leave                  (PATCH .../participants/{userId}/status)
//   • live admin add-rider               (POST .../participants)
//   • active-only participant filtering  (GET .../participants)
//   • GPS writer validation              (POST .../location)
//   • legacy compatibility               (no userId → old behavior)
// ============================================================
@SpringBootTest
@AutoConfigureMockMvc
class RideFlowTests {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired RideRepository rideRepository;
    @Autowired RideParticipantRepository participantRepository;
    @Autowired ConnectionRepository connectionRepository;
    @Autowired NotificationRepository notificationRepository;
    @Autowired LocationUpdateRepository locationUpdateRepository;

    private Long adminId;   // user A — group ride admin
    private Long memberId;  // user B — group ride member + friend of A
    private Long friendId;  // user C — friend of A, not yet in ride
    private Long strangerId;// user D — exists, NOT connected to A

    @BeforeEach
    void setUp() {
        notificationRepository.deleteAll();
        locationUpdateRepository.deleteAll();
        participantRepository.deleteAll();
        rideRepository.deleteAll();
        connectionRepository.deleteAll();
        userRepository.deleteAll();

        adminId    = saveUser("admin1", "admin1@test.com");
        memberId   = saveUser("member1", "member1@test.com");
        friendId   = saveUser("friend1", "friend1@test.com");
        strangerId = saveUser("stranger1", "stranger1@test.com");

        // Canonical bidirectional connections: A↔B and A↔C (D is a stranger)
        connect(adminId, memberId);
        connect(adminId, friendId);
    }

    // ── helpers ──────────────────────────────────────────────
    private Long saveUser(String username, String email) {
        User u = new User();
        u.setUsername(username);
        u.setEmail(email);
        u.setPassword("pw");
        return userRepository.save(u).getId();
    }

    private void connect(Long a, Long b) {
        Connection c1 = new Connection();
        c1.setUserId(a); c1.setConnectedUserId(b);
        connectionRepository.save(c1);
        Connection c2 = new Connection();
        c2.setUserId(b); c2.setConnectedUserId(a);
        connectionRepository.save(c2);
    }

    private String json(Map<String, Object> body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }

    private Long createRide(Long userId, String rideType, List<Long> participantIds) throws Exception {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("userId", userId);
        body.put("rideType", rideType);
        body.put("fromName", "Chennai");
        body.put("fromLat", 13.08);
        body.put("fromLng", 80.27);
        body.put("destinationName", "Vellore");
        body.put("destinationLat", 12.91);
        body.put("destinationLng", 79.13);
        if (participantIds != null) body.put("participantIds", participantIds);
        MvcResult res = mockMvc.perform(post("/api/rides")
                        .contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode node = objectMapper.readTree(res.getResponse().getContentAsString());
        return node.get("id").asLong();
    }

    // ── 1. ADMIN-ONLY GROUP RIDE END ─────────────────────────
    @Test
    void groupRideEnd_adminOnly_memberForbidden_legacyNoUserIdStillWorks() throws Exception {
        Long rideId = createRide(adminId, "group", List.of(memberId));

        // Member cannot end the group ride
        mockMvc.perform(patch("/api/rides/" + rideId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("status", "completed", "userId", memberId.toString()))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only the ride admin can end this group ride"))
                .andExpect(jsonPath("$.error").exists()); // legacy error key retained

        // Ride must still be active after the forbidden attempt
        mockMvc.perform(get("/api/rides/" + rideId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("active"));

        // Admin can end the group ride
        mockMvc.perform(patch("/api/rides/" + rideId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("status", "completed", "userId", adminId.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("completed"));

        // Legacy compatibility: no userId → old unchecked behavior
        Long ride2 = createRide(adminId, "group", List.of(memberId));
        mockMvc.perform(patch("/api/rides/" + ride2 + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("status", "completed"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("completed"));
    }

    // ── 2. MEMBER SELF-LEAVE ─────────────────────────────────
    @Test
    void memberLeave_selfOnly_leftOnly_adminBlockedFromLeaving() throws Exception {
        Long rideId = createRide(adminId, "group", List.of(memberId));

        // Member cannot END the ride via the participant route
        mockMvc.perform(patch("/api/rides/" + rideId + "/participants/" + memberId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("status", "completed", "actorUserId", memberId.toString()))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());

        // Member cannot leave on behalf of someone else (actor != target)
        mockMvc.perform(patch("/api/rides/" + rideId + "/participants/" + memberId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("status", "left", "actorUserId", adminId.toString()))))
                .andExpect(status().isForbidden());

        // Admin cannot leave via this route (must end the ride instead)
        mockMvc.perform(patch("/api/rides/" + rideId + "/participants/" + adminId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("status", "left", "actorUserId", adminId.toString()))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("The ride admin cannot leave; end the ride instead"));

        // Member leaves themself → OK
        mockMvc.perform(patch("/api/rides/" + rideId + "/participants/" + memberId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("status", "left", "actorUserId", memberId.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // GET participants returns ACTIVE members only → member is gone, admin remains
        MvcResult res = mockMvc.perform(get("/api/rides/" + rideId + "/participants"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode participants = objectMapper.readTree(res.getResponse().getContentAsString());
        assertEquals(1, participants.size());
        assertEquals(adminId.longValue(), participants.get(0).get("userId").asLong());

        // Leaving twice is rejected (no longer active)
        mockMvc.perform(patch("/api/rides/" + rideId + "/participants/" + memberId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("status", "left", "actorUserId", memberId.toString()))))
                .andExpect(status().isBadRequest());

        // Admin got a "member left" notification
        assertTrue(notificationRepository.findByUserIdOrderByCreatedAtDesc(adminId).stream()
                .anyMatch(n -> "group_ride_member_left".equals(n.getType())));
    }

    // ── 3. LIVE ADMIN ADD-RIDER ──────────────────────────────
    @Test
    void addParticipant_adminOnly_friendOnly_dedupeAndRejoin() throws Exception {
        Long rideId = createRide(adminId, "group", List.of(memberId));

        // Non-admin member cannot add riders
        mockMvc.perform(post("/api/rides/" + rideId + "/participants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("adminId", memberId.toString(), "userId", friendId.toString()))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only the ride admin can add riders to this group ride"));

        // Cannot add a user that does not exist
        mockMvc.perform(post("/api/rides/" + rideId + "/participants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("adminId", adminId.toString(), "userId", "999999"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("User not found"));

        // Cannot add a non-friend (stranger)
        mockMvc.perform(post("/api/rides/" + rideId + "/participants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("adminId", adminId.toString(), "userId", strangerId.toString()))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("You can only add connected friends to a group ride"));

        // Duplicate: member is already active
        mockMvc.perform(post("/api/rides/" + rideId + "/participants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("adminId", adminId.toString(), "userId", memberId.toString()))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("User is already an active participant in this ride"));

        // Happy path: admin adds connected friend → active member + notification
        mockMvc.perform(post("/api/rides/" + rideId + "/participants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("adminId", adminId.toString(), "userId", friendId.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(friendId))
                .andExpect(jsonPath("$.role").value("member"))
                .andExpect(jsonPath("$.status").value("active"))
                .andExpect(jsonPath("$.username").value("friend1"));
        assertTrue(notificationRepository.findByUserIdOrderByCreatedAtDesc(friendId).stream()
                .anyMatch(n -> "group_ride_invite".equals(n.getType()) && rideId.equals(n.getRideId())));

        // Rejoin: member leaves, admin re-adds → active again (no duplicate row)
        mockMvc.perform(patch("/api/rides/" + rideId + "/participants/" + memberId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("status", "left", "actorUserId", memberId.toString()))))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/rides/" + rideId + "/participants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("adminId", adminId.toString(), "userId", memberId.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("active"));
        assertEquals(1, participantRepository.findByRideId(rideId).stream()
                .filter(p -> p.getUserId().equals(memberId)).count());

        // RideResponse carries ACTIVE participants only (admin + friend + rejoined member)
        mockMvc.perform(get("/api/rides/" + rideId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participants.length()").value(3))
                .andExpect(jsonPath("$.creatorUsername").value("admin1"));

        // Ended ride rejects additions
        mockMvc.perform(patch("/api/rides/" + rideId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("status", "completed", "userId", adminId.toString()))))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/rides/" + rideId + "/participants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("adminId", adminId.toString(), "userId", friendId.toString()))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Ride is not active"));
    }

    // ── 4. GPS WRITER VALIDATION ─────────────────────────────
    @Test
    void gpsWriter_ownerForSolo_activeParticipantForGroup_anonymousAllowed() throws Exception {
        // Solo ride: only the owner may write GPS fixes
        Long soloRideId = createRide(adminId, "solo", null);
        mockMvc.perform(post("/api/rides/" + soloRideId + "/location")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("lat", 13.0, "lng", 80.0, "userId", memberId))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only the ride owner can share location for this ride"));
        mockMvc.perform(post("/api/rides/" + soloRideId + "/location")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("lat", 13.0, "lng", 80.0, "userId", adminId))))
                .andExpect(status().isOk());
        // Demo/local compatibility: no userId → accepted
        mockMvc.perform(post("/api/rides/" + soloRideId + "/location")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("lat", 13.0, "lng", 80.0))))
                .andExpect(status().isOk());

        // Group ride: active participant may write, outsider may not
        Long groupRideId = createRide(adminId, "group", List.of(memberId));
        mockMvc.perform(post("/api/rides/" + groupRideId + "/location")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("lat", 13.0, "lng", 80.0, "userId", memberId))))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/rides/" + groupRideId + "/location")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("lat", 13.0, "lng", 80.0, "userId", strangerId))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only active participants can share location for this group ride"));
    }

    // ── 5. CONNECTION SELF/EXISTENCE CHECKS ──────────────────
    @Test
    void addRider_selfAndExistenceChecks() throws Exception {
        // Self-connection rejected
        mockMvc.perform(post("/api/riders/add")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("userId", adminId, "riderId", adminId))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("You cannot connect with yourself"));

        // Nonexistent user rejected
        mockMvc.perform(post("/api/riders/add")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("userId", adminId, "riderId", 999999L))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("User not found"));

        // Valid add → success, dedupe on second add
        mockMvc.perform(post("/api/riders/add")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("userId", adminId, "riderId", strangerId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
        mockMvc.perform(post("/api/riders/add")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("userId", adminId, "riderId", strangerId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(false));
    }
}
