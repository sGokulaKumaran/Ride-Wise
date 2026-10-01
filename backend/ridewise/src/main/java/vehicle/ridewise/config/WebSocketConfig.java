package vehicle.ridewise.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import vehicle.ridewise.websocket.RideLocationSocketHandler;

import java.util.Arrays;

// ============================================================
// WebSocketConfig — registers the live group-ride socket
//
// ENDPOINT: /ws/rides
//
// A raw WebSocket (not STOMP) is used deliberately: the frontend needs no
// extra dependency, and the handshake rides on the existing HttpSession
// cookie, so the same login that protects /api/** protects the socket.
//
// The allowed origins mirror the REST CORS list in WebConfig so a browser
// can only open the socket from the real app (localhost dev, Cloudflare,
// Netlify). This is defence-in-depth on top of the session requirement.
// ============================================================
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    /**
     * Browser origins allowed to open the ride socket — written as ORIGIN
     * PATTERNS, so wildcards are allowed:
     *   ridewise.websocket.allowed-origins=https://a.com,https://*.trycloudflare.com
     * A new frontend or tunnel domain therefore never requires a code change.
     * Exact origins (no wildcard) work exactly as before.
     */
    @Value("${ridewise.websocket.allowed-origins:https://ride-wise.pages.dev,http://localhost:5173,https://ridewise38.netlify.app,https://*.trycloudflare.com,https://*.ngrok-free.app,https://*.ngrok.app}")
    private String allowedOrigins;

    private final RideLocationSocketHandler rideLocationSocketHandler;

    public WebSocketConfig(RideLocationSocketHandler rideLocationSocketHandler) {
        this.rideLocationSocketHandler = rideLocationSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        String[] origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(o -> !o.isEmpty())
                .toArray(String[]::new);

        registry.addHandler(rideLocationSocketHandler, "/ws/rides")
                .addInterceptors(new SessionHandshakeInterceptor())
                // setAllowedOriginPatterns (not setAllowedOrigins): only the
                // pattern variant accepts wildcards, and it is what makes a
                // random tunnel URL such as https://xxx.trycloudflare.com pass
                // the handshake instead of being rejected with 403.
                .setAllowedOriginPatterns(origins);
    }
} // End of class
