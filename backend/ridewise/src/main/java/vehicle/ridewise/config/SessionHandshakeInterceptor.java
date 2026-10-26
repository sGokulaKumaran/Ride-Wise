package vehicle.ridewise.config; // Package declaration

import jakarta.servlet.http.HttpSession;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
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
// The handshake is rejected (beforeHandshake returns false) when there is
// no authenticated session, when the account has been suspended, or when
// the session was signed out from another device — so none of them can
// open a ride socket.
// ============================================================
@Component
public class SessionHandshakeInterceptor implements HandshakeInterceptor {

    /** Attribute key on the WebSocketSession holding the authenticated user id. */
    public static final String WS_USER_ID = "wsUserId";

    private final UserStatusCache userStatusCache;

    public SessionHandshakeInterceptor(UserStatusCache userStatusCache) {
        this.userStatusCache = userStatusCache;
    }

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

            if (value instanceof Number number
                    && userStatusCache.check(number.longValue(), session.getCreationTime()) == UserStatusCache.SessionState.VALID) {
                attributes.put(WS_USER_ID, number.longValue());
                return true; // authenticated — allow the upgrade
            }
        }
        return false; // no usable session → reject the WebSocket handshake
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
        // nothing to do
    }
} // End of class
