package vehicle.ridewise.dto;

// DTO for receiving signup/login/profile requests from the frontend
public class AuthRequest {
    private String email;
    private String password;
    private String username;
    private String mobile;
    private String address;
    private Double lat;
    private Double lng;
    private Boolean profilePublic; // may other riders discover this account?
    private Integer autoDeleteRidesDays; // 0 = never, >0 = delete finished rides older than N days

    // ---- Getters ----
    public String getEmail()          { return email; }
    public String getPassword()       { return password; }
    public String getUsername()       { return username; }
    public String getMobile()         { return mobile; }
    public String getAddress()        { return address; }
    public Double getLat()            { return lat; }
    public Double getLng()            { return lng; }
    public Boolean getProfilePublic() { return profilePublic; }
    public Integer getAutoDeleteRidesDays() { return autoDeleteRidesDays; }

    // ---- Setters ----
    public void setEmail(String email)                  { this.email = email; }
    public void setPassword(String password)            { this.password = password; }
    public void setUsername(String username)            { this.username = username; }
    public void setMobile(String mobile)                { this.mobile = mobile; }
    public void setAddress(String address)              { this.address = address; }
    public void setLat(Double lat)                      { this.lat = lat; }
    public void setLng(Double lng)                      { this.lng = lng; }
    public void setProfilePublic(Boolean profilePublic) { this.profilePublic = profilePublic; }
    public void setAutoDeleteRidesDays(Integer autoDeleteRidesDays) { this.autoDeleteRidesDays = autoDeleteRidesDays; }
}
