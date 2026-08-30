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
    private LocalDateTime createdAt;

    public UserResponse() {}

    public UserResponse(Long id, String email, String username,
                        String mobile, String address,
                        Double lat, Double lng, LocalDateTime createdAt) {
        this.id = id;
        this.email = email;
        this.username = username;
        this.mobile = mobile;
        this.address = address;
        this.lat = lat;
        this.lng = lng;
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
    public LocalDateTime getCreatedAt()  { return createdAt; }

    // ---- Setters ----
    public void setId(Long id)                         { this.id = id; }
    public void setEmail(String email)                 { this.email = email; }
    public void setUsername(String username)           { this.username = username; }
    public void setMobile(String mobile)               { this.mobile = mobile; }
    public void setAddress(String address)             { this.address = address; }
    public void setLat(Double lat)                     { this.lat = lat; }
    public void setLng(Double lng)                     { this.lng = lng; }
    public void setCreatedAt(LocalDateTime createdAt)  { this.createdAt = createdAt; }
}