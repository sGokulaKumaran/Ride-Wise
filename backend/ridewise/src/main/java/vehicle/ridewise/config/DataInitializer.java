package vehicle.ridewise.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.repository.UserRepository;

import java.util.List;

/**
 * DataInitializer — Creates a default admin account on startup if none exists.
 *
 * Credentials are read from environment variables:
 *   RIDEWISE_ADMIN_EMAIL    (default: admin@ridewise.com)
 *   RIDEWISE_ADMIN_PASSWORD (default: Admin@123)
 *
 * The admin account is created without a username so it goes through
 * the normal onboarding flow on first login (pick username, mobile, address).
 *
 * This only runs when NO user with role=ADMIN exists in the database.
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        List<User> admins = userRepository.findByRole("ADMIN");
        if (!admins.isEmpty()) {
            System.out.println("[RideWise] Admin account already exists — skipping creation.");
            return;
        }

        String envEmail = System.getenv("RIDEWISE_ADMIN_EMAIL");
        String envPassword = System.getenv("RIDEWISE_ADMIN_PASSWORD");

        final String email = (envEmail == null || envEmail.isBlank()) ? "admin@ridewise.com" : envEmail;
        final String password = (envPassword == null || envPassword.isBlank()) ? "Admin@123" : envPassword;

        // Check if a user with this email already exists (e.g. signed up as normal user)
        if (userRepository.existsByEmailIgnoreCase(email)) {
            // Promote existing user to admin
            userRepository.findByEmailIgnoreCase(email).ifPresent(existingUser -> {
                existingUser.setRole("ADMIN");
                userRepository.save(existingUser);
                System.out.println("[RideWise] Existing user '" + email + "' promoted to ADMIN.");
            });
            return;
        }

        User admin = new User();
        admin.setEmail(email.trim().toLowerCase());
        admin.setPassword(passwordEncoder.encode(password));
        admin.setRole("ADMIN");
        admin.setEnabled(true);
        userRepository.save(admin);

        System.out.println("═══════════════════════════════════════════════════════");
        System.out.println("  [RideWise] Default admin account created:");
        System.out.println("  Email:    " + email);
        System.out.println("  Password: " + password);
        System.out.println("  ");
        System.out.println("  Set RIDEWISE_ADMIN_EMAIL and RIDEWISE_ADMIN_PASSWORD");
        System.out.println("  environment variables to customize these credentials.");
        System.out.println("═══════════════════════════════════════════════════════");
    }
}
