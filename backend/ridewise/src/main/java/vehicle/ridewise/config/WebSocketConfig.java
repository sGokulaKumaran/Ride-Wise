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
     * Browser origins allowed to open the ride socket. Overridable through
     * application.properties / an environment variable:
     *   ridewise.websocket.allowed-origins=https://a.com,https://b.com
     * so a new frontend domain never requires a code change.
     */
    @Value("${ridewise.websocket.allowed-origins:https://ride-wise.pages.dev,http://localhost:5173,https://ridewise38.netlify.app}")
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
                .setAllowedOrigins(origins);
    }
} // End of class
