package vehicle.ridewise;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import vehicle.ridewise.entity.Connection;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.repository.*;

import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

// ============================================================
// RideLocationSocketTests — end-to-end verification of the live
// group-ride location WebSocket.
//
// Boots the real server on a random port and opens actual WebSocket
// sessions, so it covers:
//   • authenticated handshake via the HttpSession cookie
//   • an active group member receiving another member's position
//   • the latest-location row being UPDATED (not duplicated)
//   • an outsider being rejected from the ride's socket
//   • an anonymous handshake being refused
// ============================================================
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RideLocationSocketTests {

    @LocalServerPort int port;

    @Autowired TestRestTemplate rest;
    @Autowired ObjectMapper objectMapper;
    @Autowired PasswordEncoder passwordEncoder;

    @Autowired UserRepository userRepository;
    @Autowired RideRepository rideRepository;
    @Autowired RideParticipantRepository participantRepository;
    @Autowired ConnectionRepository connectionRepository;
    @Autowired NotificationRepository notificationRepository;
    @Autowired LocationUpdateRepository locationUpdateRepository;
    @Autowired UserLocationRepository userLocationRepository;

    private Long adminId;
    private Long memberId;
    private Long outsiderId;
    private Long rideId;

    @BeforeEach
    void setUp() {
        adminId   = saveUser("ws_admin", "ws_admin@test.com");
        memberId  = saveUser("ws_member", "ws_member@test.com");
        outsiderId = saveUser("ws_outsider", "ws_outsider@test.com");
        connect(adminId, memberId); // outsider is deliberately NOT connected
    }

    @AfterEach
    void tearDown() {
        if (rideId != null) {
            locationUpdateRepository.deleteByRideId(rideId);
            userLocationRepository.deleteByRideId(rideId);
            participantRepository.deleteByRideId(rideId);
            notificationRepository.deleteAll(
                    notificationRepository.findAll().stream()
                            .filter(n -> rideId.equals(n.getRideId())).toList());
            rideRepository.findById(rideId).ifPresent(rideRepository::delete);
        }
        if (adminId != null) {
            userLocationRepository.deleteByUserId(adminId);
            participantRepository.deleteByUserId(adminId);
            notificationRepository.deleteByUserId(adminId);
            userRepository.findById(adminId).ifPresent(userRepository::delete);
        }
        if (memberId != null) {
            userLocationRepository.deleteByUserId(memberId);
            participantRepository.deleteByUserId(memberId);
            notificationRepository.deleteByUserId(memberId);
            userRepository.findById(memberId).ifPresent(userRepository::delete);
        }
        if (outsiderId != null) {
            userLocationRepository.deleteByUserId(outsiderId);
            participantRepository.deleteByUserId(outsiderId);
            notificationRepository.deleteByUserId(outsiderId);
            userRepository.findById(outsiderId).ifPresent(userRepository::delete);
        }
        connectionRepository.deleteAll(
                connectionRepository.findAll().stream()
                        .filter(c -> c.getUserId().equals(adminId) || c.getUserId().equals(memberId))
                        .toList());
        rideId = null;
    }

    // ── Members of the same ride see each other over the socket ──
    @Test
    void sameGroupMembersReceiveEachOthersLocations() throws Exception {
        String adminCookie = login(adminId);
        String memberCookie = login(memberId);
        rideId = createGroupRide(adminCookie, List.of(memberId));

        TestHandler adminHandler = new TestHandler();
        TestHandler memberHandler = new TestHandler();
        WebSocketSession adminWs = connect(adminCookie, adminHandler);
        WebSocketSession memberWs = connect(memberCookie, memberHandler);
        try {
            adminWs.sendMessage(new TextMessage(json(Map.of("type", "subscribe", "rideId", rideId))));
            memberWs.sendMessage(new TextMessage(json(Map.of("type", "subscribe", "rideId", rideId))));

            assertNotNull(adminHandler.await("subscribed", 5000), "admin subscribe ack");
            assertNotNull(memberHandler.await("subscribed", 5000), "member subscribe ack");

            // Admin publishes a position — the member must receive it live.
            adminWs.sendMessage(new TextMessage(json(Map.of(
                    "type", "location", "rideId", rideId,
                    "lat", 13.111, "lng", 80.222, "accuracy", 7))));

            JsonNode received = memberHandler.await("location", 5000);
            assertNotNull(received, "member should receive a live location");
            assertEquals(adminId, received.get("location").get("userId").asLong());
            assertEquals(13.111, received.get("location").get("lat").asDouble(), 1e-9);

            // A second fix must UPDATE the single latest row, not add a row.
            // (Real clients send every ~1.5 s; anything faster than 4/s is
            // dropped by the server's flood guard, so wait a moment.)
            Thread.sleep(350);
            adminWs.sendMessage(new TextMessage(json(Map.of(
                    "type", "location", "rideId", rideId, "lat", 13.333, "lng", 80.444))));

            // Wait for the member to get the updated value.
            JsonNode second = memberHandler.await("location", 5000);
            assertNotNull(second, "member should receive the updated location");
            assertEquals(13.333, second.get("location").get("lat").asDouble(), 1e-9);

            // REST snapshot (map open) must contain exactly ONE row for the admin.
            ResponseEntity<String> snap = getLiveLocations(memberCookie);
            JsonNode list = objectMapper.readTree(snap.getBody());
            long adminRows = 0;
            for (JsonNode n : list) {
                if (n.get("userId").asLong() == adminId) adminRows++;
            }
            assertEquals(1, adminRows, "latest-location table must hold one row per user");
        } finally {
            closeQuietly(adminWs);
            closeQuietly(memberWs);
        }
    }

    // ── A user outside the group ride cannot subscribe ──
    @Test
    void outsiderCannotSubscribe() throws Exception {
        String adminCookie = login(adminId);
        String outsiderCookie = login(outsiderId);
        rideId = createGroupRide(adminCookie, List.of(memberId));

        TestHandler handler = new TestHandler();
        WebSocketSession ws = connect(outsiderCookie, handler); // handshake ok (authenticated)
        try {
            ws.sendMessage(new TextMessage(json(Map.of("type", "subscribe", "rideId", rideId))));

            JsonNode error = handler.await("error", 5000);
            assertNotNull(error, "outsider must be told they are not a member");
            assertTrue(handler.awaitClosed(5000), "outsider socket should be closed after a rejected subscribe");
        } finally {
            closeQuietly(ws);
        }
    }

    // ── Stopping sharing deletes the stored position and tells the group ──
    @Test
    void stopSharingClearsOwnLocationAndNotifiesGroup() throws Exception {
        String adminCookie = login(adminId);
        String memberCookie = login(memberId);
        rideId = createGroupRide(adminCookie, List.of(memberId));

        TestHandler adminHandler = new TestHandler();
        WebSocketSession adminWs = connect(adminCookie, adminHandler);
        WebSocketSession memberWs = connect(memberCookie, new TestHandler());
        try {
            adminWs.sendMessage(new TextMessage(json(Map.of("type", "subscribe", "rideId", rideId))));
            memberWs.sendMessage(new TextMessage(json(Map.of("type", "subscribe", "rideId", rideId))));
            assertNotNull(adminHandler.await("subscribed", 5000), "admin subscribe ack");

            // The member publishes a position → the admin sees it.
            memberWs.sendMessage(new TextMessage(json(Map.of(
                    "type", "location", "rideId", rideId, "lat", 13.5, "lng", 80.5))));
            JsonNode seen = adminHandler.await("location", 5000);
            assertNotNull(seen, "admin should receive the member's live position");
            assertEquals(memberId, seen.get("location").get("userId").asLong());
            assertTrue(userLocationRepository.findByUserId(memberId).isPresent(),
                    "the latest-location row must exist while sharing");

            // The member stops sharing.
            memberWs.sendMessage(new TextMessage(json(Map.of("type", "stop", "rideId", rideId))));

            JsonNode cleared = adminHandler.await("location-cleared", 5000);
            assertNotNull(cleared, "the group must be told to remove that marker");
            assertEquals(memberId, cleared.get("userId").asLong());
            assertTrue(userLocationRepository.findByUserId(memberId).isEmpty(),
                    "stopping sharing must delete the stored position (no ghost marker)");
        } finally {
            closeQuietly(memberWs);
            closeQuietly(adminWs);
        }
    }

    // ── REST twin of "stop": DELETE /api/rides/{id}/live-location ──
    @Test
    void restClearRemovesOnlyMyOwnPosition() throws Exception {
        String adminCookie = login(adminId);
        String memberCookie = login(memberId);
        String outsiderCookie = login(outsiderId);
        rideId = createGroupRide(adminCookie, List.of(memberId));

        // Both members publish a position.
        ResponseEntity<String> adminPost = postLocation(adminCookie, 13.111, 80.222);
        assertEquals(200, adminPost.getStatusCode().value());
        ResponseEntity<String> memberPost = postLocation(memberCookie, 13.333, 80.444);
        assertEquals(200, memberPost.getStatusCode().value());

        // A non-member may not clear anything.
        ResponseEntity<String> outsiderDelete = deleteLiveLocation(outsiderCookie);
        assertEquals(403, outsiderDelete.getStatusCode().value(), "outsiders must be rejected");
        assertTrue(userLocationRepository.findByUserId(adminId).isPresent(),
                "the admin's position must survive an outsider's attempt");

        // The member clears theirs.
        ResponseEntity<String> memberDelete = deleteLiveLocation(memberCookie);
        assertEquals(204, memberDelete.getStatusCode().value());
        assertTrue(userLocationRepository.findByUserId(memberId).isEmpty(),
                "the member's own position must be deleted");
        assertTrue(userLocationRepository.findByUserId(adminId).isPresent(),
                "clearing must never touch another rider's position");
    }

    // ── A burst of positions cannot flood the group or the database ──
    @Test
    void rapidFirePositionsAreThrottled() throws Exception {
        String adminCookie = login(adminId);
        String memberCookie = login(memberId);
        rideId = createGroupRide(adminCookie, List.of(memberId));

        TestHandler memberHandler = new TestHandler();
        WebSocketSession adminWs = connect(adminCookie, new TestHandler());
        WebSocketSession memberWs = connect(memberCookie, memberHandler);
        try {
            adminWs.sendMessage(new TextMessage(json(Map.of("type", "subscribe", "rideId", rideId))));
            memberWs.sendMessage(new TextMessage(json(Map.of("type", "subscribe", "rideId", rideId))));
            assertNotNull(memberHandler.await("subscribed", 5000), "member subscribe ack");

            for (int i = 0; i < 10; i++) {
                adminWs.sendMessage(new TextMessage(json(Map.of(
                        "type", "location", "rideId", rideId, "lat", 13.0 + i * 0.001, "lng", 80.0))));
            }
            assertNotNull(memberHandler.await("location", 5000), "the first position is delivered");
            Thread.sleep(400);
            long delivered = 1 + memberHandler.messages.stream()
                    .filter(payload -> payload.contains("\"type\":\"location\"")).count();
            assertTrue(delivered <= 3, "10 instant positions must not all be relayed (got " + delivered + ")");
        } finally {
            closeQuietly(adminWs);
            closeQuietly(memberWs);
        }
    }

    // ── When the admin ends the ride, members watching it are told at once ──
    @Test
    void endingTheRideNotifiesEveryoneOnTheMap() throws Exception {
        String adminCookie = login(adminId);
        String memberCookie = login(memberId);
        rideId = createGroupRide(adminCookie, List.of(memberId));

        TestHandler memberHandler = new TestHandler();
        WebSocketSession memberWs = connect(memberCookie, memberHandler);
        try {
            memberWs.sendMessage(new TextMessage(json(Map.of("type", "subscribe", "rideId", rideId))));
            assertNotNull(memberHandler.await("subscribed", 5000), "member subscribe ack");

            // The member publishes a position, so there is live data to clean up.
            ResponseEntity<String> posted = postLocation(memberCookie, 13.2, 80.2);
            assertEquals(200, posted.getStatusCode().value());

            // The admin ends the ride over REST.
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.add("Cookie", adminCookie);
            ResponseEntity<String> ended = rest.exchange("/api/rides/" + rideId + "/status",
                    HttpMethod.PATCH, new HttpEntity<>(json(Map.of("status", "completed")), headers), String.class);
            assertEquals(200, ended.getStatusCode().value(), "the admin can end the ride");

            JsonNode event = memberHandler.await("ride-ended", 5000);
            assertNotNull(event, "the member must be told the ride ended");
            assertEquals(rideId.longValue(), event.get("rideId").asLong());
            assertEquals("completed", event.get("status").asText());
            assertEquals(adminId.longValue(), event.get("endedBy").asLong());

            // Live positions of a finished ride are gone, and it accepts no more.
            assertTrue(userLocationRepository.findByRideId(rideId).isEmpty(),
                    "a finished ride must not keep live positions");
            ResponseEntity<String> late = postLocation(memberCookie, 13.3, 80.3);
            assertEquals(400, late.getStatusCode().value(), "an ended ride accepts no positions");
        } finally {
            closeQuietly(memberWs);
        }
    }

    // ── A new rider added mid-ride is announced to the group ──
    @Test
    void addingARiderAnnouncesTheChange() throws Exception {
        Long friendId = saveUser("ws_friend", "ws_friend@test.com");
        connect(adminId, friendId);
        String adminCookie = login(adminId);
        String memberCookie = login(memberId);
        rideId = createGroupRide(adminCookie, List.of(memberId));

        TestHandler memberHandler = new TestHandler();
        WebSocketSession memberWs = connect(memberCookie, memberHandler);
        try {
            memberWs.sendMessage(new TextMessage(json(Map.of("type", "subscribe", "rideId", rideId))));
            assertNotNull(memberHandler.await("subscribed", 5000), "member subscribe ack");

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.add("Cookie", adminCookie);
            ResponseEntity<String> added = rest.postForEntity("/api/rides/" + rideId + "/participants",
                    new HttpEntity<>(json(Map.of("userId", friendId)), headers), String.class);
            assertEquals(200, added.getStatusCode().value(), "the admin can add a connected rider");

            assertNotNull(memberHandler.await("participants-changed", 5000),
                    "riders on the map must be told the group changed");
        } finally {
            closeQuietly(memberWs);
            connectionRepository.deleteAll(connectionRepository.findAll().stream()
                    .filter(c -> c.getUserId().equals(friendId) || c.getConnectedUserId().equals(friendId))
                    .toList());
            participantRepository.deleteByUserId(friendId);
            notificationRepository.deleteByUserId(friendId);
            userRepository.findById(friendId).ifPresent(userRepository::delete);
        }
    }

    // ── No session cookie → the handshake is refused ──
    @Test
    void anonymousHandshakeRejected() {
        assertThrows(Exception.class, () -> connect(null, new TestHandler()),
                "an unauthenticated WebSocket handshake must fail");
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

    private String json(Object body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }

    private String login(Long userId) throws Exception {
        User u = userRepository.findById(userId).orElseThrow();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String body = objectMapper.writeValueAsString(Map.of("email", u.getEmail(), "password", "pw"));

        ResponseEntity<String> res = rest.postForEntity(
                "/api/auth/login", new HttpEntity<>(body, headers), String.class);
        assertEquals(200, res.getStatusCode().value(), "login should succeed");
        String cookie = res.getHeaders().getFirst("Set-Cookie");
        assertNotNull(cookie, "login must return a session cookie");
        return cookie.split(";")[0]; // "SESSION=..."
    }

    private Long createGroupRide(String cookie, List<Long> participantIds) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("rideType", "group");
        body.put("participantIds", participantIds);
        body.put("fromName", "Chennai");
        body.put("fromLat", 13.08);
        body.put("fromLng", 80.27);
        body.put("destinationName", "Vellore");
        body.put("destinationLat", 12.91);
        body.put("destinationLng", 79.13);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.add("Cookie", cookie);

        ResponseEntity<String> res = rest.postForEntity(
                "/api/rides", new HttpEntity<>(json(body), headers), String.class);
        assertEquals(200, res.getStatusCode().value(), "group ride creation should succeed");
        return objectMapper.readTree(res.getBody()).get("id").asLong();
    }

    private ResponseEntity<String> getLiveLocations(String cookie) {
        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", cookie);
        return rest.exchange("/api/rides/" + rideId + "/live-locations",
                HttpMethod.GET, new HttpEntity<>(headers), String.class);
    }

    /** POST /api/rides/{id}/location — the REST twin of the socket "location" message. */
    private ResponseEntity<String> postLocation(String cookie, double lat, double lng) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.add("Cookie", cookie);

        Map<String, Object> body = new HashMap<>();
        body.put("lat", lat);
        body.put("lng", lng);

        return rest.exchange("/api/rides/" + rideId + "/location",
                HttpMethod.POST, new HttpEntity<>(json(body), headers), String.class);
    }

    /** DELETE /api/rides/{id}/live-location — "I stopped sharing my position". */
    private ResponseEntity<String> deleteLiveLocation(String cookie) {
        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", cookie);
        return rest.exchange("/api/rides/" + rideId + "/live-location",
                HttpMethod.DELETE, new HttpEntity<>(headers), String.class);
    }

    private WebSocketSession connect(String cookie, TestHandler handler) throws Exception {
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        if (cookie != null) headers.add("Cookie", cookie);
        URI uri = URI.create("ws://localhost:" + port + "/ws/rides");
        return new StandardWebSocketClient()
                .execute(handler, headers, uri)
                .get(5, TimeUnit.SECONDS);
    }

    private void closeQuietly(WebSocketSession ws) {
        try { if (ws != null && ws.isOpen()) ws.close(); } catch (Exception ignored) { }
    }

    /** Collects messages and lets a test wait for a specific message type. */
    static class TestHandler extends TextWebSocketHandler {
        final BlockingQueue<String> messages = new LinkedBlockingQueue<>();
        volatile boolean closed = false;

        @Override
        protected void handleTextMessage(WebSocketSession session, TextMessage message) {
            messages.add(message.getPayload());
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
            closed = true;
        }

        boolean awaitClosed(long timeoutMs) throws InterruptedException {
            long deadline = System.currentTimeMillis() + timeoutMs;
            while (!closed && System.currentTimeMillis() < deadline) {
                Thread.sleep(25);
            }
            return closed;
        }

        JsonNode await(String type, long timeoutMs) throws Exception {
            long deadline = System.currentTimeMillis() + timeoutMs;
            ObjectMapper mapper = new ObjectMapper();
            while (System.currentTimeMillis() < deadline) {
                String payload = messages.poll(Math.max(1, deadline - System.currentTimeMillis()),
                        TimeUnit.MILLISECONDS);
                if (payload == null) return null;
                JsonNode node = mapper.readTree(payload);
                if (type.equals(node.path("type").asText())) return node;
            }
            return null;
        }
    }
}
