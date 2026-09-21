package vehicle.ridewise.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "connections",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "connected_user_id"}))
public class Connection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "connected_user_id", nullable = false)
    private Long connectedUserId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // ---- Getters ----
    public Long getId()                  { return id; }
    public Long getUserId()              { return userId; }
    public Long getConnectedUserId()     { return connectedUserId; }
    public LocalDateTime getCreatedAt()  { return createdAt; }

    // ---- Setters ----
    public void setId(Long id)                         { this.id = id; }
    public void setUserId(Long userId)                 { this.userId = userId; }
    public void setConnectedUserId(Long connectedUserId) { this.connectedUserId = connectedUserId; }
    public void setCreatedAt(LocalDateTime createdAt)  { this.createdAt = createdAt; }
}