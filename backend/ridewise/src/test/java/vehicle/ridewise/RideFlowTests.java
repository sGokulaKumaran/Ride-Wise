package vehicle.ridewise;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import vehicle.ridewise.entity.Connection;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.repository.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// ============================================================
// RideFlowTests — MockMvc tests of the REST API
//
// These run on the in-memory H2 database configured in
// src/test/resources/application.properties — never on PostgreSQL.
//
//   rides      who may end / leave / add riders, what a ride list carries
//   locations  who may publish a position
//   riders     connections, search privacy, "near me"
//   accounts   sessions, suspension, validation
// ============================================================
@SpringBootTest
@AutoConfigureMockMvc
class RideFlowTests {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired UserRepository userRepository;
    @Autowired RideRepository rideRepository;
    @Autowired RideParticipantRepository participantRepository;
    @Autowired ConnectionRepository connectionRepository;
    @Autowired NotificationRepository notificationRepository;
    @Autowired LocationUpdateRepository locationUpdateRepository;
    @Autowired UserLocationRepository userLocationRepository;

    private Long adminId;   // user A — group ride admin
    private Long memberId;  // user B — group ride member + friend of A
    private Long friendId;  // user C — friend of A, not yet in ride
    private Long strangerId;// user D — exists, NOT connected to A

