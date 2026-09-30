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
