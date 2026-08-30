package vehicle.ridewise.service;

import com.ridewise.dto.AuthRequest;
import com.ridewise.dto.UserResponse;
import com.ridewise.entity.User;
import com.ridewise.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.Optional;

@Service // Marks this as a Spring service (business logic layer)
public class AuthService {
    @Autowired  // Spring auto-injects UserRepository
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;  // BCrypt bean (defined in SecurityConfig)
    // Sign up a new user
    public UserResponse signup(AuthRequest request) {
        // Check if email already exists
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered");
        }

        // Create new user entity
        User user = new User();
        user.setEmail(request.getEmail());
        // Hash the password with BCrypt — never store plain text!
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        // Save to database
        User saved = userRepository.save(user);
        // Convert entity → DTO (no password in response)
        return toResponse(saved);
    }

    // Login user
    public UserResponse login(AuthRequest request) {
        // Find user by email
        Optional<User> userOpt = userRepository.findByEmail(request.getEmail());

        if (userOpt.isEmpty()) {
            throw new RuntimeException("No account found with this email");
        }
        User user = userOpt.get();

        // Verify password (compares hashed versions)
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Incorrect password");
        }

        return toResponse(user);
    }

    // Update user profile (called from onboarding & account edit)
    public UserResponse updateProfile(Long userId, AuthRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        // Update only the fields that were provided
        if (request.getUsername() != null) user.setUsername(request.getUsername());
        if (request.getMobile() != null)   user.setMobile(request.getMobile());
        if (request.getAddress() != null)  user.setAddress(request.getAddress());

        User saved = userRepository.save(user);
        return toResponse(saved);
    }

    // Helper: convert User entity → UserResponse DTO
    private UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getUsername(),
                user.getMobile(),
                user.getAddress(),
                user.getLat(),
                user.getLng(),
                user.getCreatedAt()
        );
    }
}