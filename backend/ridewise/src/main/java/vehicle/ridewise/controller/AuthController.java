package vehicle.ridewise.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vehicle.ridewise.config.SessionAuthInterceptor;
import vehicle.ridewise.config.UserStatusCache;
import vehicle.ridewise.dto.AccountDtos.DeleteAccount;
import vehicle.ridewise.dto.AccountDtos.DeleteCheck;
import vehicle.ridewise.dto.AccountDtos.EmailChange;
import vehicle.ridewise.dto.AccountDtos.PasswordChange;
import vehicle.ridewise.dto.AuthRequest;
import vehicle.ridewise.dto.UserResponse;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.service.AccountService;
import vehicle.ridewise.service.AuthService;

import java.util.Map;

// /api/auth — sign up, sign in, profile, and the account settings:
//
//   POST  /password                       change password (signs out other devices)
//   PATCH /email                          change the sign-in email
//   POST  /sessions/sign-out-others       end every other session
//   GET   /account/export                 everything the account holds, as JSON
//   GET   /account/delete-check           what stands in the way of deleting it
//   POST  /account/delete                 delete the account (password + "DELETE")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final AccountService accountService;
    private final UserStatusCache userStatusCache;

    public AuthController(AuthService authService, AccountService accountService, UserStatusCache userStatusCache) {
        this.authService = authService;
        this.accountService = accountService;
        this.userStatusCache = userStatusCache;
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

    // ── Account settings ─────────────────────────────────────

    @PostMapping("/password")
    public ResponseEntity<Map<String, Object>> changePassword(@RequestBody PasswordChange body, HttpServletRequest request) {
        Long userId = SessionAuthInterceptor.requireUserId(request);
        authService.changePassword(userId, body.currentPassword(), body.newPassword());
        keepThisDeviceSignedIn(request, userId);
        return ResponseEntity.ok(Map.of("success", true, "message", "Password changed. Other devices were signed out."));
    }

    @PatchMapping("/email")
    public ResponseEntity<UserResponse> changeEmail(@RequestBody EmailChange body, HttpServletRequest request) {
        Long userId = SessionAuthInterceptor.requireUserId(request);
        return ResponseEntity.ok(authService.changeEmail(userId, body.email(), body.password()));
    }

    @PostMapping("/sessions/sign-out-others")
    public ResponseEntity<Map<String, Object>> signOutOtherDevices(HttpServletRequest request) {
        Long userId = SessionAuthInterceptor.requireUserId(request);
        authService.signOutOtherDevices(userId);
        keepThisDeviceSignedIn(request, userId);
        return ResponseEntity.ok(Map.of("success", true, "message", "Every other device was signed out."));
    }

    @GetMapping("/account/export")
    public ResponseEntity<Map<String, Object>> exportData(HttpServletRequest request) {
        Long userId = SessionAuthInterceptor.requireUserId(request);
        return ResponseEntity.ok(accountService.exportData(userId));
    }

    @GetMapping("/account/delete-check")
    public ResponseEntity<DeleteCheck> deleteCheck(HttpServletRequest request) {
        Long userId = SessionAuthInterceptor.requireUserId(request);
        return ResponseEntity.ok(accountService.deleteCheck(userId));
    }

    @PostMapping("/account/delete")
    public ResponseEntity<Map<String, Object>> deleteAccount(@RequestBody DeleteAccount body, HttpServletRequest request) {
        Long userId = SessionAuthInterceptor.requireUserId(request);
        accountService.deleteAccount(userId, body.password(), body.confirm());
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
        return ResponseEntity.ok(Map.of("success", true));
    }

    // Older sessions of this account were just ended (sessionsValidAfter
    // moved forward): give the device that asked a new session, started
    // after that moment, so it stays signed in.
    private void keepThisDeviceSignedIn(HttpServletRequest request, Long userId) {
        HttpSession current = request.getSession(false);
        Object role = current != null ? current.getAttribute(SessionAuthInterceptor.SESSION_USER_ROLE) : null;
        userStatusCache.evict(userId);
        startFreshSession(request, userId, role instanceof String text ? text : null);
    }

    private void startFreshSession(HttpServletRequest request, Long userId, String role) {
        HttpSession oldSession = request.getSession(false);
        if (oldSession != null) oldSession.invalidate();
        HttpSession session = request.getSession(true);
        session.setAttribute(SessionAuthInterceptor.SESSION_USER_ID, userId);
        session.setAttribute(SessionAuthInterceptor.SESSION_USER_ROLE, role != null ? role : "USER");
    }
}
