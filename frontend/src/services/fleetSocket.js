// ============================================================
// fleetSocket.js — the live channel of organization vehicles
//
// One WebSocket to /ws/fleet (raw JSON, same origin and same login cookie
// as rideSocket.js — see that file for why the socket points at the page's
// own origin). It serves two independent users at once:
//
//   A WATCHER   a screen following one vehicle or a whole fleet
//                 watchFleet({ vehicleId } | { orgId }, handlers) → stop()
//   A DRIVER    the trip in progress, sending its positions
//                 driveFleet(handlers) → stop()
//                 sendFleetPosition(sessionId, fix) → true when it went out
//
// The socket is open only while at least one of them is active, re-opens
// by itself after a drop (and asks for its watch again), and is kept alive
// with a small ping so proxies do not close a quiet line.
//
// WATCHER handlers
//   onEvent(message)   position · session-started · session-ended · sos ·
//                      crowd · vehicle-changed · announcement
//   onWatching()       the server accepted the watch — also after every
//                      reconnect, so this is the moment to (re)load the
//                      details over REST
//   onDenied(message)  not allowed (private organization, or access removed)
//   onStatus(status)   "connected" | "disconnected"
//
// DRIVER handlers
//   onTripEnded(sessionId, message)   the server no longer accepts
//                      positions for this trip (ended by an admin or
//                      automatically) — stop sending and tell the driver
//   onStatus(status)
// ============================================================

const WS_PATH = "/ws/fleet";
const PING_EVERY_MS = 25_000;
const CONFIGURED_WS_URL = (import.meta.env.VITE_WS_URL || "").trim();

let socket = null;
let reconnectTimer = null;
let pingTimer = null;
let backoffMs = 1000;

let watch = null;   // { target: { vehicleId } | { orgId }, handlers }
let driver = null;  // { handlers }

function wsUrl() {
  const base = CONFIGURED_WS_URL || `${window.location.protocol}//${window.location.host}`;
  return `${base.replace(/^http/i, "ws").replace(/\/+$/, "")}${WS_PATH}`;
}

const wanted = () => Boolean(watch || driver);
const isOpen = () => Boolean(socket) && socket.readyState === WebSocket.OPEN;

function call(handler, ...args) {
  try { handler?.(...args); } catch (err) { console.warn("[fleetSocket] handler failed:", err); }
}

function notifyStatus(status) {
  call(watch?.handlers.onStatus, status);
  call(driver?.handlers.onStatus, status);
}

function send(payload) {
  if (!isOpen()) return false;
  try {
    socket.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function sendWatch() {
  if (!watch) return;
  const { vehicleId, orgId } = watch.target;
  if (vehicleId != null) send({ type: "watch-vehicle", vehicleId: Number(vehicleId) });
  else if (orgId != null) send({ type: "watch-org", orgId: Number(orgId) });
}

function open() {
  if (!wanted() || socket) return;

  let next;
  try {
    next = new WebSocket(wsUrl());
  } catch {
    scheduleReconnect();
    return;
  }
  socket = next;

  next.onopen = () => {
    backoffMs = 1000;
    notifyStatus("connected");
    sendWatch();
    clearInterval(pingTimer);
    pingTimer = setInterval(() => send({ type: "ping" }), PING_EVERY_MS);
  };

  next.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    switch (msg.type) {
      case "connected":
      case "pong":
        break;
      case "watching":
        call(watch?.handlers.onWatching, msg);
        break;
      case "access-changed":
        // The server already stopped sending. Asking again tells us whether
        // we are still allowed (members are simply let back in).
        sendWatch();
        break;
      case "error":
        if (msg.code === "trip-ended") call(driver?.handlers.onTripEnded, msg.sessionId, msg.message);
        else if (msg.code === "forbidden" || msg.code === "not-found") call(watch?.handlers.onDenied, msg.message);
        break;
      default:
        call(watch?.handlers.onEvent, msg);
        break;
    }
  };

  next.onclose = () => {
    if (socket === next) socket = null;
    clearInterval(pingTimer);
    pingTimer = null;
    notifyStatus("disconnected");
    scheduleReconnect();
  };

  next.onerror = () => {
    // onclose follows and handles the retry
  };
}

function scheduleReconnect() {
  if (!wanted() || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    open();
  }, backoffMs);
  backoffMs = Math.min(backoffMs * 2, 15_000);
}

function closeIfIdle() {
  if (wanted()) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  clearInterval(pingTimer);
  pingTimer = null;
  backoffMs = 1000;
  if (socket) {
    const closing = socket;
    socket = null;
    closing.onclose = null;
    try { closing.close(); } catch { /* already closing */ }
  }
}

// ============================================================
// watchFleet — follow one vehicle ({ vehicleId }) or a fleet ({ orgId })
// One watch at a time: a new one replaces the previous.
// Returns stop().
// ============================================================
export function watchFleet(target, handlers = {}) {
  const mine = { target, handlers };
  watch = mine;
  if (isOpen()) sendWatch();
  else open();

  return () => {
    if (watch !== mine) return; // already replaced by another screen
    watch = null;
    send({ type: "unwatch" });
    closeIfIdle();
  };
}

// ============================================================
// driveFleet — keep the socket open for a trip's positions.
// Returns stop().
// ============================================================
export function driveFleet(handlers = {}) {
  const mine = { handlers };
  driver = mine;
  open();

  return () => {
    if (driver !== mine) return;
    driver = null;
    closeIfIdle();
  };
}

// One GPS fix of the trip in progress. Returns true when it went out over
// the socket — the caller falls back to the REST endpoint when it did not.
export function sendFleetPosition(sessionId, fix) {
  if (sessionId == null || !fix) return false;
  return send({
    type: "position",
    sessionId: Number(sessionId),
    lat: fix.lat,
    lng: fix.lng,
    accuracy: fix.accuracy ?? null,
    speed: fix.speed ?? null,
    heading: fix.heading ?? null,
    timestamp: fix.timestamp ?? null,
  });
}

// "Still here" when there is no position to send (no GPS signal). It says
// nothing about where the vehicle is — it only keeps a trip whose driver
// is clearly still on it from being ended as abandoned.
export function sendFleetAlive(sessionId) {
  if (sessionId == null) return false;
  return send({ type: "alive", sessionId: Number(sessionId) });
}

export function isFleetSocketOpen() {
  return isOpen();
}
