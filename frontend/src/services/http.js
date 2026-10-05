// ============================================================
// http.js — one fetch wrapper for every RideWise API module
//
// WHY THIS EXISTS
//   Each service used to call fetch() directly and build its own
//   errors. That made three things impossible to do consistently:
//
//   1. Tell "the server is unreachable" apart from "the server said no".
//      The ride API's offline fallback treated a 403/400 answer as
//      "backend offline" and reported success from localStorage, so the
//      UI said "Ride ended" while the ride was still active on the server.
//
//   2. React to an expired / revoked session. A 401 on any call now
//      raises one app-wide event (AUTH_EXPIRED_EVENT); AuthContext
//      listens and sends the rider back to the login page instead of
//      leaving them on a page where every request silently fails.
//
//   3. Show the server's own message ("Username is already taken")
//      instead of "Create ride failed: 409".
//
// EXPORTS
//   ApiError            error with .status and .offline
//   apiFetch(url, o)    fetch + session cookie + 401 handling → Response
//   apiJson(url, o)     apiFetch + JSON parsing, throws ApiError on non-2xx
//   jsonBody(m, body)   builds { method, headers, body } for JSON requests
//   isOffline(err)      true when the backend could not be reached
// ============================================================

export const AUTH_EXPIRED_EVENT = "rw:auth-expired";

export class ApiError extends Error {
  constructor(message, { status = 0, offline = false } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;   // HTTP status, 0 when the request never got an answer
    this.offline = offline; // true → backend unreachable (network / gateway)
  }
}

// True when the backend could not be reached at all — the only case in
// which a localStorage fallback is allowed to stand in for the server.
export function isOffline(err) {
  return Boolean(err && err.offline);
}

// Build fetch options for a JSON request body.
export function jsonBody(method, body) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  };
}

// What to say when an error answer carries no message of its own (a proxy
// page, or the server refusing the request before it reached our code —
// e.g. a web address that is not on the backend's allowed-origins list).
function fallbackMessage(status) {
  switch (status) {
    case 403: return "RideWise refused that request. Reload the page and try again.";
    case 404: return "That couldn't be found — it may have been removed.";
    case 413: return "That's too much to send in one go.";
    case 429: return "Too many attempts. Please wait a little and try again.";
    default: return `Something went wrong (${status}). Please try again.`;
  }
}

// Pull a human-readable message out of an error response.
// Returns { message, fromServer } — fromServer is false when the body is
// not the backend's own { message } JSON (i.e. a proxy/gateway page).
async function readError(res) {
  let message = fallbackMessage(res.status);
  let fromServer = false;
  try {
    const text = await res.text();
    if (text) {
      const body = JSON.parse(text);
      if (body && typeof body.message === "string" && body.message) {
        message = body.message;
        fromServer = true;
      } else if (typeof body === "string" && body) {
        message = body;
        fromServer = true;
      }
    }
  } catch {
    // Not JSON — a proxy error page or an empty body. Keep the generic text.
  }
  return { message, fromServer };
}

// fetch() with the session cookie attached and one place that notices a
// lost session. Never throws for HTTP error statuses — only when the
// request could not be completed at all.
export async function apiFetch(url, options = {}) {
  let res;
  try {
    res = await fetch(url, { credentials: "include", ...options });
  } catch (err) {
    if (err && err.name === "AbortError") throw err; // caller cancelled it
    throw new ApiError("Can't reach RideWise right now. Check your connection.", {
      offline: true,
    });
  }

  // A 401 from anything except the auth endpoints means the session is
  // gone (expired, or the account was suspended). Tell the app once.
  if (res.status === 401 && !String(url).includes("/api/auth/")) {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
  return res;
}

// apiFetch + JSON. Resolves to the parsed body (null for an empty one);
// rejects with ApiError carrying the server's message.
export async function apiJson(url, options = {}) {
  const res = await apiFetch(url, options);

  if (!res.ok) {
    const { message, fromServer } = await readError(res);
    // 502/503/504 are gateway answers (Render asleep, proxy cannot connect).
    // A 5xx whose body is not our JSON is the dev proxy failing to reach
    // Spring Boot. Both mean "backend unreachable", not "request refused".
    const gateway = res.status === 502 || res.status === 503 || res.status === 504;
    const offline = gateway || (res.status >= 500 && !fromServer);
    throw new ApiError(
      offline ? "RideWise is starting up or unreachable. Please try again." : message,
      { status: res.status, offline },
    );
  }

  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError("RideWise sent an unreadable response.", { status: res.status });
  }
}
