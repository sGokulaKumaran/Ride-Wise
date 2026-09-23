package vehicle.ridewise.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vehicle.ridewise.config.SessionAuthInterceptor;
import vehicle.ridewise.dto.AuthRequest;
import vehicle.ridewise.dto.UserResponse;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.service.AuthService;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    public ResponseEntity<UserResponse> signup(@RequestBody AuthRequest request, HttpServletRequest httpRequest) {
        UserResponse response = authService.signup(request);
        startFreshSession(httpRequest, response.getId(), response.getRole());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<UserResponse> login(@RequestBody AuthRequest request, HttpServletRequest httpRequest) {
        UserResponse response = authService.login(request);
        startFreshSession(httpRequest, response.getId(), response.getRole());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(HttpServletRequest request) {
        Long userId = SessionAuthInterceptor.requireUserId(request);
        return ResponseEntity.ok(authService.getCurrentUser(userId));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Boolean>> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PatchMapping("/profile/{userId}")
    public ResponseEntity<UserResponse> updateProfile(
            @PathVariable Long userId,
            @RequestBody AuthRequest request,
            HttpServletRequest httpRequest) {
        Long currentUserId = SessionAuthInterceptor.requireUserId(httpRequest);
        if (!currentUserId.equals(userId)) {
            throw ApiException.forbidden("You can only update your own profile");
        }
        return ResponseEntity.ok(authService.updateProfile(currentUserId, request));
    }

    private void startFreshSession(HttpServletRequest request, Long userId, String role) {
        HttpSession oldSession = request.getSession(false);
        if (oldSession != null) oldSession.invalidate();
        HttpSession session = request.getSession(true);
        session.setAttribute(SessionAuthInterceptor.SESSION_USER_ID, userId);
        session.setAttribute(SessionAuthInterceptor.SESSION_USER_ROLE, role != null ? role : "USER");
    }
}