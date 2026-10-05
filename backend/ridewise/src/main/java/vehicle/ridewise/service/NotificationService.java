package vehicle.ridewise.service;

import org.springframework.stereotype.Service;
import vehicle.ridewise.dto.NotificationResponse;
import vehicle.ridewise.entity.Notification;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.repository.NotificationRepository;

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

    // The newest 50 for the bell
    public List<NotificationResponse> getUserNotifications(Long userId) {
        return notificationRepository.findTop50ByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(NotificationResponse::from)
                .collect(Collectors.toList());
    }

    public long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    public void markAsRead(Long notificationId, Long userId) {
        notificationRepository.findById(notificationId).ifPresent(notification -> {
            if (!notification.getUserId().equals(userId)) {
                throw ApiException.forbidden("You can only read your own notifications");
            }
            if (!Boolean.TRUE.equals(notification.getIsRead())) {
                notification.setIsRead(true);
                notificationRepository.save(notification);
            }
        });
    }

    public void markAllAsRead(Long userId) {
        notificationRepository.markAllRead(userId);
    }

    // A deleted ride must not leave notifications that open nothing.
    public void deleteForRide(Long rideId) {
        notificationRepository.deleteByRideId(rideId);
    }
}
