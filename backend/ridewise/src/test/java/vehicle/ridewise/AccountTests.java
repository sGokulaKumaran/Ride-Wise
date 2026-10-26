package vehicle.ridewise;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.repository.ConnectionRepository;
import vehicle.ridewise.repository.NotificationRepository;
import vehicle.ridewise.repository.OrgMemberRepository;
import vehicle.ridewise.repository.RideParticipantRepository;
import vehicle.ridewise.repository.RideRepository;
import vehicle.ridewise.repository.UserRepository;
import vehicle.ridewise.repository.VehicleSessionRepository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

// ============================================================
// AccountTests — the account settings, over real HTTP sessions
//
// These run on the in-memory H2 database configured in
// src/test/resources/application.properties — never on PostgreSQL.
//
//   password   change it; other devices are signed out, this one is not
//   devices    "sign out of other devices"
//   email      change it, with the password
//   delete     what blocks it, what it cleans up, what others keep
//   export     everything in one JSON document
// ============================================================
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AccountTests {

    private static final AtomicInteger SEQ = new AtomicInteger();

    @Autowired TestRestTemplate rest;
    @Autowired ObjectMapper objectMapper;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired UserRepository userRepository;
    @Autowired RideRepository rideRepository;
    @Autowired RideParticipantRepository participantRepository;
    @Autowired ConnectionRepository connectionRepository;
    @Autowired NotificationRepository notificationRepository;
    @Autowired OrgMemberRepository orgMemberRepository;
    @Autowired VehicleSessionRepository sessionRepository;

    // ════════════════════════════════════════════════════════
    // PASSWORD
    // ════════════════════════════════════════════════════════

    @Test
    void changingThePasswordSignsOutOtherDevicesButNotThisOne() throws Exception {
        Person phone = person("pw");
        Person laptop = phone.loginAgain();

        ResponseEntity<String> changed = phone.post("/api/auth/password",
                Map.of("currentPassword", phone.password, "newPassword", "brand-new-secret"));
        assertEquals(200, changed.getStatusCode().value(), changed.getBody());

        assertEquals(200, phone.get("/api/auth/me").getStatusCode().value(), "the device that asked stays signed in");
        assertEquals(401, laptop.get("/api/auth/me").getStatusCode().value(), "every other device is signed out");

        assertEquals(401, login(phone.email, phone.password).getStatusCode().value(), "the old password no longer works");
        assertEquals(200, login(phone.email, "brand-new-secret").getStatusCode().value());
    }

    @Test
    void theCurrentPasswordMustBeRightAndTheNewOneValid() throws Exception {
        Person me = person("pwcheck");

        ResponseEntity<String> wrong = me.post("/api/auth/password",
                Map.of("currentPassword", "not-it", "newPassword", "another-secret"));
        assertEquals(400, wrong.getStatusCode().value(), "a wrong password is not 'signed out' (401)");
        assertEquals(200, me.get("/api/auth/me").getStatusCode().value(), "a wrong guess does not end the session");

        assertEquals(400, me.post("/api/auth/password",
                Map.of("currentPassword", me.password, "newPassword", "abc")).getStatusCode().value());
        assertEquals(400, me.post("/api/auth/password",
                Map.of("currentPassword", me.password, "newPassword", me.password)).getStatusCode().value());
    }

    // ════════════════════════════════════════════════════════
    // OTHER DEVICES
    // ════════════════════════════════════════════════════════

    @Test
    void signingOutOtherDevicesKeepsOnlyThisOne() throws Exception {
        Person phone = person("devices");
        Person laptop = phone.loginAgain();
        Person tablet = phone.loginAgain();

        assertEquals(200, laptop.post("/api/auth/sessions/sign-out-others", Map.of()).getStatusCode().value());

        assertEquals(200, laptop.get("/api/auth/me").getStatusCode().value());
        assertEquals(401, phone.get("/api/auth/me").getStatusCode().value());
        assertEquals(401, tablet.get("/api/auth/me").getStatusCode().value());
        assertEquals(200, login(phone.email, phone.password).getStatusCode().value(), "logging in again still works");
    }

    // ════════════════════════════════════════════════════════
    // EMAIL
    // ════════════════════════════════════════════════════════

    @Test
    void changingTheEmailNeedsThePasswordAndAFreeAddress() throws Exception {
        Person me = person("mail");
        Person other = person("mailother");
        String fresh = "fresh_" + SEQ.incrementAndGet() + "@test.com";

        assertEquals(400, me.patch("/api/auth/email", Map.of("email", fresh, "password", "nope")).getStatusCode().value());
        assertEquals(400, me.patch("/api/auth/email", Map.of("email", "not-an-email", "password", me.password)).getStatusCode().value());
        assertEquals(409, me.patch("/api/auth/email", Map.of("email", other.email.toUpperCase(), "password", me.password)).getStatusCode().value());

        ResponseEntity<String> changed = me.patch("/api/auth/email", Map.of("email", "  " + fresh.toUpperCase() + " ", "password", me.password));
        assertEquals(200, changed.getStatusCode().value(), changed.getBody());
        assertEquals(fresh, json(changed).get("email").asText(), "stored trimmed and lower-case");

        assertEquals(200, login(fresh, me.password).getStatusCode().value());
        assertEquals(401, login(me.email, me.password).getStatusCode().value());
    }

    // ════════════════════════════════════════════════════════
    // DELETE
    // ════════════════════════════════════════════════════════

    @Test
    void deletingNeedsThePasswordAndTheWordDelete() throws Exception {
        Person me = person("confirm");
        assertEquals(400, me.post("/api/auth/account/delete", Map.of("password", me.password, "confirm", "delete please")).getStatusCode().value());
        assertEquals(400, me.post("/api/auth/account/delete", Map.of("password", "wrong", "confirm", "DELETE")).getStatusCode().value());
        assertTrue(userRepository.existsById(me.id));
    }

    @Test
    void anOrganizationOwnerMustHandItOverFirst() throws Exception {
        Person owner = person("owner");
        long orgId = createOrg(owner, "Owned Fleet " + SEQ.incrementAndGet());

        JsonNode check = json(owner.get("/api/auth/account/delete-check"));
        assertFalse(check.get("canDelete").asBoolean());
        assertEquals(orgId, check.at("/ownedOrganizations/0/id").asLong());

        ResponseEntity<String> refused = owner.post("/api/auth/account/delete", Map.of("password", owner.password, "confirm", "DELETE"));
        assertEquals(409, refused.getStatusCode().value());
        assertTrue(refused.getBody().contains("Owned Fleet"), refused.getBody());
        assertTrue(userRepository.existsById(owner.id));

        // Once the organization is deleted, nothing stands in the way.
        assertEquals(204, owner.delete("/api/organizations/" + orgId).getStatusCode().value());
        assertTrue(json(owner.get("/api/auth/account/delete-check")).get("canDelete").asBoolean());
        assertEquals(200, owner.post("/api/auth/account/delete", Map.of("password", owner.password, "confirm", "DELETE")).getStatusCode().value());
        assertFalse(userRepository.existsById(owner.id));
    }

    @Test
    void theLastPlatformAdminCannotLeave() throws Exception {
        userRepository.findByRole("ADMIN").forEach(admin -> { admin.setRole("USER"); userRepository.save(admin); });
        try {
            Person admin = person("admin", "ADMIN");
            assertTrue(json(admin.get("/api/auth/account/delete-check")).get("lastPlatformAdmin").asBoolean());
            assertEquals(409, admin.post("/api/auth/account/delete",
                    Map.of("password", admin.password, "confirm", "DELETE")).getStatusCode().value());

            Person second = person("admin2", "ADMIN");
            assertFalse(json(admin.get("/api/auth/account/delete-check")).get("lastPlatformAdmin").asBoolean());
            assertEquals(200, second.post("/api/auth/account/delete",
                    Map.of("password", second.password, "confirm", "DELETE")).getStatusCode().value());
        } finally {
            // Leave one admin behind for the other tests, as the app expects.
            if (userRepository.findByRole("ADMIN").isEmpty()) person("admin_restore", "ADMIN");
        }
    }

    @Test
    void deletingEndsTheirGroupRideButTheOthersKeepIt() throws Exception {
        Person leader = person("leader");
        Person rider = person("rider");
        connect(leader, rider);
        long groupRide = createRide(leader, "group", List.of(rider.id));
        long soloRide = createRide(leader, "solo", null);
        Person leaderLaptop = leader.loginAgain();

        assertEquals(200, leader.post("/api/auth/account/delete",
                Map.of("password", leader.password, "confirm", "DELETE")).getStatusCode().value());

        assertFalse(userRepository.existsById(leader.id));
        assertEquals(401, leader.get("/api/auth/me").getStatusCode().value());
        assertEquals(401, leaderLaptop.get("/api/auth/me").getStatusCode().value(), "every device is signed out");

        assertFalse(rideRepository.existsById(soloRide), "their own solo rides go");
        assertEquals("completed", rideRepository.findById(groupRide).orElseThrow().getStatus(), "the group ride ended for everyone");
        ResponseEntity<String> riderView = rider.get("/api/rides/" + groupRide);
        assertEquals(200, riderView.getStatusCode().value(), "the other rider keeps it in their history");
        assertTrue(notificationRepository.findByUserIdOrderByCreatedAtDesc(rider.id).stream()
                .anyMatch(n -> "group_ride_ended".equals(n.getType())), "the other rider is told the ride ended");
        assertTrue(connectionRepository.findConnectedUserIds(rider.id).isEmpty(), "connections go both ways");

        // The email can be used again.
        ResponseEntity<String> again = rest.postForEntity("/api/auth/signup",
                entity(Map.of("email", leader.email, "password", "start-over-1")), String.class);
        assertEquals(200, again.getStatusCode().value(), again.getBody());
    }

    @Test
    void aMemberWhoDeletesLeavesTheRideAndTheLeaderIsTold() throws Exception {
        Person leader = person("lead2");
        Person rider = person("member2");
        connect(leader, rider);
        long ride = createRide(leader, "group", List.of(rider.id));

        assertEquals(200, rider.post("/api/auth/account/delete",
                Map.of("password", rider.password, "confirm", "DELETE")).getStatusCode().value());

        assertEquals("active", rideRepository.findById(ride).orElseThrow().getStatus(), "the ride goes on");
        assertTrue(participantRepository.findByRideIdAndUserId(ride, rider.id).isEmpty());
        assertTrue(notificationRepository.findByUserIdOrderByCreatedAtDesc(leader.id).stream()
                .anyMatch(n -> "group_ride_member_left".equals(n.getType())));
        assertEquals(200, leader.get("/api/rides/" + ride + "/participants").getStatusCode().value());
    }

    @Test
    void aDriverWhoDeletesEndsTheirTripAndFreesTheVehicle() throws Exception {
        Person owner = person("fleetowner");
        Person driver = person("driver");
        long orgId = createOrg(owner, "Driver Fleet " + SEQ.incrementAndGet());
        long vehicleId = json(owner.post("/api/organizations/" + orgId + "/vehicles",
                Map.of("vehicleCode", "DEL-" + SEQ.incrementAndGet(), "vehicleType", "BUS", "capacity", 40))).get("id").asLong();
        long invitation = json(owner.post("/api/organizations/" + orgId + "/members",
                Map.of("identifier", driver.username, "role", "DRIVER"))).get("id").asLong();
        assertEquals(200, driver.post("/api/organizations/invitations/" + invitation + "/accept", Map.of()).getStatusCode().value());
        Map<String, Object> trip = new HashMap<>();
        trip.put("orgId", orgId);
        trip.put("vehicleId", vehicleId);
        trip.put("destinationName", "Depot");
        trip.put("destinationLat", 12.5);
        trip.put("destinationLng", 78.5);
        ResponseEntity<String> started = driver.post("/api/vehicle-sessions", trip);
        assertEquals(201, started.getStatusCode().value(), started.getBody());

        assertTrue(json(driver.get("/api/auth/account/delete-check")).get("drivingNow").asBoolean());
        assertEquals(200, driver.post("/api/auth/account/delete",
                Map.of("password", driver.password, "confirm", "DELETE")).getStatusCode().value());

        assertTrue(sessionRepository.findFirstByVehicleIdAndStatus(vehicleId, "ACTIVE").isEmpty(), "the vehicle is free again");
        assertTrue(orgMemberRepository.findByOrgIdAndUserId(orgId, driver.id).isEmpty());
        assertEquals(200, owner.get("/api/organizations/" + orgId + "/trips").getStatusCode().value(),
                "the organization's trip history still loads");
    }

    // ════════════════════════════════════════════════════════
    // EXPORT
    // ════════════════════════════════════════════════════════

    @Test
    void theExportHoldsProfileRidesAndConnections() throws Exception {
        Person me = person("export");
        Person friend = person("exportfriend");
        connect(me, friend);
        createRide(me, "solo", null);

        ResponseEntity<String> res = me.get("/api/auth/account/export");
        assertEquals(200, res.getStatusCode().value(), res.getBody());
        JsonNode data = json(res);
        assertEquals(me.email, data.at("/profile/email").asText());
        assertEquals(1, data.get("rides").size());
        assertEquals(friend.username, data.at("/connections/0").asText());
        assertFalse(res.getBody().contains("\"password\""), "the password hash is never exported");
    }

    // ── helpers ──────────────────────────────────────────────

    private final class Person {
        final long id;
        final String username;
        final String email;
        final String password;
        String cookie;

        Person(long id, String username, String email, String password, String cookie) {
            this.id = id;
            this.username = username;
            this.email = email;
            this.password = password;
            this.cookie = cookie;
        }

        /** The same account signed in on another device. */
        Person loginAgain() {
            ResponseEntity<String> res = login(email, password);
            assertEquals(200, res.getStatusCode().value());
            return new Person(id, username, email, password, cookieOf(res));
        }

        ResponseEntity<String> get(String path) {
            return call(HttpMethod.GET, path, null);
        }

        ResponseEntity<String> post(String path, Object body) {
            return call(HttpMethod.POST, path, body);
        }

        ResponseEntity<String> patch(String path, Object body) {
            return call(HttpMethod.PATCH, path, body);
        }

        ResponseEntity<String> delete(String path) {
            return call(HttpMethod.DELETE, path, null);
        }

        // Like a browser: a new session cookie from the server replaces the old one.
        private ResponseEntity<String> call(HttpMethod method, String path, Object body) {
            HttpHeaders headers = new HttpHeaders();
            headers.add("Cookie", cookie);
            String payload = null;
            if (body != null) {
                headers.setContentType(MediaType.APPLICATION_JSON);
                try {
                    payload = objectMapper.writeValueAsString(body);
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            }
            ResponseEntity<String> res = rest.exchange(path, method, new HttpEntity<>(payload, headers), String.class);
            String renewed = res.getHeaders().getFirst("Set-Cookie");
            if (renewed != null && !renewed.contains("Max-Age=0")) cookie = renewed.split(";")[0];
            return res;
        }
    }

    private Person person(String label) {
        return person(label, null);
    }

    private Person person(String label, String role) {
        int n = SEQ.incrementAndGet();
        String secret = "pw-" + UUID.randomUUID();
        User user = new User();
        user.setUsername("acct_" + label + "_" + n);
        user.setEmail("acct_" + label + "_" + n + "@test.com");
        user.setPassword(passwordEncoder.encode(secret));
        if (role != null) user.setRole(role);
        User saved = userRepository.save(user);
        ResponseEntity<String> res = login(saved.getEmail(), secret);
        assertEquals(200, res.getStatusCode().value(), "login should succeed");
        return new Person(saved.getId(), saved.getUsername(), saved.getEmail(), secret, cookieOf(res));
    }

    private ResponseEntity<String> login(String email, String password) {
        return rest.postForEntity("/api/auth/login", entity(Map.of("email", email, "password", password)), String.class);
    }

    private static String cookieOf(ResponseEntity<String> res) {
        String cookie = res.getHeaders().getFirst("Set-Cookie");
        assertNotNull(cookie, "login must return a session cookie");
        return cookie.split(";")[0];
    }

    private HttpEntity<String> entity(Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        try {
            return new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private void connect(Person a, Person b) {
        assertEquals(200, a.post("/api/riders/add", Map.of("userId", a.id, "riderId", b.id)).getStatusCode().value());
    }

    private long createOrg(Person owner, String name) throws Exception {
        ResponseEntity<String> res = owner.post("/api/organizations",
                Map.of("name", name, "orgType", "TRANSPORT", "visibility", "PUBLIC"));
        assertEquals(201, res.getStatusCode().value(), res.getBody());
        return json(res).at("/card/id").asLong();
    }

    private long createRide(Person owner, String rideType, List<Long> participantIds) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("rideType", rideType);
        body.put("fromName", "Chennai");
        body.put("fromLat", 13.08);
        body.put("fromLng", 80.27);
        body.put("destinationName", "Vellore");
        body.put("destinationLat", 12.91);
        body.put("destinationLng", 79.13);
        if (participantIds != null) body.put("participantIds", participantIds);
        ResponseEntity<String> res = owner.post("/api/rides", body);
        assertEquals(200, res.getStatusCode().value(), res.getBody());
        return json(res).get("id").asLong();
    }

    private JsonNode json(ResponseEntity<String> response) throws Exception {
        assertNotNull(response.getBody(), "expected a body, got status " + response.getStatusCode());
        return objectMapper.readTree(response.getBody());
    }
}
