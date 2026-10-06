package vehicle.ridewise.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import vehicle.ridewise.config.SessionHandshakeInterceptor;
import vehicle.ridewise.config.UserStatusCache;
import vehicle.ridewise.dto.OrgDtos.PositionRequest;
import vehicle.ridewise.entity.Organization;
import vehicle.ridewise.entity.Vehicle;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.repository.VehicleRepository;
import vehicle.ridewise.service.OrgGuard;
import vehicle.ridewise.service.VehicleSessionService;

import java.util.HashMap;
import java.util.Map;

// ============================================================
// FleetSocketHandler — the live channel of organization vehicles
//
// ENDPOINT: /ws/fleet   (same login cookie as the REST API — see
//                        SessionHandshakeInterceptor)
//
// CLIENT → SERVER
//   { "type": "watch-vehicle", "vehicleId": 12 }   follow one vehicle
//   { "type": "watch-org",     "orgId": 3 }        follow a whole fleet
//   { "type": "unwatch" }
//   { "type": "position", "sessionId": 40, "lat": …, "lng": …,
//     "accuracy": …, "speed": …, "heading": … }    the driver's GPS fix
//   { "type": "alive", "sessionId": 40 }           the driver's screen is
//                                                  open but has no position
//   { "type": "ping" }                             keeps the line open
//
// SERVER → CLIENT
//   connected · watching · pong · error
//   position          a vehicle moved
//   session-started   a vehicle went live          (then: load its details)
//   session-ended     a vehicle's trip ended
//   sos · crowd       emergency raised/cleared · seats changed
//   vehicle-changed   the fleet was edited
//   announcement      the organization posted or removed a message
//   access-changed    you may no longer watch this — ask again
//
// One socket watches ONE thing at a time; a new watch replaces the old.
// A driver's socket can send positions and watch nothing at all.
//
// Every watch is checked against OrgGuard, exactly like the REST API: a
// private organization's vehicles reach only people who are allowed to
// see them.
// ============================================================
@Component
public class FleetSocketHandler extends TextWebSocketHandler {

    private static final int MAX_MESSAGES_PER_SECOND = 8;
    private static final int MAX_WATCHES_PER_MINUTE = 40;

    private final ObjectMapper objectMapper;
    private final FleetBroadcaster broadcaster;
    private final OrgGuard guard;
    private final VehicleRepository vehicleRepository;
    private final VehicleSessionService sessionService;
    private final UserStatusCache userStatusCache;

    public FleetSocketHandler(ObjectMapper objectMapper,
                              FleetBroadcaster broadcaster,
                              OrgGuard guard,
                              VehicleRepository vehicleRepository,
                              VehicleSessionService sessionService,
                              UserStatusCache userStatusCache) {
        this.objectMapper = objectMapper;
        this.broadcaster = broadcaster;
        this.guard = guard;
        this.vehicleRepository = vehicleRepository;
        this.sessionService = sessionService;
        this.userStatusCache = userStatusCache;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Long userId = userIdOf(session);
        if (userId == null) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Not authenticated"));
            return;
        }
        broadcaster.register(session, userId);
        broadcaster.send(session, Map.of("type", "connected", "userId", userId));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        Long userId = userIdOf(session);
        if (userId == null || !userStatusCache.isActive(userId)) {
            closeQuietly(session, CloseStatus.NOT_ACCEPTABLE.withReason("Not authenticated"));
            return;
        }
        if (flooding(session)) return; // silently dropped — a normal client never gets here

        JsonNode msg;
        try {
            msg = objectMapper.readTree(message.getPayload());
        } catch (Exception e) {
            error(session, "bad-message", "Malformed message", null);
            return;
        }

