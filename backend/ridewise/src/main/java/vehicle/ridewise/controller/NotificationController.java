package vehicle.ridewise.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vehicle.ridewise.config.SessionAuthInterceptor;
import vehicle.ridewise.dto.NotificationResponse;
import vehicle.ridewise.service.NotificationService;

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
    public ResponseEntity<List<NotificationResponse>> getUserNotifications(HttpServletRequest request) {
        return ResponseEntity.ok(notificationService.getUserNotifications(SessionAuthInterceptor.requireUserId(request)));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(HttpServletRequest request) {
        return ResponseEntity.ok(Map.of("count", notificationService.getUnreadCount(SessionAuthInterceptor.requireUserId(request))));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<Map<String, Boolean>> markAsRead(@PathVariable Long id, HttpServletRequest request) {
        notificationService.markAsRead(id, SessionAuthInterceptor.requireUserId(request));
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PatchMapping("/read-all")
    public ResponseEntity<Map<String, Boolean>> markAllAsRead(HttpServletRequest request) {
        notificationService.markAllAsRead(SessionAuthInterceptor.requireUserId(request));
        return ResponseEntity.ok(Map.of("success", true));
    }
}
