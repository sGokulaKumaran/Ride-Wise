package vehicle.ridewise.websocket; // Package declaration

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.util.ArrayList;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

// ============================================================
// RideLocationBroadcaster — the in-memory "who is watching which ride"
// registry plus the fan-out that pushes a message to a group.
//
// WHY A SEPARATE COMPONENT:
//   Both the WebSocket handler and the services need the registry.
//   Keeping it here avoids a circular dependency between them.
//
// SENDING SAFELY:
//   A WebSocketSession must not be written to by two threads at once, and
//   a plain blocking send lets ONE slow or stalled phone hold up the
//   thread that is broadcasting to everybody else (the old code sent
//   inside `synchronized (session)`).
//
//   Every session is therefore wrapped once in Spring's
//   ConcurrentWebSocketSessionDecorator when it connects: sends are
//   queued per session, and a client that cannot keep up (send takes
//   longer than SEND_TIME_LIMIT_MS, or its queue exceeds BUFFER_LIMIT)
//   is disconnected instead of blocking the ride. ALL sends — replies
//   and broadcasts — go through that one wrapper.
//
// CONCURRENCY:
//   rideId → sessions. A broadcast only ever touches its own ride's
//   bucket — never other rides' sockets.
// ============================================================
@Component
public class RideLocationBroadcaster {

    private static final int SEND_TIME_LIMIT_MS = 5_000;
    private static final int BUFFER_LIMIT_BYTES = 128 * 1024;

    private final ObjectMapper objectMapper;

    // session id → its thread-safe wrapper (all connected sockets)
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    // rideId → session ids of the members currently subscribed to that ride
    private final Map<Long, Set<String>> rideSubscribers = new ConcurrentHashMap<>();

    // Which ride each session is currently subscribed to (for fast cleanup)
    private final Map<String, Long> sessionRide = new ConcurrentHashMap<>();

    public RideLocationBroadcaster(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /** Call once when a socket connects. */
    public void register(WebSocketSession session) {
        sessions.put(session.getId(),
                new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, BUFFER_LIMIT_BYTES));
    }

    /** Call once when a socket closes. */
    public void unregister(WebSocketSession session) {
        unsubscribe(session);
        sessions.remove(session.getId());
    }

    /** Add a session to a ride's group. Also removes it from any previous group. */
    public void subscribe(WebSocketSession session, Long rideId) {
        unsubscribe(session); // one ride at a time

        rideSubscribers
                .computeIfAbsent(rideId, k -> ConcurrentHashMap.newKeySet())
                .add(session.getId());
        sessionRide.put(session.getId(), rideId);
    }

    /** Remove a session from whatever ride it was watching. */
    public void unsubscribe(WebSocketSession session) {
        Long rideId = sessionRide.remove(session.getId());
        if (rideId == null) return;

        Set<String> ids = rideSubscribers.get(rideId);
        if (ids != null) {
            ids.remove(session.getId());
            if (ids.isEmpty()) rideSubscribers.remove(rideId, ids);
        }
    }

    /** Which ride a session is currently subscribed to (null when none). */
    public Long rideOf(WebSocketSession session) {
        return sessionRide.get(session.getId());
    }

    /** Number of members currently watching a ride (used for diagnostics). */
    public int subscriberCount(Long rideId) {
        Set<String> ids = rideSubscribers.get(rideId);
        return ids == null ? 0 : ids.size();
    }

    /** Send a payload OBJECT as JSON to one socket. Best effort — never throws. */
    public void send(WebSocketSession session, Object payload) {
        String json = toJson(payload);
        if (json != null) deliver(session.getId(), new TextMessage(json));
    }

    /**
     * Send a payload OBJECT as JSON to every member of one group ride.
     * Best effort: a dead or slow socket never affects the others.
     */
    public void broadcast(Long rideId, Object payload) {
        Set<String> ids = rideSubscribers.get(rideId);
        if (ids == null || ids.isEmpty()) return;

        String json = toJson(payload);
        if (json == null) return;

        TextMessage message = new TextMessage(json);
        for (String id : new ArrayList<>(ids)) { // a copy: subscribers may change meanwhile
            deliver(id, message);
        }
    }

    /**
     * The ride is over: forget everyone who was watching it. Their sockets
     * stay open (the client closes them when it handles "ride-ended").
     */
    public void closeRide(Long rideId) {
        Set<String> ids = rideSubscribers.remove(rideId);
        if (ids == null) return;
        for (String id : ids) sessionRide.remove(id, rideId);
    }

    private String toJson(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            System.err.println("[RideSocket] Failed to serialize a message: " + e.getMessage());
            return null;
        }
    }

    private void deliver(String sessionId, TextMessage message) {
        WebSocketSession target = sessions.get(sessionId);
        if (target == null) return;
        try {
            if (target.isOpen()) target.sendMessage(message);
        } catch (Exception e) {
            // Includes "this client is too slow" — the decorator closes it.
            System.err.println("[RideSocket] Send to session " + sessionId + " failed: " + e.getMessage());
        }
    }
} // End of class
