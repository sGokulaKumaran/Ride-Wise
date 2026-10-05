package vehicle.ridewise;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication  // Auto-configures everything
@EnableScheduling       // Enables @Scheduled methods (cleanup jobs)
public class RideWiseApplication {

	// ── All server timestamps are UTC ──
	// Entities store LocalDateTime.now(), which uses the JVM's default zone.
	// On a developer laptop that is local time, on the hosted server it is
	// UTC — so the same code wrote different clock values depending on where
	// it ran, and the browser could not know which. Pinning the JVM to UTC
	// (and sending timestamps with a "Z", see JacksonConfig) gives every
	// client an unambiguous instant to convert to its own local time.
	//
	// A static initialiser (not main) so tests, which never call main(),
	// get the same behaviour.
	static {
		TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
	}

	// Entry point — run this to start the backend server
	public static void main(String[] args) {
		SpringApplication.run(RideWiseApplication.class, args);
	}
}
