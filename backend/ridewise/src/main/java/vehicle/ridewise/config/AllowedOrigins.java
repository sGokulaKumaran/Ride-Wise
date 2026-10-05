package vehicle.ridewise.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;

// ============================================================
// AllowedOrigins — the ONE list of websites allowed to call this backend
//
// The REST API (WebConfig) and the live-ride socket (WebSocketConfig) used
// to keep two separate lists. They drifted: only the socket's list could be
// changed without editing code, and the REST list knew exactly one local
// address (http://localhost:5173). When Vite picked the next free port
// (5174, ...) every request failed with a bare "403" and no explanation.
//
// HOW TO CHANGE IT (no code change needed)
//   ridewise.allowed-origins=https://my-site.com,https://*.trycloudflare.com
//   (or the environment variable RIDEWISE_ALLOWED_ORIGINS)
//
//   ridewise.websocket.allowed-origins still works and, when set, applies
//   to the socket only — existing deployments keep behaving the same.
//
// PATTERN SYNTAX (Spring "origin patterns")
//   https://*.trycloudflare.com   any sub-domain
//   http://localhost:[*]          any port
//   Separate entries with commas.
//
// Local development is allowed on any port. That is safe to leave on in
// production: the session cookie is SameSite=Lax, so a page on somebody's
// localhost cannot send a rider's login to the real backend.
// ============================================================
@Component
public class AllowedOrigins {

    static final String DEFAULTS =
            "https://ride-wise.pages.dev,"
            + "https://ridewise38.netlify.app,"
            + "http://localhost:[*],"
            + "http://127.0.0.1:[*],"
            + "https://*.trycloudflare.com,"
            + "https://*.ngrok-free.app,"
            + "https://*.ngrok.app";

    private final String[] rest;
    private final String[] webSocket;

    public AllowedOrigins(
            @Value("${ridewise.allowed-origins:" + DEFAULTS + "}") String rest,
            @Value("${ridewise.websocket.allowed-origins:${ridewise.allowed-origins:" + DEFAULTS + "}}") String webSocket) {
        this.rest = parse(rest);
        this.webSocket = parse(webSocket);
    }

    /** Origin patterns allowed to call /api/**. */
    public String[] forRest() {
        return rest.clone();
    }

    /** Origin patterns allowed to open /ws/rides. */
    public String[] forWebSocket() {
        return webSocket.clone();
    }

    // Split on commas, except inside a port list such as ":[8080,8081]".
    private static String[] parse(String value) {
        return Arrays.stream(value.split(",(?![^\\[]*\\])"))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toArray(String[]::new);
    }
}
