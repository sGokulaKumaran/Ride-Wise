package vehicle.ridewise.dto;

import vehicle.ridewise.entity.Notification;
import java.time.LocalDateTime;

public class NotificationResponse {

    private Long id;
    private String type;
    private String title;
    private String message;
    private Long rideId;
    private Boolean isRead;
    private LocalDateTime createdAt;

    public static NotificationResponse from(Notification notification) {
        NotificationResponse res = new NotificationResponse();
        res.setId(notification.getId());
        res.setType(notification.getType());
        res.setTitle(notification.getTitle());
        res.setMessage(notification.getMessage());
        res.setRideId(notification.getRideId());
        res.setIsRead(notification.getIsRead());
        res.setCreatedAt(notification.getCreatedAt());
        return res;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Long getRideId() {
        return rideId;
    }

    public void setRideId(Long rideId) {
        this.rideId = rideId;
    }

    public Boolean getIsRead() {
        return isRead;
    }

    public void setIsRead(Boolean isRead) {
        this.isRead = isRead;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
