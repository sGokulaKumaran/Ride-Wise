package vehicle.ridewise.dto;

// DTO = Data Transfer Object
// Used for receiving signup/login requests from the frontend
import lombok.Data;

@Data
public class AuthRequest {
    private String email;
    private String password;
    private String username; // Used for profile updates
    private String mobile;     // Used for profile updates
    private String address;    // Used for profile updates
}