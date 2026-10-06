package vehicle.ridewise.service;

import org.springframework.stereotype.Service;
import vehicle.ridewise.dto.NotificationResponse;
import vehicle.ridewise.entity.Notification;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.repository.NotificationRepository;

import java.util.ArrayList;
import java.util.Collection;
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

    // ── Notifications that open a page instead of a ride ──
    // (organization invitations, announcements, vehicle alerts, SOS …)
    // `link` is an in-app path such as "/organizations/5/track/12".
    public void notifyWithLink(Long userId, String type, String title, String message, String link) {
        if (userId == null) return;
        notificationRepository.save(build(userId, type, title, message, link));
    }

    /** The same notification for many people, written in one batch. */
    public void notifyManyWithLink(Collection<Long> userIds, String type, String title, String message, String link) {
        if (userIds == null || userIds.isEmpty()) return;
        List<Notification> batch = new ArrayList<>(userIds.size());
        for (Long userId : userIds) {
            if (userId != null) batch.add(build(userId, type, title, message, link));
        }
        notificationRepository.saveAll(batch);
    }

    private static Notification build(Long userId, String type, String title, String message, String link) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setType(type);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setLink(link);
        notification.setIsRead(false);
        return notification;
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
