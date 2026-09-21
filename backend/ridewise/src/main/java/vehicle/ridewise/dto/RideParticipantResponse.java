package vehicle.ridewise.dto;

import vehicle.ridewise.entity.RideParticipant;
import vehicle.ridewise.entity.User;

public class RideParticipantResponse {

    private Long userId;
    private String username;
    private String email;
    private String role; // "admin", "member"
    private String status; // "active", "pending", "declined", "left"
    private String avatarLetter;

    public static RideParticipantResponse from(RideParticipant participant, User user) {
        RideParticipantResponse res = new RideParticipantResponse();
        res.setUserId(participant.getUserId());
        res.setRole(participant.getRole());
        res.setStatus(participant.getStatus());

        if (user != null) {
            res.setUsername(user.getUsername());
            res.setEmail(user.getEmail());
            if (user.getUsername() != null && !user.getUsername().isEmpty()) {
                res.setAvatarLetter(user.getUsername().substring(0, 1).toUpperCase());
            }
        }
        return res;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getAvatarLetter() {
        return avatarLetter;
    }

    public void setAvatarLetter(String avatarLetter) {
        this.avatarLetter = avatarLetter;
    }
}
