package vehicle.ridewise.entity;

// User entity — represents the "users" table in the database
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Entity // Marks this as a database table
@Table(name = "users")  // Table name in DB
@Data  // Lombok: auto-generates getters, setters, toString, equals, hashCode
@NoArgsConstructor  // Lombok: generates no-args constructor
@AllArgsConstructor  // Lombok: generates all-args constructor
public class User {
    @Id  // Primary key
    @GeneratedValue(strategy = GenerationType.IDENTITY)  // Auto-increment
    private Long id;
    @Column(unique = true, nullable = false)  // Email must be unique
    private String email;

    @Column(nullable = false)  // Password cannot be null
    private String password;  // Will store BCrypt-hashed password

    @Column(unique = true)  // Username unique if provided
    private String username;

    private String mobile;
    private String address;

    // Location fields for "Near Riders" feature
    private Double lat;  // Latitude
    private Double lng;  // Longitude @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    // Auto-set createdAt before saving to DB
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}