        String type = msg.path("type").asText("").toLowerCase();
        switch (type) {
            case "position" -> handlePosition(session, userId, msg);
            case "alive" -> handleAlive(session, userId, msg);
            case "watch-vehicle" -> handleWatchVehicle(session, userId, msg);
            case "watch-org" -> handleWatchOrg(session, userId, msg);
            case "unwatch" -> broadcaster.unwatch(session);
            case "ping" -> broadcaster.send(session, Map.of("type", "pong"));
            default -> error(session, "bad-message", "Unknown message type", null);
        }
    }

    // ── A driver's GPS fix ──
    private void handlePosition(WebSocketSession session, Long userId, JsonNode msg) {
        Long sessionId = longOf(msg, "sessionId");
        try {
            sessionService.acceptPosition(sessionId, userId, new PositionRequest(
                    doubleOf(msg, "lat"), doubleOf(msg, "lng"), doubleOf(msg, "accuracy"),
                    doubleOf(msg, "speed"), doubleOf(msg, "heading"), longOf(msg, "timestamp")));
        } catch (ApiException e) {
            // 409 = the trip is over (ended by an admin or automatically):
            // the driver's screen must stop sending and say so.
            String code = e.getStatus().value() == 409 ? "trip-ended" : "position-refused";
            error(session, code, e.getMessage(), sessionId);
        } catch (Exception e) {
            error(session, "position-failed", "The position could not be stored", sessionId);
        }
    }

    // ── "Still here", without a position ──
    private void handleAlive(WebSocketSession session, Long userId, JsonNode msg) {
        Long sessionId = longOf(msg, "sessionId");
        try {
            sessionService.touch(sessionId, userId);
        } catch (ApiException e) {
            error(session, e.getStatus().value() == 409 ? "trip-ended" : "position-refused", e.getMessage(), sessionId);
        } catch (Exception e) {
            // nothing to tell the device
        }
    }

    // ── Follow one vehicle ──
    private void handleWatchVehicle(WebSocketSession session, Long userId, JsonNode msg) {
        if (tooManyWatches(session)) {
            error(session, "slow-down", "Too many requests", null);
            return;
        }
        Long vehicleId = longOf(msg, "vehicleId");
        try {
            Vehicle vehicle = vehicleId == null ? null : vehicleRepository.findById(vehicleId).orElse(null);
            if (vehicle == null) throw ApiException.notFound("Vehicle not found");
            Organization org = guard.requireOrg(vehicle.getOrgId());
            guard.requireView(org, userId);
            if ("RETIRED".equals(vehicle.getStatus()) && !guard.isManager(org.getId(), userId)) {
                throw ApiException.notFound("Vehicle not found");
            }

            broadcaster.watchVehicle(session, org.getId(), vehicleId);
            Map<String, Object> reply = new HashMap<>();
            reply.put("type", "watching");
            reply.put("vehicleId", vehicleId);
            reply.put("orgId", org.getId());
            broadcaster.send(session, reply);
        } catch (ApiException e) {
            broadcaster.unwatch(session);
            error(session, e.getStatus().value() == 403 ? "forbidden" : "not-found", e.getMessage(), null);
        } catch (Exception e) {
            error(session, "failed", "Could not start watching", null);
        }
    }

    // ── Follow a whole fleet ──
    private void handleWatchOrg(WebSocketSession session, Long userId, JsonNode msg) {
        if (tooManyWatches(session)) {
            error(session, "slow-down", "Too many requests", null);
            return;
        }
        Long orgId = longOf(msg, "orgId");
        try {
            Organization org = guard.requireOrg(orgId);
            guard.requireView(org, userId);

            broadcaster.watchOrg(session, org.getId());
            broadcaster.send(session, Map.of("type", "watching", "orgId", org.getId()));
        } catch (ApiException e) {
            broadcaster.unwatch(session);
            error(session, e.getStatus().value() == 403 ? "forbidden" : "not-found", e.getMessage(), null);
        } catch (Exception e) {
            error(session, "failed", "Could not start watching", null);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        broadcaster.unregister(session);
    }

    // ── Helpers ──

    private void error(WebSocketSession session, String code, String message, Long sessionId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "error");
        payload.put("code", code);
        payload.put("message", message);
        if (sessionId != null) payload.put("sessionId", sessionId);
        broadcaster.send(session, payload);
    }

    // More than a handful of messages in one second is not a phone sending
    // GPS fixes. Counters live on the socket itself (one thread handles a
    // socket's messages at a time).
    private boolean flooding(WebSocketSession session) {
        Map<String, Object> attrs = session.getAttributes();
        long second = System.currentTimeMillis() / 1000;
        Object window = attrs.get("fleetSecond");
        int count = window instanceof Long w && w == second && attrs.get("fleetCount") instanceof Integer c ? c : 0;
        attrs.put("fleetSecond", second);
        attrs.put("fleetCount", count + 1);
        return count >= MAX_MESSAGES_PER_SECOND;
    }

    // Each watch request costs a few database reads.
    private boolean tooManyWatches(WebSocketSession session) {
        Map<String, Object> attrs = session.getAttributes();
        long minute = System.currentTimeMillis() / 60_000;
        Object window = attrs.get("fleetWatchMinute");
        int count = window instanceof Long w && w == minute && attrs.get("fleetWatchCount") instanceof Integer c ? c : 0;
        attrs.put("fleetWatchMinute", minute);
        attrs.put("fleetWatchCount", count + 1);
        return count >= MAX_WATCHES_PER_MINUTE;
    }

    private static Long longOf(JsonNode msg, String field) {
        JsonNode node = msg.get(field);
        return node != null && node.isNumber() ? Long.valueOf(node.asLong()) : null;
    }

    private static Double doubleOf(JsonNode msg, String field) {
        JsonNode node = msg.get(field);
        return node != null && node.isNumber() ? Double.valueOf(node.asDouble()) : null;
    }

    private Long userIdOf(WebSocketSession session) {
        Object v = session.getAttributes().get(SessionHandshakeInterceptor.WS_USER_ID);
        return v instanceof Number ? ((Number) v).longValue() : null;
    }

    private void closeQuietly(WebSocketSession session, CloseStatus status) {
        try {
            if (session.isOpen()) session.close(status);
        } catch (Exception ignored) {
            // already closed
        }
    }
}
