package vehicle.ridewise.config; // Package declaration

import jakarta.servlet.http.HttpSession;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

// ============================================================
// SessionHandshakeInterceptor — authenticate the WebSocket handshake
//
// The REST API is gated by SessionAuthInterceptor, but that interceptor
// only covers /api/**. The WebSocket handshake is a plain HTTP GET, so we
// resolve the SAME server-side HttpSession here (Spring Session JDBC
// makes it available on the request) and copy the RIDEWISE_USER_ID into
// the WebSocket session attributes.
//
// If there is no authenticated session the handshake is rejected
// (beforeHandshake returns false), so an anonymous browser can never
// open a ride socket.
// ============================================================
public class SessionHandshakeInterceptor implements HandshakeInterceptor {

    /** Attribute key on the WebSocketSession holding the authenticated user id. */
    public static final String WS_USER_ID = "wsUserId";

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {

        if (request instanceof ServletServerHttpRequest servletRequest) {
            HttpSession session = servletRequest.getServletRequest().getSession(false);
            Object value = session != null
                    ? session.getAttribute(SessionAuthInterceptor.SESSION_USER_ID)
                    : null;

            if (value instanceof Number) {
                attributes.put(WS_USER_ID, ((Number) value).longValue());
                return true; // authenticated — allow the upgrade
            }
        }
        return false; // no session → reject the WebSocket handshake
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
        // nothing to do
    }
} // End of class
