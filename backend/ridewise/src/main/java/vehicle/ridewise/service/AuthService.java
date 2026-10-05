package vehicle.ridewise.service;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.dto.AuthRequest;
import vehicle.ridewise.dto.UserResponse;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.repository.UserRepository;

import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

// ============================================================
// AuthService — accounts: sign up, sign in, profile
//
// Everything a client sends is validated here before it reaches the
// database, so a bad value becomes a clear 400 message instead of a
// database error (a too-long address used to surface as a raw SQL
// "value too long" failure).
// ============================================================
@Service
public class AuthService {

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern USERNAME = Pattern.compile("^[a-zA-Z0-9_]{3,20}$");
    private static final Pattern MOBILE = Pattern.compile("^[+\\d][\\d\\s\\-()]{6,18}$");

    private static final int MAX_EMAIL = 254;
    private static final int MIN_PASSWORD = 6;
    private static final int MAX_PASSWORD = 128;
    private static final int MAX_ADDRESS = 255;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final LoginAttemptService loginAttempts;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                       LoginAttemptService loginAttempts) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.loginAttempts = loginAttempts;
    }

    @Transactional
    public UserResponse signup(AuthRequest request) {
        String email = normalizeEmail(request.getEmail());
        String password = request.getPassword();

        if (email == null || email.length() > MAX_EMAIL || !EMAIL.matcher(email).matches()) {
            throw ApiException.badRequest("A valid email is required");
        }
        if (password == null || password.length() < MIN_PASSWORD) {
            throw ApiException.badRequest("Password must be at least 6 characters");
        }
        if (password.length() > MAX_PASSWORD) {
            throw ApiException.badRequest("Password must be at most " + MAX_PASSWORD + " characters");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("Email already registered");
        }

        User user = new User();
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        return toResponse(userRepository.save(user));
    }

    public UserResponse login(AuthRequest request) {
        String email = normalizeEmail(request.getEmail());
        String password = request.getPassword();

        loginAttempts.assertAllowed(email); // 429 while locked out

        Optional<User> userOpt = email != null ? userRepository.findByEmailIgnoreCase(email) : Optional.empty();
        if (userOpt.isEmpty() || password == null ||
                !passwordEncoder.matches(password, userOpt.get().getPassword())) {
            loginAttempts.recordFailure(email);
            // Same message for unknown email and wrong password — prevents account enumeration
            throw ApiException.unauthorized("Invalid email or password");
        }

        User user = userOpt.get();
        if (Boolean.FALSE.equals(user.getEnabled())) {
            throw ApiException.forbidden("Account is suspended. Please contact an administrator.");
        }

        loginAttempts.recordSuccess(email);
        return toResponse(user);
    }

    public UserResponse getCurrentUser(Long userId) {
        return toResponse(findUser(userId));
    }

    @Transactional
    public UserResponse updateProfile(Long userId, AuthRequest request) {
        User user = findUser(userId);

        if (request.getUsername() != null) {
            String username = request.getUsername().trim();
            if (username.isEmpty()) {
                throw ApiException.badRequest("Username cannot be empty");
            }
            if (!USERNAME.matcher(username).matches()) {
                throw ApiException.badRequest("Username must be 3-20 letters, numbers or underscores");
            }
            userRepository.findByUsernameIgnoreCase(username).ifPresent(existing -> {
                if (!existing.getId().equals(userId)) {
                    throw ApiException.conflict("Username is already taken");
                }
            });
            user.setUsername(username);
        }

        if (request.getMobile() != null) {
            String mobile = request.getMobile().trim();
            if (!mobile.isEmpty() && !MOBILE.matcher(mobile).matches()) {
                throw ApiException.badRequest("Please enter a valid mobile number");
            }
            user.setMobile(mobile.isEmpty() ? null : mobile);
        }

        if (request.getAddress() != null) {
            String address = request.getAddress().trim();
            if (address.length() > MAX_ADDRESS) {
                throw ApiException.badRequest("Address must be at most " + MAX_ADDRESS + " characters");
            }
            user.setAddress(address.isEmpty() ? null : address);
        }

        // The rider's location (used by "riders near me") is a pair: both
        // coordinates, valid, or neither.
        Double lat = request.getLat();
        Double lng = request.getLng();
        if (lat != null || lng != null) {
            if (lat == null || lng == null || lat.isNaN() || lng.isNaN()
                    || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                throw ApiException.badRequest("A valid latitude and longitude are required");
            }
            user.setLat(lat);
            user.setLng(lng);
        }

        // Privacy: may riders who are not connected with me find me?
        if (request.getProfilePublic() != null) {
            user.setProfilePublic(request.getProfilePublic());
        }

        return toResponse(userRepository.save(user));
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) return null;
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private UserResponse toResponse(User user) {
        UserResponse response = new UserResponse(
                user.getId(), user.getEmail(), user.getUsername(), user.getMobile(),
                user.getAddress(), user.getLat(), user.getLng(),
                user.getRole(), user.getEnabled(), user.getCreatedAt()
        );
        response.setProfilePublic(!Boolean.FALSE.equals(user.getProfilePublic()));
        return response;
    }
}
