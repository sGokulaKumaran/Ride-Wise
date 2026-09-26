// ============================================================
// ☁️ Cloudflare Pages Function — API proxy
//
// WHY THIS EXISTS
//   Netlify can proxy /api/* via netlify.toml, but Cloudflare
//   Pages CANNOT proxy to external domains from _redirects
//   ("Proxying will only support relative URLs on your site").
//   Without this function, POST /api/auth/login hits the static
//   asset server and returns 405 Method Not Allowed.
//
// HOW IT WORKS
//   Every /api/* request is forwarded server-side to the Spring
//   Boot backend on Render. The browser still talks to the same
//   origin (ride-wise.pages.dev), so the session cookie is
//   first-party and SameSite never blocks it.
//
// ROUTE
//   /functions/api/[[path]].js  ->  matches /api/* (all methods,
//   all sub-paths). The [[path]] catch-all is what makes every
//   verb work; a plain single-segment route would 405 on POST.
//
// NOTE
//   _redirects rules are ignored for requests handled by Pages
//   Functions, so this file intentionally owns the /api namespace.
// ============================================================

const BACKEND = "https://ride-wise-kif0.onrender.com";

// Hop-by-hop / transport headers that must NOT be forwarded.
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "cf-connecting-ip",
  "cf-ray",
]);

function forwardable(headers) {
  const out = {};
  headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) out[key] = value;
  });
  return out;
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // path = every segment after /api/  (e.g. "auth/login")
  const path = url.pathname.replace(/^\/api\/?/, "");
  const search = url.search;

  const target = `${BACKEND}/api/${path}${search}`;

  // GET/HEAD must not carry a body; everything else passes through.
  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";

  let body;
  if (hasBody) {
    const buf = await request.arrayBuffer();
    body = buf.byteLength ? buf : undefined;
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      method,
      headers: forwardable(request.headers),
      body,
      redirect: "manual",
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Bad Gateway",
        message: `Could not reach backend: ${err?.message || err}`,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Copy response headers, preserving multiple Set-Cookie values.
  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) resHeaders.append(key, value);
  });

  const setCookies =
    typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie()
      : [];
  resHeaders.delete("set-cookie");
  setCookies.forEach((c) => resHeaders.append("Set-Cookie", c));

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}
