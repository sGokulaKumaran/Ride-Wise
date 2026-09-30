// ============================================================
// rideSocket.js — Live group-ride location WebSocket client
//
// One socket, one ride at a time. Talks to the Spring Boot endpoint
// /ws/rides (raw JSON WebSocket, no STOMP dependency).
//
// AUTH: the browser sends the JSESSIONID cookie automatically during the
// handshake, so the backend can resolve the logged-in user. No token is
// handled here.
//
// FLOW:
//   connectRideSocket(rideId) → opens socket → sends { type: "subscribe" }
//   server replies  { type: "snapshot", locations: [...] }   (current)
//   then             { type: "location", location: {...} }    (live)
//   sendRideLocation({ lat, lng, accuracy }) pushes my position
//   closeRideSocket() stops reconnecting and closes the socket
//
// Connection is dropped whenever the ride ends / tracking stops, and
// nothing runs after the tab is closed (no background tracking).
// ============================================================

const WS_PATH = "/ws/rides";

let socket = null;
let currentRideId = null;
let handlers = {};
let reconnectTimer = null;
let backoffMs = 1000;
let closedByUs = false;

function wsUrl() {
  const secure = window.location.protocol === "https:";
  return `${secure ? "wss:" : "ws:"}//${window.location.host}${WS_PATH}`;
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
// opts: { onLocation, onSnapshot, onStatus, onError }
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
  backoffMs = 1000;
  if (socket) {
    try { socket.close(); } catch { /* already closing */ }
    socket = null;
  }
}
