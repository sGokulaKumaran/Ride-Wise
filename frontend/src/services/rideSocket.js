// ============================================================
// rideSocket.js — Live group-ride location WebSocket client
//
// One socket, one ride at a time. Talks to the Spring Boot endpoint
// /ws/rides (raw JSON WebSocket, no STOMP dependency).
//
// AUTH: the browser sends the session cookie (SESSION) automatically during
// the handshake, so the backend can resolve the logged-in user. No token is
// handled here. That is also why the socket connects to the PAGE'S OWN
// ORIGIN by default — a first-party cookie is always sent, while a
// cross-site one would be blocked by SameSite.
//
// WHERE THE SOCKET POINTS:
//   • dev        → ws://localhost:5173/ws/rides  → vite.config.js proxies
//                  /ws (ws:true) to Spring Boot on :8080
//   • production → wss://<site-domain>/ws/rides  → the Cloudflare Pages
//                  function in functions/ws/[[path]].js forwards the
//                  upgrade to the Render backend, so the cookie stays
//                  first-party
//   • override   → set VITE_WS_URL (e.g. wss://ride-wise-kif0.onrender.com)
//                  at build time to talk to the backend host directly
//
// FLOW:
//   connectRideSocket(rideId) → opens socket → sends { type: "subscribe" }
//   server replies  { type: "snapshot", locations: [...] }   (current)
//   then             { type: "location", location: {...} }    (live)
//   sendRideLocation({ lat, lng, accuracy }) pushes my position
//   sendRideStop(rideId) tells the group I stopped sharing
//                    → server replies { type: "location-cleared", userId }
//   server may also send
//                    { type: "participants-changed" }  a rider joined / left
//                    { type: "ride-ended", status, endedBy }  the ride is over
//   closeRideSocket() stops reconnecting and closes the socket
//
// Connection is dropped whenever the ride ends / tracking stops, and
// nothing runs after the tab is closed (no background tracking).
// ============================================================

const WS_PATH = "/ws/rides";
const PING_EVERY_MS = 25_000;

// Optional absolute override. Vite replaces import.meta.env.VITE_WS_URL at
// build time; an empty/undefined value falls back to the page's own origin.
const CONFIGURED_WS_URL = (import.meta.env.VITE_WS_URL || "").trim();

let socket = null;
let currentRideId = null;
let handlers = {};
let reconnectTimer = null;
let pingTimer = null;
let backoffMs = 1000;
let closedByUs = false;

function wsUrl() {
  const base = CONFIGURED_WS_URL
    ? CONFIGURED_WS_URL
    : `${window.location.protocol}//${window.location.host}`;

  // http(s)://host → ws(s)://host, and drop any trailing slash
  const wsBase = base.replace(/^http/i, "ws").replace(/\/+$/, "");
  return `${wsBase}${WS_PATH}`;
}

function notifyStatus(status) {
  try { handlers.onStatus?.(status); } catch { /* ignore */ }
}

function open() {
  if (!currentRideId) return;

  try {
    socket = new WebSocket(wsUrl());
  } catch {
    handlers.onError?.("Could not open location socket");
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    backoffMs = 1000;
    notifyStatus("connected");
    sendJson({ type: "subscribe", rideId: currentRideId });
    clearInterval(pingTimer);
    pingTimer = setInterval(() => sendJson({ type: "ping" }), PING_EVERY_MS);
  };

  socket.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    switch (msg.type) {
      case "snapshot":
        handlers.onSnapshot?.(msg.locations || []);
        break;
      case "location":
        if (msg.location) handlers.onLocation?.(msg.location);
        break;
      case "location-cleared":
        // A rider stopped sharing — drop their marker immediately instead
        // of waiting for the staleness window (requirement 8/9).
        if (msg.userId != null) handlers.onLocationCleared?.(msg.userId);
        break;
      case "participants-changed":
        // Someone joined or left — refresh the riders list right away
        // instead of waiting for the next poll.
        handlers.onParticipantsChanged?.();
        break;
      case "ride-ended":
        // The admin ended (or deleted) the ride. Stop reconnecting — the
        // server would refuse the subscription anyway — and tell the map.
        // endedBy is the user id of whoever ended it (null: ended by the
        // server itself), so the rider who tapped "End ride" can tell the
        // echo of their own action from someone else's.
        closedByUs = true;
        handlers.onRideEnded?.(msg.status || "completed", msg.endedBy ?? null);
        break;
      case "error":
        handlers.onError?.(msg.message || "Location sharing error");
        break;
      default:
        // "connected" / "subscribed" — no UI action needed
        break;
    }
  };

  socket.onerror = () => {
    notifyStatus("error");
  };

  socket.onclose = () => {
    clearInterval(pingTimer);
    pingTimer = null;
    notifyStatus("disconnected");
    socket = null;
    if (!closedByUs) scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (closedByUs || !currentRideId || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    open();
  }, backoffMs);
  backoffMs = Math.min(backoffMs * 2, 10000);
}

function sendJson(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  try {
    socket.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// connectRideSocket — open (or reuse) the socket for one ride
// opts: { onSnapshot, onLocation, onLocationCleared,
//         onParticipantsChanged, onRideEnded, onStatus, onError }
// ============================================================
export function connectRideSocket(rideId, opts = {}) {
  if (!rideId) return;

  handlers = { ...handlers, ...opts };

  // Already connected to the same ride — just refresh callbacks.
  if (socket && currentRideId === rideId &&
      (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  // Switching rides (or reconnecting) — start clean.
  hardClose();
  currentRideId = rideId;
  closedByUs = false;
  open();
}

// ============================================================
// sendRideLocation — push MY current position to the backend.
// Returns true when it went out over the socket. Callers may fall
// back to the REST endpoint when this returns false.
// ============================================================
export function sendRideLocation(loc, rideId) {
  const targetRide = rideId ?? currentRideId;
  if (!loc || targetRide == null) return false;
  return sendJson({
    type: "location",
    rideId: targetRide,
    lat: loc.lat,
    lng: loc.lng,
    accuracy: loc.accuracy ?? null,
  });
}

export function isRideSocketOpen() {
  return !!socket && socket.readyState === WebSocket.OPEN;
}

// ============================================================
// sendRideStop — tell the backend I stopped sharing my location.
// Returns true when it went out over the socket; callers fall back to
// DELETE /api/rides/{rideId}/live-location when it returns false.
// ============================================================
export function sendRideStop(rideId) {
  const targetRide = rideId ?? currentRideId;
  if (targetRide == null) return false;
  return sendJson({ type: "stop", rideId: targetRide });
}

// ============================================================
// closeRideSocket — stop reconnecting and close the socket.
// Called when tracking stops, the ride ends, or the map unmounts.
// ============================================================
export function closeRideSocket() {
  hardClose();
  currentRideId = null;
  handlers = {};
}

function hardClose() {
  closedByUs = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  clearInterval(pingTimer);
  pingTimer = null;
  backoffMs = 1000;
  if (socket) {
    try { socket.close(); } catch { /* already closing */ }
    socket = null;
  }
}
