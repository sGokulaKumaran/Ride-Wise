package vehicle.ridewise.websocket; // Package declaration

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

// ============================================================
// RideLocationBroadcaster — the in-memory "who is watching which ride"
// registry plus the fan-out that pushes a location to a group.
//
// WHY A SEPARATE COMPONENT:
//   Both the WebSocket handler and UserLocationService need the registry.
//   Keeping it here avoids a circular dependency between them.
//
// CONCURRENCY:
//   A ConcurrentHashMap<rideId, Set<WebSocketSession>> means every member
//   of a group ride is subscribed to exactly one bucket, and a broadcast
//   only ever touches that bucket — never other rides' sockets.
// ============================================================
@Component
public class RideLocationBroadcaster {

    private final ObjectMapper objectMapper;

    // rideId → sessions of the members currently subscribed to that ride
    private final Map<Long, Set<WebSocketSession>> rideSubscribers = new ConcurrentHashMap<>();

    // Which ride each session is currently subscribed to (for fast cleanup)
    private final Map<String, Long> sessionRide = new ConcurrentHashMap<>();

    public RideLocationBroadcaster(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /** Add a session to a ride's group. Also removes it from any previous group. */
    public void subscribe(WebSocketSession session, Long rideId) {
        unsubscribe(session); // one ride at a time

        rideSubscribers
                .computeIfAbsent(rideId, k -> ConcurrentHashMap.newKeySet())
                .add(session);
        sessionRide.put(session.getId(), rideId);
    }

    /** Remove a session from whatever ride it was watching. */
    public void unsubscribe(WebSocketSession session) {
        Long rideId = sessionRide.remove(session.getId());
        if (rideId == null) return;

        Set<WebSocketSession> set = rideSubscribers.get(rideId);
        if (set != null) {
            set.remove(session);
            if (set.isEmpty()) rideSubscribers.remove(rideId);
        }
    }

    /** Which ride a session is currently subscribed to (null when none). */
    public Long rideOf(WebSocketSession session) {
        return sessionRide.get(session.getId());
    }

    /** Number of members currently watching a ride (used for diagnostics). */
    public int subscriberCount(Long rideId) {
        Set<WebSocketSession> set = rideSubscribers.get(rideId);
        return set == null ? 0 : set.size();
    }

    /**
     * Send a payload OBJECT as JSON to every member of one group ride.
     * Sends are best-effort: a dead socket never breaks the others.
     */
    public void broadcast(Long rideId, Object payload) {
        Set<WebSocketSession> set = rideSubscribers.get(rideId);
        if (set == null || set.isEmpty()) return;

        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            System.err.println("[RideSocket] Failed to serialize broadcast payload: " + e.getMessage());
            return;
        }

        TextMessage message = new TextMessage(json);
        // Copy the set so a concurrent unsubscribe can't break iteration
        for (WebSocketSession session : Collections.unmodifiableSet(set)) {
            try {
                if (session.isOpen()) {
                    synchronized (session) { // WebSocketSession is not thread-safe
                        session.sendMessage(message);
                    }
                }
            } catch (Exception e) {
                System.err.println("[RideSocket] Broadcast to session " + session.getId() + " failed: " + e.getMessage());
            }
        }
    }
} // End of class
