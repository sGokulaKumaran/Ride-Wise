package vehicle.ridewise.dto;

// DTO for sending user data back to frontend// Notice: NO password field — never send password to frontend!
import lombok.Data;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class UserResponse {
    private Long id;
    private String email;
    private String username;
    private String mobile;
    private String address;
    private Double lat;
    private Double lng;
    private LocalDateTime createdAt;
}