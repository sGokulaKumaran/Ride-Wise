package vehicle.ridewise.dto;

import java.time.LocalDateTime;

// DTO for sending user data back to frontend — NO password field!
public class UserResponse {
    private Long id;
    private String email;
    private String username;
    private String mobile;
    private String address;
    private Double lat;
    private Double lng;
    private String role;
    private Boolean enabled;
    private Boolean profilePublic = true; // may other riders discover this account?
    private Integer autoDeleteRidesDays = 0; // 0 = keep all rides
    private LocalDateTime createdAt;

    public UserResponse() {}

    public UserResponse(Long id, String email, String username,
                        String mobile, String address,
                        Double lat, Double lng,
                        String role, Boolean enabled,
                        LocalDateTime createdAt) {
        this.id = id;
        this.email = email;
        this.username = username;
        this.mobile = mobile;
        this.address = address;
        this.lat = lat;
        this.lng = lng;
        this.role = role;
        this.enabled = enabled;
        this.createdAt = createdAt;
    }

    // ---- Getters ----
    public Long getId()                  { return id; }
    public String getEmail()             { return email; }
    public String getUsername()          { return username; }
    public String getMobile()            { return mobile; }
    public String getAddress()           { return address; }
    public Double getLat()               { return lat; }
    public Double getLng()               { return lng; }
    public String getRole()              { return role; }
    public Boolean getEnabled()          { return enabled; }
    public Boolean getProfilePublic()    { return profilePublic; }
    public Integer getAutoDeleteRidesDays() { return autoDeleteRidesDays; }
    public LocalDateTime getCreatedAt()  { return createdAt; }

    // ---- Setters ----
    public void setId(Long id)                         { this.id = id; }
    public void setEmail(String email)                 { this.email = email; }
    public void setUsername(String username)           { this.username = username; }
    public void setMobile(String mobile)               { this.mobile = mobile; }
    public void setAddress(String address)             { this.address = address; }
    public void setLat(Double lat)                     { this.lat = lat; }
    public void setLng(Double lng)                     { this.lng = lng; }
    public void setRole(String role)                   { this.role = role; }
    public void setEnabled(Boolean enabled)            { this.enabled = enabled; }
    public void setProfilePublic(Boolean profilePublic) { this.profilePublic = profilePublic; }
    public void setAutoDeleteRidesDays(Integer autoDeleteRidesDays) { this.autoDeleteRidesDays = autoDeleteRidesDays; }
    public void setCreatedAt(LocalDateTime createdAt)  { this.createdAt = createdAt; }
}
