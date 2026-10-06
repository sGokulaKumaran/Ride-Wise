package vehicle.ridewise.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

// ============================================================
// FleetBroadcaster — who is watching which vehicle / organization, and
// the fan-out that pushes an event to them.
//
// WHAT PEOPLE WATCH
//   a VEHICLE       someone tracking one bus
//   an ORGANIZATION the fleet map, or an organization's page
//
// Trips are deliberately NOT what is watched. A trip ends and another
// begins; a person tracking "Bus 01" must simply see it go live again,
// not be left on a channel that died with the previous trip.
//
// Every event carries its vehicleId and orgId, and publish() delivers it
// to that vehicle's watchers AND that organization's watchers.
//
// SENDING SAFELY (same approach as RideLocationBroadcaster)
//   Each socket is wrapped once in ConcurrentWebSocketSessionDecorator:
//   sends are queued per socket, and a client that cannot keep up is
//   disconnected instead of holding up everyone else's updates.
//
// One socket watches one thing at a time.
// ============================================================
@Component
public class FleetBroadcaster {

    private static final Logger log = LoggerFactory.getLogger(FleetBroadcaster.class);
    private static final int SEND_TIME_LIMIT_MS = 5_000;
    private static final int BUFFER_LIMIT_BYTES = 256 * 1024;

    /** What one socket is watching. */
    private record Watch(Long orgId, Long vehicleId) {}

    private final ObjectMapper objectMapper;

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>(); // socket id → wrapper
    private final Map<String, Long> sessionUser = new ConcurrentHashMap<>();           // socket id → user id
    private final Map<String, Watch> watching = new ConcurrentHashMap<>();             // socket id → watch
    private final Map<Long, Set<String>> vehicleWatchers = new ConcurrentHashMap<>();  // vehicle id → socket ids
    private final Map<Long, Set<String>> orgWatchers = new ConcurrentHashMap<>();      // org id → socket ids

    public FleetBroadcaster(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    // ── Connections ──

    public void register(WebSocketSession session, Long userId) {
        sessions.put(session.getId(),
                new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, BUFFER_LIMIT_BYTES));
        sessionUser.put(session.getId(), userId);
    }

    public void unregister(WebSocketSession session) {
        unwatch(session.getId());
        sessions.remove(session.getId());
        sessionUser.remove(session.getId());
    }

    // ── Subscriptions ──

    public void watchVehicle(WebSocketSession session, Long orgId, Long vehicleId) {
        unwatch(session.getId());
        vehicleWatchers.computeIfAbsent(vehicleId, k -> ConcurrentHashMap.newKeySet()).add(session.getId());
        watching.put(session.getId(), new Watch(orgId, vehicleId));
    }

    public void watchOrg(WebSocketSession session, Long orgId) {
        unwatch(session.getId());
        orgWatchers.computeIfAbsent(orgId, k -> ConcurrentHashMap.newKeySet()).add(session.getId());
        watching.put(session.getId(), new Watch(orgId, null));
    }

    public void unwatch(WebSocketSession session) {
        unwatch(session.getId());
    }

    private void unwatch(String socketId) {
        Watch watch = watching.remove(socketId);
        if (watch == null) return;
        if (watch.vehicleId() != null) removeFrom(vehicleWatchers, watch.vehicleId(), socketId);
        else removeFrom(orgWatchers, watch.orgId(), socketId);
    }

    private static void removeFrom(Map<Long, Set<String>> index, Long key, String socketId) {
        Set<String> ids = index.get(key);
        if (ids == null) return;
        ids.remove(socketId);
        if (ids.isEmpty()) index.remove(key, ids);
    }

    // ── Sending ──

    /** Send one payload (as JSON) to one socket. Best effort — never throws. */
    public void send(WebSocketSession session, Object payload) {
        String json = toJson(payload);
        if (json != null) deliver(session.getId(), new TextMessage(json));
    }

    /**
     * Send an event about one vehicle to everyone watching that vehicle or
     * its organization. vehicleId may be null for an organization-wide event.
     */
    public void publish(Long orgId, Long vehicleId, Object payload) {
        Set<String> targets = new HashSet<>();
        Set<String> byVehicle = vehicleId == null ? null : vehicleWatchers.get(vehicleId);
        Set<String> byOrg = orgId == null ? null : orgWatchers.get(orgId);
        if (byVehicle != null) targets.addAll(byVehicle);
        if (byOrg != null) targets.addAll(byOrg);
        if (targets.isEmpty()) return;

        String json = toJson(payload);
        if (json == null) return;
        TextMessage message = new TextMessage(json);
        for (String id : targets) deliver(id, message);
    }

    /**
     * Something that concerns the whole organization (an announcement):
     * goes to everyone watching the organization OR any one of its vehicles.
     */
    public void publishOrgWide(Long orgId, Object payload) {
        List<String> targets = new ArrayList<>();
        watching.forEach((socketId, watch) -> {
            if (orgId.equals(watch.orgId())) targets.add(socketId);
        });
        if (targets.isEmpty()) return;

        String json = toJson(payload);
        if (json == null) return;
        TextMessage message = new TextMessage(json);
        for (String id : targets) deliver(id, message);
    }

    // ── Access taken away ──

    /**
     * The organization became private, was suspended or deleted, or its
     * password was reset for everyone: stop sending to all its watchers and
     * tell them to ask again (those still allowed are simply let back in).
     */
    public void dropOrg(Long orgId) {
        drop(orgId, null);
    }

    /** One person's access to the organization was revoked. */
    public void dropUser(Long orgId, Long userId) {
        drop(orgId, userId);
    }

    private void drop(Long orgId, Long onlyUserId) {
        List<String> affected = new ArrayList<>();
        watching.forEach((socketId, watch) -> {
            if (!orgId.equals(watch.orgId())) return;
            if (onlyUserId != null && !onlyUserId.equals(sessionUser.get(socketId))) return;
            affected.add(socketId);
        });
        if (affected.isEmpty()) return;

        String json = toJson(Map.of("type", "access-changed", "orgId", orgId));
        for (String socketId : affected) {
            unwatch(socketId);
            if (json != null) deliver(socketId, new TextMessage(json));
        }
    }

    /** How many sockets watch a vehicle (diagnostics / tests). */
    public int vehicleWatcherCount(Long vehicleId) {
        Set<String> ids = vehicleWatchers.get(vehicleId);
        return ids == null ? 0 : ids.size();
    }

    private String toJson(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            log.warn("Could not serialize a fleet message: {}", e.getMessage());
            return null;
        }
    }

    private void deliver(String socketId, TextMessage message) {
        WebSocketSession target = sessions.get(socketId);
        if (target == null) return;
        try {
            if (target.isOpen()) target.sendMessage(message);
        } catch (Exception e) {
            // Includes "this client is too slow" — the decorator closes it.
            log.debug("Send to fleet socket {} failed: {}", socketId, e.getMessage());
        }
    }
}
