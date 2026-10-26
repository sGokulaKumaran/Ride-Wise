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

    @Column(name = "role", nullable = false)
    private String role;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    // Can other riders discover this account through search and "near me"?
    // NULL (accounts created before this setting existed) means yes.
    // People already connected with the rider are not affected.
    @Column(name = "profile_public")
    private Boolean profilePublic;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    // Sessions started before this moment (epoch milliseconds) are no longer
    // accepted — set by "sign out of other devices" and by a password change.
    // NULL: every session is accepted.
    @Column(name = "sessions_valid_after")
    private Long sessionsValidAfter;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (role == null) role = "USER";
        if (enabled == null) enabled = true;
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
    public String getRole()              { return role; }
    public Boolean getEnabled()          { return enabled; }
    public Boolean getProfilePublic()    { return profilePublic; }
    public LocalDateTime getCreatedAt()  { return createdAt; }
    public Long getSessionsValidAfter()  { return sessionsValidAfter; }

    // ---- Setters ----
    public void setId(Long id)                         { this.id = id; }
    public void setEmail(String email)                 { this.email = email; }
    public void setPassword(String password)           { this.password = password; }
    public void setUsername(String username)           { this.username = username; }
    public void setMobile(String mobile)               { this.mobile = mobile; }
    public void setAddress(String address)             { this.address = address; }
    public void setLat(Double lat)                     { this.lat = lat; }
    public void setLng(Double lng)                     { this.lng = lng; }
    public void setRole(String role)                   { this.role = role; }
    public void setEnabled(Boolean enabled)            { this.enabled = enabled; }
    public void setProfilePublic(Boolean profilePublic) { this.profilePublic = profilePublic; }
    public void setCreatedAt(LocalDateTime createdAt)  { this.createdAt = createdAt; }
    public void setSessionsValidAfter(Long sessionsValidAfter) { this.sessionsValidAfter = sessionsValidAfter; }
}