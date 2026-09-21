package vehicle.ridewise.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vehicle.ridewise.service.NotificationService;
import vehicle.ridewise.dto.NotificationResponse;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<List<NotificationResponse>> getUserNotifications(@RequestParam Long userId) {
        return ResponseEntity.ok(notificationService.getUserNotifications(userId));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(@RequestParam Long userId) {
        return ResponseEntity.ok(Map.of("count", notificationService.getUnreadCount(userId)));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<Map<String, Boolean>> markAsRead(@PathVariable Long id) {
        notificationService.markAsRead(id);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PatchMapping("/read-all")
    public ResponseEntity<Map<String, Boolean>> markAllAsRead(@RequestParam Long userId) {
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
