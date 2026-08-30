package vehicle.ridewise.controller;

import com.ridewise.dto.AuthRequest;
import com.ridewise.dto.UserResponse;
import com.ridewise.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController  // = @Controller + @ResponseBody (returns JSON instead of HTML)
@RequestMapping("/api/auth")  // All endpoints here start with /api/auth
@CrossOrigin(origins = "http://localhost:5173")  // Allow frontend
public class AuthController {

    @Autowired
    private AuthService authService;

    // POST /api/auth/signup
    @PostMapping("/signup")
    public ResponseEntity<UserResponse> signup(@RequestBody AuthRequest request) {
        UserResponse response = authService.signup(request);
        return ResponseEntity.ok(response);
    }

    // POST /api/auth/login
    @PostMapping("/login")
    public ResponseEntity<UserResponse> login(@RequestBody AuthRequest request) {
        UserResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    // PATCH /api/auth/profile/{userId}
    @PatchMapping("/profile/{userId}")
    public ResponseEntity<UserResponse> updateProfile(
            @PathVariable Long userId,
            @RequestBody AuthRequest request) {
        UserResponse response = authService.updateProfile(userId, request);
        return ResponseEntity.ok(response);
    }
}