    @BeforeEach
    void setUp() {
        notificationRepository.deleteAll();
        locationUpdateRepository.deleteAll();
        userLocationRepository.deleteAll();
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
        u.setPassword(passwordEncoder.encode("pw"));
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

    // Log in and return the session cookie the browser would send back.
    // (MockMvc does not turn a raw "Cookie" header into request cookies, so
    // the Set-Cookie value is parsed and attached with .cookie(...).)
    private Cookie login(Long userId) throws Exception {
        User u = userRepository.findById(userId).orElseThrow();
        MvcResult res = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", u.getEmail(), "password", "pw"))))
                .andExpect(status().isOk())
                .andReturn();
        String setCookie = res.getResponse().getHeader("Set-Cookie");
        assertNotNull(setCookie, "login must set a session cookie");
        String pair = setCookie.split(";", 2)[0];           // "SESSION=<value>"
        int eq = pair.indexOf('=');
        return new Cookie(pair.substring(0, eq), pair.substring(eq + 1));
    }

    private Map<String, Object> rideBody(String rideType, List<Long> participantIds) {
        Map<String, Object> body = new HashMap<>();
        body.put("rideType", rideType);
        body.put("fromName", "Chennai");
        body.put("fromLat", 13.08);
        body.put("fromLng", 80.27);
        body.put("destinationName", "Vellore");
        body.put("destinationLat", 12.91);
        body.put("destinationLng", 79.13);
        if (participantIds != null) body.put("participantIds", participantIds);
        return body;
    }

    private Long createRide(Cookie cookie, String rideType, List<Long> participantIds) throws Exception {
        return createRide(cookie, rideBody(rideType, participantIds));
    }

    private Long createRide(Cookie cookie, Map<String, Object> body) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/rides")
                        .contentType(MediaType.APPLICATION_JSON).content(json(body))
                        .cookie(cookie))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asLong();
    }

    // ── 1. ENDING A GROUP RIDE ───────────────────────────────
    @Test
    void groupRideEnd_adminOnly_memberForbidden_anonymousRejected() throws Exception {
        Cookie admin = login(adminId);
        Cookie member = login(memberId);
        Long rideId = createRide(admin, "group", List.of(memberId));

        // A member cannot end the group ride
        mockMvc.perform(patch("/api/rides/" + rideId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(member)
                        .content(json(Map.of("status", "completed"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only the ride admin can end this group ride"))
                .andExpect(jsonPath("$.error").exists()); // legacy error key retained

        // …and the ride is still active
        mockMvc.perform(get("/api/rides/" + rideId).cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("active"));

        // Without a session nothing can be ended
        mockMvc.perform(patch("/api/rides/" + rideId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("status", "completed"))))
                .andExpect(status().isUnauthorized());

        // The admin ends it; the distance ridden is stored
        mockMvc.perform(patch("/api/rides/" + rideId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("status", "completed", "actualDistanceMeters", 1234.5))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("completed"))
                .andExpect(jsonPath("$.actualDistanceMeters").value(1234.5))
                // an ended ride still lists who rode it
                .andExpect(jsonPath("$.participants", hasSize(2)));

        // "Tracked, nothing ridden" is stored as 0 — not left empty, which
        // the app reads as "never tracked" and counts at the planned length.
        Long idleRideId = createRide(admin, "solo", null);
        mockMvc.perform(patch("/api/rides/" + idleRideId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("status", "completed", "actualDistanceMeters", 0))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actualDistanceMeters").value(0.0));

        // The member is told, and an ended ride cannot be ended again
        assertTrue(notificationRepository.findByUserIdOrderByCreatedAtDesc(memberId).stream()
                .anyMatch(n -> "group_ride_ended".equals(n.getType())));
        mockMvc.perform(patch("/api/rides/" + rideId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("status", "completed"))))
                .andExpect(status().isBadRequest());
    }

    // ── 2. MEMBER SELF-LEAVE ─────────────────────────────────
    @Test
    void memberLeave_selfOnly_leftOnly_adminBlockedFromLeaving() throws Exception {
        Cookie admin = login(adminId);
        Cookie member = login(memberId);
        Long rideId = createRide(admin, "group", List.of(memberId));

        // A member cannot END the ride via the participant route
        mockMvc.perform(patch("/api/rides/" + rideId + "/participants/" + memberId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(member)
                        .content(json(Map.of("status", "completed"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());

        // Nobody can make someone else leave
        mockMvc.perform(patch("/api/rides/" + rideId + "/participants/" + memberId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("status", "left"))))
                .andExpect(status().isForbidden());

        // The admin cannot leave (must end the ride instead)
        mockMvc.perform(patch("/api/rides/" + rideId + "/participants/" + adminId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("status", "left"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("The ride admin cannot leave; end the ride instead"));

        // The member shares a position, then leaves → their position goes too
        mockMvc.perform(post("/api/rides/" + rideId + "/location")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(member)
                        .content(json(Map.of("lat", 13.0, "lng", 80.0))))
                .andExpect(status().isOk());
        assertTrue(userLocationRepository.findByUserId(memberId).isPresent());

        mockMvc.perform(patch("/api/rides/" + rideId + "/participants/" + memberId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(member)
                        .content(json(Map.of("status", "left"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
        assertTrue(userLocationRepository.findByUserId(memberId).isEmpty(),
                "a rider who left must not stay on the map");

        // Active participants only → the member is gone, the admin remains
        MvcResult res = mockMvc.perform(get("/api/rides/" + rideId + "/participants").cookie(admin))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode participants = objectMapper.readTree(res.getResponse().getContentAsString());
        assertEquals(1, participants.size());
        assertEquals(adminId.longValue(), participants.get(0).get("userId").asLong());

        // Leaving twice is rejected (no longer active)
        mockMvc.perform(patch("/api/rides/" + rideId + "/participants/" + memberId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(member)
                        .content(json(Map.of("status", "left"))))
                .andExpect(status().isBadRequest());

        // The admin got a "member left" notification
        assertTrue(notificationRepository.findByUserIdOrderByCreatedAtDesc(adminId).stream()
                .anyMatch(n -> "group_ride_member_left".equals(n.getType())));
    }

    // ── 3. ADDING A RIDER TO A LIVE RIDE ─────────────────────
    @Test
    void addParticipant_adminOnly_friendOnly_dedupeAndRejoin() throws Exception {
        Cookie admin = login(adminId);
        Cookie member = login(memberId);
        Long rideId = createRide(admin, "group", List.of(memberId));

        // A non-admin member cannot add riders
        mockMvc.perform(post("/api/rides/" + rideId + "/participants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(member)
                        .content(json(Map.of("userId", friendId.toString()))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only the ride admin can add riders to this group ride"));

        // A user that does not exist
        mockMvc.perform(post("/api/rides/" + rideId + "/participants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("userId", "999999"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("User not found"));

        // A non-friend (stranger)
        mockMvc.perform(post("/api/rides/" + rideId + "/participants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("userId", strangerId.toString()))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("You can only add connected friends to a group ride"));

        // Duplicate: the member is already active
        mockMvc.perform(post("/api/rides/" + rideId + "/participants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("userId", memberId.toString()))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("User is already an active participant in this ride"));

        // Happy path: the admin adds a connected friend → active member + notification
        mockMvc.perform(post("/api/rides/" + rideId + "/participants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("userId", friendId))))   // a JSON number works too
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(friendId))
                .andExpect(jsonPath("$.role").value("member"))
                .andExpect(jsonPath("$.status").value("active"))
                .andExpect(jsonPath("$.username").value("friend1"));
        assertTrue(notificationRepository.findByUserIdOrderByCreatedAtDesc(friendId).stream()
                .anyMatch(n -> "group_ride_invite".equals(n.getType()) && rideId.equals(n.getRideId())));

        // Rejoin: the member leaves, the admin re-adds → active again (no duplicate row)
        mockMvc.perform(patch("/api/rides/" + rideId + "/participants/" + memberId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(member)
                        .content(json(Map.of("status", "left"))))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/rides/" + rideId + "/participants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("userId", memberId.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("active"));
        assertEquals(1, participantRepository.findByRideId(rideId).stream()
                .filter(p -> p.getUserId().equals(memberId)).count());

        // The ride carries its ACTIVE participants (admin + friend + rejoined member)
        mockMvc.perform(get("/api/rides/" + rideId).cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participants.length()").value(3))
                .andExpect(jsonPath("$.creatorUsername").value("admin1"));

        // An ended ride rejects additions
        mockMvc.perform(patch("/api/rides/" + rideId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("status", "completed"))))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/rides/" + rideId + "/participants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("userId", friendId.toString()))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Ride is not active"));
    }

    // ── 4. WHO MAY PUBLISH A POSITION ────────────────────────
    @Test
    void gpsWriter_ownerForSolo_activeParticipantForGroup_anonymousRejected() throws Exception {
        Cookie admin = login(adminId);
        Cookie member = login(memberId);
        Cookie stranger = login(strangerId);

        // Solo ride: only the owner
        Long soloRideId = createRide(admin, "solo", null);
        mockMvc.perform(post("/api/rides/" + soloRideId + "/location")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(member)
                        .content(json(Map.of("lat", 13.0, "lng", 80.0))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("You are not an active participant in this ride"));
        mockMvc.perform(post("/api/rides/" + soloRideId + "/location")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("lat", 13.0, "lng", 80.0))))
                .andExpect(status().isOk());
        // …and never without a session
        mockMvc.perform(post("/api/rides/" + soloRideId + "/location")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("lat", 13.0, "lng", 80.0))))
                .andExpect(status().isUnauthorized());
        // A solo ride never creates a live "latest position" row
        assertTrue(userLocationRepository.findByUserId(adminId).isEmpty());

        // Group ride: active participants yes, outsiders no
        Long groupRideId = createRide(admin, "group", List.of(memberId));
        mockMvc.perform(post("/api/rides/" + groupRideId + "/location")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(member)
                        .content(json(Map.of("lat", 13.0, "lng", 80.0, "accuracy", 9))))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/rides/" + groupRideId + "/location")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(stranger)
                        .content(json(Map.of("lat", 13.0, "lng", 80.0))))
                .andExpect(status().isForbidden());

        // Impossible coordinates are refused
        mockMvc.perform(post("/api/rides/" + groupRideId + "/location")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(member)
                        .content(json(Map.of("lat", 913.0, "lng", 80.0))))
                .andExpect(status().isBadRequest());
    }

    // ── 5. CONNECTIONS ───────────────────────────────────────
    @Test
    void addRider_selfAndExistenceChecks() throws Exception {
        Cookie admin = login(adminId);

        // Self-connection rejected
        mockMvc.perform(post("/api/riders/add")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("riderId", adminId))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("You cannot connect with yourself"));

        // Nonexistent user rejected
        mockMvc.perform(post("/api/riders/add")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("riderId", 999999L))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("User not found"));

        // Valid add → success, and "already connected" the second time
        mockMvc.perform(post("/api/riders/add")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("riderId", strangerId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
        mockMvc.perform(post("/api/riders/add")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("riderId", strangerId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(false));

        // Nobody can act for another account
        mockMvc.perform(post("/api/riders/add")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("userId", strangerId, "riderId", memberId))))
                .andExpect(status().isForbidden());

        // Removing works in both directions
        mockMvc.perform(post("/api/riders/remove")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(admin)
                        .content(json(Map.of("riderId", strangerId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
        assertFalse(connectionRepository.existsByUserIdAndConnectedUserId(strangerId, adminId));
    }

    // ── 6. A RIDE LIST IS LIGHT; ONE RIDE CARRIES ITS ROUTE ──
    @Test
    void rideList_summaryLeavesOutTheRoute_andListsGroupRidesOnce() throws Exception {
        Cookie admin = login(adminId);
        Cookie member = login(memberId);

        Map<String, Object> body = rideBody("group", List.of(memberId));
        body.put("routeCoordinates", "[[80.27,13.08],[79.13,12.91]]");
        body.put("routeSteps", "[{\"instruction\":\"Head west\"}]");
        // A geocoder name longer than the 255-character column
        body.put("destinationName", "Vellore, " + "a very long district name, ".repeat(20) + "India");
        Long rideId = createRide(admin, body);
        createRide(admin, "solo", null);

        // Summary rows: no route, hasRoute says whether one exists
        mockMvc.perform(get("/api/rides/user/" + adminId + "?summary=true").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].routeCoordinates").doesNotExist())
                .andExpect(jsonPath("$[1].id").value(rideId))
                .andExpect(jsonPath("$[1].routeCoordinates").doesNotExist())
                .andExpect(jsonPath("$[1].hasRoute").value(true))
                .andExpect(jsonPath("$[0].hasRoute").value(false))
                .andExpect(jsonPath("$[1].participants", hasSize(2)))
                .andExpect(jsonPath("$[1].creatorUsername").value("admin1"))
                // timestamps are explicit UTC instants
                .andExpect(jsonPath("$[1].createdAt", endsWith("Z")));

        // The member sees the group ride (once), not the admin's solo ride
        mockMvc.perform(get("/api/rides/user/" + memberId + "?summary=true").cookie(member))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(rideId));

        // The full ride has its route; the long name was shortened to fit
        MvcResult res = mockMvc.perform(get("/api/rides/" + rideId).cookie(member))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.routeCoordinates").value("[[80.27,13.08],[79.13,12.91]]"))
                .andExpect(jsonPath("$.routeSteps").exists())
                .andReturn();
        String storedName = objectMapper.readTree(res.getResponse().getContentAsString())
                .get("destinationName").asText();
        assertEquals(255, storedName.length());

        // …and the cheap status check leaves the route out
        mockMvc.perform(get("/api/rides/" + rideId + "?summary=true").cookie(member))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("active"))
                .andExpect(jsonPath("$.routeCoordinates").doesNotExist());

        // Nobody else can read it
        mockMvc.perform(get("/api/rides/" + rideId).cookie(login(strangerId)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/rides/user/" + adminId).cookie(member))
                .andExpect(status().isForbidden());
    }

    // ── 7. DELETING A RIDE TAKES ITS DATA WITH IT ────────────
    @Test
    void deleteRide_ownerOnly_removesRidersPositionsAndNotifications() throws Exception {
        Cookie admin = login(adminId);
        Cookie member = login(memberId);
        Long rideId = createRide(admin, "group", List.of(memberId));

        mockMvc.perform(post("/api/rides/" + rideId + "/location")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(member)
                        .content(json(Map.of("lat", 13.0, "lng", 80.0))))
                .andExpect(status().isOk());

        // A member cannot delete the shared ride
        mockMvc.perform(delete("/api/rides/" + rideId).cookie(member))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/rides/" + rideId).cookie(admin))
                .andExpect(status().isNoContent());

        assertTrue(rideRepository.findById(rideId).isEmpty());
        assertTrue(participantRepository.findByRideId(rideId).isEmpty());
        assertTrue(userLocationRepository.findByRideId(rideId).isEmpty(), "no ghost markers");
        assertEquals(0, locationUpdateRepository.countByRideId(rideId));
        assertTrue(notificationRepository.findAll().stream().noneMatch(n -> rideId.equals(n.getRideId())),
                "no notification may point at a ride that is gone");

        mockMvc.perform(get("/api/rides/" + rideId).cookie(admin))
                .andExpect(status().isNotFound());
    }

    // ── 8. RIDE INPUT IS VALIDATED ───────────────────────────
    @Test
    void createRide_rejectsInvalidInput() throws Exception {
        Cookie admin = login(adminId);

        Map<String, Object> badType = rideBody("race", null);
        Map<String, Object> badCoordinate = rideBody("solo", null);
        badCoordinate.put("destinationLat", 123.0);
        Map<String, Object> noName = rideBody("solo", null);
        noName.put("fromName", "   ");
        Map<String, Object> strangerInGroup = rideBody("group", List.of(strangerId));
        Map<String, Object> emptyGroup = rideBody("group", List.of());

        for (Map<String, Object> body : List.of(badType, badCoordinate, noName, strangerInGroup, emptyGroup)) {
            mockMvc.perform(post("/api/rides")
                            .contentType(MediaType.APPLICATION_JSON).cookie(admin).content(json(body)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").exists());
        }

        // Not JSON at all → a clear 400, not a server error
        mockMvc.perform(post("/api/rides")
                        .contentType(MediaType.APPLICATION_JSON).cookie(admin).content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("The request body is missing or is not valid JSON"));

        // A ride id that is not a number
        mockMvc.perform(get("/api/rides/local_123").cookie(admin))
                .andExpect(status().isBadRequest());

        assertEquals(0, rideRepository.count());
    }

    // ── 9. OTHER RIDERS' PRIVATE DATA STAYS PRIVATE ──────────
    @Test
    void riderSearch_neverExposesCoordinatesOrPhone() throws Exception {
        User member = userRepository.findById(memberId).orElseThrow();
        member.setLat(13.05);
        member.setLng(80.25);
        member.setMobile("+91 98765 43210");
        member.setAddress("Chennai");
        userRepository.save(member);

        Cookie admin = login(adminId);
        mockMvc.perform(get("/api/riders/search?query=member").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].username").value("member1"))
                .andExpect(jsonPath("$[0].address").value("Chennai"))
                // already connected → the full email is fine
                .andExpect(jsonPath("$[0].email").value("member1@test.com"))
                .andExpect(jsonPath("$[0].lat").doesNotExist())
                .andExpect(jsonPath("$[0].lng").doesNotExist())
                .andExpect(jsonPath("$[0].mobile").doesNotExist())
                .andExpect(jsonPath("$[0].role").doesNotExist());

        // A rider the viewer is NOT connected with: only a hint of the email
        mockMvc.perform(get("/api/riders/search?query=stranger").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].username").value("stranger1"))
                .andExpect(jsonPath("$[0].email").value("s•••@test.com"));

        // An account that never chose a username is not offered at all
        User unfinished = new User();
        unfinished.setEmail("ghost@test.com");
        unfinished.setPassword(passwordEncoder.encode("pw"));
        userRepository.save(unfinished);
        mockMvc.perform(get("/api/riders/search?query=ghost").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        mockMvc.perform(get("/api/riders/connections").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].username").value("friend1")) // by name
                .andExpect(jsonPath("$[1].lat").doesNotExist());

        // "_" is a literal character, not "any character"
        mockMvc.perform(get("/api/riders/search?query=_").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        // A suspended account is not offered to other riders
        member.setEnabled(false);
        userRepository.save(member);
        mockMvc.perform(get("/api/riders/search?query=member").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    // ── 9b. "PUBLIC PROFILE" OFF REALLY HIDES A RIDER ────────
    @Test
    void privateProfile_isHiddenFromSearchAndNearby_butNotFromConnections() throws Exception {
        Cookie admin = login(adminId);
        Cookie stranger = login(strangerId);
        setLocation(adminId, 13.08, 80.27);
        setLocation(strangerId, 13.05, 80.25);

        // Visible by default
        mockMvc.perform(get("/api/auth/me").cookie(stranger))
                .andExpect(jsonPath("$.profilePublic").value(true));
        mockMvc.perform(get("/api/riders/search?query=stranger").cookie(admin))
                .andExpect(jsonPath("$", hasSize(1)));
        mockMvc.perform(get("/api/riders/nearby").cookie(admin))
                .andExpect(jsonPath("$[?(@.username == 'stranger1')]", hasSize(1)));

        // The stranger switches "Public profile" off
        mockMvc.perform(patch("/api/auth/profile/" + strangerId)
                        .contentType(MediaType.APPLICATION_JSON).cookie(stranger)
                        .content(json(Map.of("profilePublic", false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profilePublic").value(false));

        mockMvc.perform(get("/api/riders/search?query=stranger").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
        mockMvc.perform(get("/api/riders/nearby").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.username == 'stranger1')]", hasSize(0)));

        // People already connected still see each other
        User member = userRepository.findById(memberId).orElseThrow();
        member.setProfilePublic(false);
        userRepository.save(member);
        mockMvc.perform(get("/api/riders/connections").cookie(admin))
                .andExpect(jsonPath("$[?(@.username == 'member1')]", hasSize(1)));
    }

    // ── 10. "NEAR ME" NEEDS A LOCATION, AND REPORTS DISTANCE ─
    @Test
    void nearbyRiders_requireMyLocation_thenReturnDistance() throws Exception {
        Cookie admin = login(adminId);

        // No saved location yet → say so (it used to assume Chennai)
        mockMvc.perform(get("/api/riders/nearby").cookie(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Share your location first to find riders near you"));

        // The rider shares their location through their profile.
        // Invalid or half-given coordinates are refused.
        String profile = "/api/auth/profile/" + adminId;
        mockMvc.perform(patch(profile)
                        .contentType(MediaType.APPLICATION_JSON).cookie(admin)
                        .content(json(Map.of("lat", 200, "lng", 80.27))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(patch(profile)
                        .contentType(MediaType.APPLICATION_JSON).cookie(admin)
                        .content(json(Map.of("lat", 13.08))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(patch(profile)
                        .contentType(MediaType.APPLICATION_JSON).cookie(admin)
                        .content(json(Map.of("lat", 13.08, "lng", 80.27))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lat").value(13.08));   // my OWN profile shows my location

        // member ≈ 4 km away, friend ≈ 11 km, stranger far outside 50 km
        setLocation(memberId, 13.05, 80.25);
        setLocation(friendId, 13.00, 80.20);
        setLocation(strangerId, 11.00, 78.00);

        mockMvc.perform(get("/api/riders/nearby").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].username").value("member1")) // nearest first
                .andExpect(jsonPath("$[0].distance").value(4.0))
                .andExpect(jsonPath("$[1].username").value("friend1"))
                .andExpect(jsonPath("$[0].lat").doesNotExist());
    }

    private void setLocation(Long userId, double lat, double lng) {
        User u = userRepository.findById(userId).orElseThrow();
        u.setLat(lat);
        u.setLng(lng);
        userRepository.save(u);
    }

    // ── 11. A SUSPENDED ACCOUNT IS LOCKED OUT IMMEDIATELY ────
    @Test
    void suspendedUser_losesAccessEvenWithAnOpenSession() throws Exception {
        User boss = userRepository.findById(adminId).orElseThrow();
        boss.setRole("ADMIN");
        userRepository.save(boss);

        Cookie admin = login(adminId);      // logged in AFTER becoming an admin
        Cookie member = login(memberId);

        mockMvc.perform(get("/api/auth/me").cookie(member)).andExpect(status().isOk());

        // A normal user cannot use the admin API
        mockMvc.perform(get("/api/admin/users").cookie(member)).andExpect(status().isForbidden());

        // An admin can neither suspend themself nor another admin
        mockMvc.perform(patch("/api/admin/users/" + adminId + "/status")
                        .contentType(MediaType.APPLICATION_JSON).cookie(admin)
                        .content(json(Map.of("enabled", false))))
                .andExpect(status().isBadRequest());
        User other = userRepository.findById(friendId).orElseThrow();
        other.setRole("ADMIN");
        userRepository.save(other);
        mockMvc.perform(patch("/api/admin/users/" + friendId + "/status")
                        .contentType(MediaType.APPLICATION_JSON).cookie(admin)
                        .content(json(Map.of("enabled", false))))
                .andExpect(status().isForbidden());

        // Suspend the member → their open session stops working at once
        mockMvc.perform(patch("/api/admin/users/" + memberId + "/status")
                        .contentType(MediaType.APPLICATION_JSON).cookie(admin)
                        .content(json(Map.of("enabled", false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false));
        mockMvc.perform(get("/api/auth/me").cookie(member)).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/rides/user/" + memberId).cookie(member)).andExpect(status().isUnauthorized());

        // …and they cannot log back in
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "member1@test.com", "password", "pw"))))
                .andExpect(status().isForbidden());

        // Re-enabled → they can
        mockMvc.perform(patch("/api/admin/users/" + memberId + "/status")
                        .contentType(MediaType.APPLICATION_JSON).cookie(admin)
                        .content(json(Map.of("enabled", true))))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/auth/me").cookie(login(memberId))).andExpect(status().isOk());
    }

    // ── 12. ADMIN LISTS ARE REAL PAGES ───────────────────────
    @Test
    void adminUserSearch_reportsRealTotals() throws Exception {
        User boss = userRepository.findById(adminId).orElseThrow();
        boss.setRole("ADMIN");
        userRepository.save(boss);
        for (int i = 0; i < 5; i++) saveUser("searchme" + i, "searchme" + i + "@test.com");
        Cookie admin = login(adminId);

        // 5 matches, 2 per page → 3 pages; the old code reported "2 users, 1 page"
        mockMvc.perform(get("/api/admin/users?search=searchme&page=0&size=2").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.users", hasSize(2)))
                .andExpect(jsonPath("$.totalUsers").value(5))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.users[0].password").doesNotExist());
        mockMvc.perform(get("/api/admin/users?search=searchme&page=2&size=2").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.users", hasSize(1)));

        Long rideId = createRide(admin, "group", List.of(memberId));
        mockMvc.perform(get("/api/admin/rides?type=group").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rides", hasSize(1)))
                .andExpect(jsonPath("$.rides[0].creatorUsername").value("admin1"));
        mockMvc.perform(get("/api/admin/rides/" + rideId).cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participants", hasSize(2)));
    }

    // ── 13. ACCOUNTS: SIGN-UP, PROFILE, WRONG PASSWORDS ──────
    @Test
    void accounts_validationAndLoginThrottling() throws Exception {
        // Sign-up validation
        mockMvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "not-an-email", "password", "secret1"))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "new@test.com", "password", "123"))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "ADMIN1@test.com", "password", "secret1"))))
                .andExpect(status().isConflict());   // same email, different case

        // Profile validation
        Cookie member = login(memberId);
        String profile = "/api/auth/profile/" + memberId;
        mockMvc.perform(patch(profile).contentType(MediaType.APPLICATION_JSON).cookie(member)
                        .content(json(Map.of("username", "admin1"))))
                .andExpect(status().isConflict());   // taken
        mockMvc.perform(patch(profile).contentType(MediaType.APPLICATION_JSON).cookie(member)
                        .content(json(Map.of("mobile", "call me"))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(patch(profile).contentType(MediaType.APPLICATION_JSON).cookie(member)
                        .content(json(Map.of("address", "x".repeat(300)))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(patch(profile).contentType(MediaType.APPLICATION_JSON).cookie(member)
                        .content(json(Map.of("mobile", "+91 98765 43210", "address", "Chennai"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mobile").value("+91 98765 43210"))
                .andExpect(jsonPath("$.password").doesNotExist());
        // Someone else's profile cannot be edited
        mockMvc.perform(patch("/api/auth/profile/" + adminId).contentType(MediaType.APPLICATION_JSON).cookie(member)
                        .content(json(Map.of("address", "Elsewhere"))))
                .andExpect(status().isForbidden());

        // Repeated wrong passwords lock the account's sign-in for a while…
        Map<String, Object> wrong = Map.of("email", "friend1@test.com", "password", "nope");
        for (int i = 0; i < 8; i++) {
            mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json(wrong)))
                    .andExpect(status().isUnauthorized());
        }
        // …even for the right password
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "friend1@test.com", "password", "pw"))))
                .andExpect(status().isTooManyRequests());
        // Other accounts are unaffected
        login(adminId);
    }
}
