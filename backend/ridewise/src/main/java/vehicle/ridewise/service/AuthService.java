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

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public UserResponse signup(AuthRequest request) {
        String email = normalizeEmail(request.getEmail());
        String password = request.getPassword();

        if (email == null || !email.contains("@")) {
            throw ApiException.badRequest("A valid email is required");
        }
        if (password == null || password.length() < 6) {
            throw ApiException.badRequest("Password must be at least 6 characters");
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

        Optional<User> userOpt = email != null ? userRepository.findByEmailIgnoreCase(email) : Optional.empty();
        if (userOpt.isEmpty() || password == null ||
                !passwordEncoder.matches(password, userOpt.get().getPassword())) {
            // Same message for unknown email and wrong password — prevents account enumeration
            throw new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        User user = userOpt.get();
        // Check if account is suspended
        if (user.getEnabled() != null && !user.getEnabled()) {
            throw ApiException.forbidden("Account is suspended. Please contact an administrator.");
        }

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
            if (!username.matches("^[a-zA-Z0-9_]{3,20}$")) {
                throw ApiException.badRequest("Username must be 3-20 letters, numbers or underscores");
            }
            userRepository.findByUsernameIgnoreCase(username).ifPresent(existing -> {
                if (!existing.getId().equals(userId)) {
                    throw ApiException.conflict("Username is already taken");
                }
            });
            user.setUsername(username);
        }
        if (request.getMobile() != null) user.setMobile(request.getMobile().trim());
        if (request.getAddress() != null) user.setAddress(request.getAddress().trim());
        if (request.getLat() != null) user.setLat(request.getLat());
        if (request.getLng() != null) user.setLng(request.getLng());

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
        return new UserResponse(
                user.getId(), user.getEmail(), user.getUsername(), user.getMobile(),
                user.getAddress(), user.getLat(), user.getLng(),
                user.getRole(), user.getEnabled(), user.getCreatedAt()
        );
    }
}