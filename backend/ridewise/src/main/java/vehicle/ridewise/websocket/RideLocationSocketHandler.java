package vehicle.ridewise.websocket; // Package declaration

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import vehicle.ridewise.config.SessionHandshakeInterceptor;
import vehicle.ridewise.dto.LiveLocationResponse;
import vehicle.ridewise.dto.UserLocationMessage;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.service.UserLocationService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

// ============================================================
// RideLocationSocketHandler — the live group-ride WebSocket
//
// ENDPOINT: /ws/rides  (handshake authenticated by SessionHandshakeInterceptor)
//
// MESSAGE PROTOCOL (JSON both ways):
//   client → { "type": "subscribe",   "rideId": 12 }
//   client → { "type": "unsubscribe" }
//   client → { "type": "location", "rideId": 12, "lat": .., "lng": .., "accuracy": .. }
//   client → { "type": "stop",     "rideId": 12 }   (rider stopped sharing)
//
//   server → { "type": "connected",  "userId": .. }
//   server → { "type": "subscribed", "rideId": .. }
//   server → { "type": "snapshot",   "rideId": .., "locations": [ ... ] }
//   server → { "type": "location",   "location": { ... } }
//   server → { "type": "location-cleared", "rideId": .., "userId": .. }
//   server → { "type": "error",      "message": ".." }
//
// SECURITY: the sender's id always comes from the handshake session, never
// from the message body. Subscribing and publishing both run through
// UserLocationService, which re-verifies the user belongs to the ride.
// ============================================================
@Component
public class RideLocationSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    private final UserLocationService userLocationService;
    private final RideLocationBroadcaster broadcaster;

    public RideLocationSocketHandler(ObjectMapper objectMapper,
                                     UserLocationService userLocationService,
                                     RideLocationBroadcaster broadcaster) {
        this.objectMapper = objectMapper;
        this.userLocationService = userLocationService;
        this.broadcaster = broadcaster;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Long userId = userIdOf(session);
        if (userId == null) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Not authenticated"));
            return;
        }
        send(session, Map.of("type", "connected", "userId", userId));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        Long userId = userIdOf(session);
        if (userId == null) {
            closeQuietly(session, CloseStatus.NOT_ACCEPTABLE.withReason("Not authenticated"));
            return;
        }

        UserLocationMessage msg;
        try {
            msg = objectMapper.readValue(message.getPayload(), UserLocationMessage.class);
        } catch (Exception e) {
            send(session, Map.of("type", "error", "message", "Malformed message"));
            return;
        }

        String type = msg.getType() == null ? "" : msg.getType().toLowerCase();
        switch (type) {
            case "subscribe" -> handleSubscribe(session, userId, msg);
            case "unsubscribe" -> broadcaster.unsubscribe(session);
            case "location" -> handleLocation(session, userId, msg);
            case "stop" -> handleStop(session, userId, msg);
            default -> send(session, Map.of("type", "error", "message", "Unknown message type"));
        }
    }

    // ── Subscribe to one ride (members only) ──
    private void handleSubscribe(WebSocketSession session, Long userId, UserLocationMessage msg) {
        Long rideId = msg.getRideId();

        if (!userLocationService.canSubscribe(rideId, userId)) {
            send(session, Map.of("type", "error", "message", "You are not a member of this ride"));
            closeQuietly(session, CloseStatus.POLICY_VIOLATION.withReason("Not a ride member"));
            return;
        }

        broadcaster.subscribe(session, rideId);
        send(session, Map.of("type", "subscribed", "rideId", rideId));

        // Requirement 7: hand the client the current positions immediately,
        // then live updates flow through broadcast().
        try {
            List<LiveLocationResponse> current =
                    userLocationService.getLiveLocations(rideId, userId);
            Map<String, Object> snapshot = new HashMap<>();
            snapshot.put("type", "snapshot");
            snapshot.put("rideId", rideId);
            snapshot.put("locations", current);
            send(session, snapshot);
        } catch (Exception e) {
            // Not fatal: the client still gets live updates.
        }
    }

    // ── Publish a position (members only, validated in the service) ──
    private void handleLocation(WebSocketSession session, Long userId, UserLocationMessage msg) {
        try {
            userLocationService.updateLocation(
                    msg.getRideId(), userId, msg.getLat(), msg.getLng(), msg.getAccuracy());
        } catch (ApiException e) {
            send(session, Map.of("type", "error", "message", e.getMessage()));
        } catch (Exception e) {
            send(session, Map.of("type", "error", "message", "Failed to store location"));
        }
    }

    // ── Stop sharing (requirement 10): delete my latest row and let the
    // group remove my marker right away. rideId is optional — when the
    // client omits it we fall back to the ride this socket subscribed to.
    private void handleStop(WebSocketSession session, Long userId, UserLocationMessage msg) {
        Long rideId = msg.getRideId() != null ? msg.getRideId() : broadcaster.rideOf(session);
        try {
            userLocationService.clearLocation(rideId, userId);
        } catch (ApiException e) {
            send(session, Map.of("type", "error", "message", e.getMessage()));
        } catch (Exception e) {
            send(session, Map.of("type", "error", "message", "Failed to clear location"));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        broadcaster.unsubscribe(session);
    }

    // ── Helpers ──

    private Long userIdOf(WebSocketSession session) {
        Object v = session.getAttributes().get(SessionHandshakeInterceptor.WS_USER_ID);
        return v instanceof Number ? ((Number) v).longValue() : null;
    }

    private void send(WebSocketSession session, Object payload) {
        try {
            if (session.isOpen()) {
                synchronized (session) {
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
                }
            }
        } catch (Exception e) {
            System.err.println("[RideSocket] send failed: " + e.getMessage());
        }
    }

    private void closeQuietly(WebSocketSession session, CloseStatus status) {
        try {
            if (session.isOpen()) session.close(status);
        } catch (Exception ignored) {
            // already closed
        }
    }
} // End of class
