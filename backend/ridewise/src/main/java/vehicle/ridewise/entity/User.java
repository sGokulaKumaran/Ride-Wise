package vehicle.ridewise.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password; // BCrypt-hashed

    @Column(unique = true)
    private String username;

    private String mobile;
    private String address;

    private Double lat;
    private Double lng;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // ---- Getters ----
    public Long getId()                  { return id; }
    public String getEmail()             { return email; }
    public String getPassword()          { return password; }
    public String getUsername()          { return username; }
    public String getMobile()            { return mobile; }
    public String getAddress()           { return address; }
    public Double getLat()               { return lat; }
    public Double getLng()               { return lng; }
    public LocalDateTime getCreatedAt()  { return createdAt; }

    // ---- Setters ----
    public void setId(Long id)                         { this.id = id; }
    public void setEmail(String email)                 { this.email = email; }
    public void setPassword(String password)           { this.password = password; }
    public void setUsername(String username)           { this.username = username; }
    public void setMobile(String mobile)               { this.mobile = mobile; }
    public void setAddress(String address)             { this.address = address; }
    public void setLat(Double lat)                     { this.lat = lat; }
    public void setLng(Double lng)                     { this.lng = lng; }
    public void setCreatedAt(LocalDateTime createdAt)  { this.createdAt = createdAt; }
}