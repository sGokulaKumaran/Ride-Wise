package vehicle.ridewise.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import vehicle.ridewise.exception.ApiException;

import java.io.IOException;

// SessionAuthInterceptor — protects every /api endpoint except signup/login.
//
// The authenticated user id is stored in the server-side HttpSession at
// login. Controllers and services must use requireUserId(request) — never
// an id supplied by the browser.
//
// A request is let through only when
//   1. the session carries a user id, AND
//   2. that account still exists and is not suspended, and the session was
//      not signed out from another device (UserStatusCache).
// Otherwise the answer is 401, which the frontend treats as "signed out".
@Component
public class SessionAuthInterceptor implements HandlerInterceptor {

    public static final String SESSION_USER_ID = "RIDEWISE_USER_ID";
    public static final String SESSION_USER_ROLE = "RIDEWISE_USER_ROLE";
    public static final String REQUEST_USER_ID = "authenticatedUserId";

    private final UserStatusCache userStatusCache;

    public SessionAuthInterceptor(UserStatusCache userStatusCache) {
        this.userStatusCache = userStatusCache;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String path = request.getRequestURI();
        if (path.equals("/api/auth/login") || path.equals("/api/auth/signup")) {
            return true;
        }

        HttpSession session = request.getSession(false);
        Object value = session != null ? session.getAttribute(SESSION_USER_ID) : null;
        if (!(value instanceof Number)) {
            return reject(response, "Authentication required");
        }

        long userId = ((Number) value).longValue();
        UserStatusCache.SessionState state = userStatusCache.check(userId, session.getCreationTime());
        if (state != UserStatusCache.SessionState.VALID) {
            // Suspended or deleted while logged in, or signed out from another
            // device: end this session now.
            try {
                session.invalidate();
            } catch (IllegalStateException ignored) {
                // already invalidated
            }
            return reject(response, state == UserStatusCache.SessionState.SIGNED_OUT
                    ? "You were signed out of this device. Please log in again."
                    : "This account has been suspended. Please contact an administrator.");
        }

        request.setAttribute(REQUEST_USER_ID, userId);
        return true;
    }

    private static boolean reject(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"message\":\"" + message + "\",\"error\":\"" + message + "\"}");
        return false;
    }

    public static Long requireUserId(HttpServletRequest request) {
        Object value = request.getAttribute(REQUEST_USER_ID);
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }

        HttpSession session = request.getSession(false);
        Object sessionValue = session != null ? session.getAttribute(SESSION_USER_ID) : null;
        if (sessionValue instanceof Number) {
            return ((Number) sessionValue).longValue();
        }
        throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required");
    }

    /**
     * Asserts that the current session user has the ADMIN role.
     * Call this as the first line in any admin-only controller method.
     * Throws 403 Forbidden if the user is not an admin.
     */
    public static void requireAdminRole(HttpServletRequest request) {
        // First ensure the user is authenticated
        requireUserId(request);

        HttpSession session = request.getSession(false);
        Object roleValue = session != null ? session.getAttribute(SESSION_USER_ROLE) : null;
        if (!"ADMIN".equals(roleValue)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Admin access required");
        }
    }
}
