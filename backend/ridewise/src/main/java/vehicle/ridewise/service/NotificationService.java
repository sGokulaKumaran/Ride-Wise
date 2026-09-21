package vehicle.ridewise.service;

import org.springframework.stereotype.Service;
import vehicle.ridewise.repository.NotificationRepository;
import vehicle.ridewise.entity.Notification;
import vehicle.ridewise.dto.NotificationResponse;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class NotificationService {
    private final NotificationRepository notificationRepository;
    
    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }
    
    public NotificationResponse createNotification(Long userId, String type, String title, String message, Long rideId) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setType(type);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setRideId(rideId);
        notification.setIsRead(false);
        Notification saved = notificationRepository.save(notification);
        return NotificationResponse.from(saved);
    }
    
    public List<NotificationResponse> getUserNotifications(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(NotificationResponse::from)
                .collect(Collectors.toList());
    }
    
    public long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }
    
    public void markAsRead(Long notificationId) {
        notificationRepository.findById(notificationId).ifPresent(notification -> {
            notification.setIsRead(true);
            notificationRepository.save(notification);
        });
    }
    
    public void markAllAsRead(Long userId) {
        List<Notification> unread = notificationRepository.findByUserIdAndIsReadFalse(userId);
        for (Notification notification : unread) {
            notification.setIsRead(true);
        }
        notificationRepository.saveAll(unread);
    }
}
