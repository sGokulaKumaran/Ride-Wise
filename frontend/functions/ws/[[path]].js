// ============================================================
// ☁️ Cloudflare Pages Function — live-ride WebSocket proxy
//
// WHY THIS EXISTS
//   The browser opens the ride socket at /ws/rides on the PAGE'S OWN
//   origin, so the first-party session cookie (SESSION) is sent with the
//   handshake and the backend can authenticate the rider
//   (SessionHandshakeInterceptor). But the frontend is hosted on Cloudflare
//   Pages, and Pages serves static assets — without this function
//   /ws/rides returns the React index.html, the upgrade fails, and no
//   rider ever sees a live position. (Same reason functions/api/[[path]].js
//   exists for the REST calls.)
//
// HOW IT WORKS
//   The request is forwarded verbatim — headers (Cookie, Origin, Upgrade,
//   Sec-WebSocket-*) included — and the response is returned untouched.
//   When the incoming request carries `Upgrade: websocket`, the Workers
//   runtime performs the handshake with the backend and streams frames
//   in both directions, so this is a transparent WebSocket proxy.
//
// CONFIG
//   BACKEND below must match the Spring Boot service. Everything else
//   (session, ride membership, allowed origins) is checked by the backend
//   itself — this function only forwards.
// ============================================================

const BACKEND = "https://ride-wise-9am5.onrender.com";

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // /ws/rides?x=1 →https://ride-wise-9am5.onrender.com/ws/rides?x=1
  const target = `${BACKEND}${url.pathname}${url.search}`;

  try {
    return await fetch(new Request(target, request));
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Bad Gateway",
        message: `Could not reach the location socket backend: ${err?.message || err}`,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
