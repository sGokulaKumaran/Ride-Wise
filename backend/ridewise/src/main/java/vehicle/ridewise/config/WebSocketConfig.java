package vehicle.ridewise.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import vehicle.ridewise.websocket.RideLocationSocketHandler;

// ============================================================
// WebSocketConfig — registers the live group-ride socket
//
// ENDPOINT: /ws/rides
//
// A raw WebSocket (not STOMP) is used deliberately: the frontend needs no
// extra dependency, and the handshake rides on the existing HttpSession
// cookie, so the same login that protects /api/** protects the socket.
//
// The allowed origins are the same list the REST API uses (AllowedOrigins),
// so a browser can only open the socket from the real app (local dev,
// Cloudflare, Netlify). This is defence-in-depth on top of the session
// requirement.
// ============================================================
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final RideLocationSocketHandler rideLocationSocketHandler;
    private final SessionHandshakeInterceptor sessionHandshakeInterceptor;
    private final AllowedOrigins allowedOrigins;

    public WebSocketConfig(RideLocationSocketHandler rideLocationSocketHandler,
                           SessionHandshakeInterceptor sessionHandshakeInterceptor,
                           AllowedOrigins allowedOrigins) {
        this.rideLocationSocketHandler = rideLocationSocketHandler;
        this.sessionHandshakeInterceptor = sessionHandshakeInterceptor;
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(rideLocationSocketHandler, "/ws/rides")
                .addInterceptors(sessionHandshakeInterceptor)
                // setAllowedOriginPatterns (not setAllowedOrigins): only the
                // pattern variant accepts wildcards, and it is what makes a
                // random tunnel URL such as https://xxx.trycloudflare.com pass
                // the handshake instead of being rejected with 403.
                // ridewise.websocket.allowed-origins (or ridewise.allowed-origins)
                // changes the list without a code change.
                .setAllowedOriginPatterns(allowedOrigins.forWebSocket());
    }
} // End of class
