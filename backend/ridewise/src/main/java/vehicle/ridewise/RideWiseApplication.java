package vehicle.ridewise;

// Marks this as the main Spring Boot application
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication  // Auto-configures everything
public class RideWiseApplication {

// Entry point — run this to start the backend server

	public static void main(String[] args) {
		SpringApplication.run(RideWiseApplication.class, args);
	}
}