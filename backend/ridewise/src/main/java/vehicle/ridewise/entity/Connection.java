package vehicle.ridewise.entity;

// Connection entity — represents rider-to-rider connections
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "connections")  // Table name
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Connection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // The user who added the connection
    @Column(name = "user_id", nullable = false)
    private Long userId;

    // The rider being connected to
    @Column(name = "connected_user_id", nullable = false)
    private Long connectedUserId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}