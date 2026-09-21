package vehicle.ridewise.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.HandlerInterceptor;
import vehicle.ridewise.exception.ApiException;
import org.springframework.http.HttpStatus;

import java.io.IOException;

// SessionAuthInterceptor — protects every /api endpoint except signup/login.
// The authenticated user id is stored in the server-side HttpSession after login.
// Controllers/services must use requireUserId(request), never a browser-supplied id.
public class SessionAuthInterceptor implements HandlerInterceptor {

    public static final String SESSION_USER_ID = "RIDEWISE_USER_ID";
    public static final String REQUEST_USER_ID = "authenticatedUserId";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String path = request.getRequestURI();
        boolean publicAuthEndpoint =
                path.equals("/api/auth/login") ||
                path.equals("/api/auth/signup");

        if (publicAuthEndpoint) {
            return true;
        }

        HttpSession session = request.getSession(false);
        Object value = session != null ? session.getAttribute(SESSION_USER_ID) : null;
        if (!(value instanceof Number)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"message\":\"Authentication required\",\"error\":\"Authentication required\"}");
            return false;
        }

        request.setAttribute(REQUEST_USER_ID, ((Number) value).longValue());
        return true;
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
}
