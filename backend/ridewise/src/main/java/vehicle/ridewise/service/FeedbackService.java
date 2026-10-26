package vehicle.ridewise.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.entity.Feedback;
import vehicle.ridewise.entity.PlatformSetting;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.repository.FeedbackRepository;
import vehicle.ridewise.repository.PlatformSettingRepository;
import vehicle.ridewise.repository.UserRepository;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class FeedbackService {

    public static final String SETTING_ADMIN_EMAIL = "admin_feedback_email";
    private static final Set<String> VALID_CATEGORIES = Set.of("BUG", "FEEDBACK", "FEATURE", "HELP");
    private static final Set<String> VALID_STATUSES = Set.of("OPEN", "REVIEWED", "RESOLVED");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final FeedbackRepository feedbackRepository;
    private final PlatformSettingRepository platformSettingRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String smtpUsername;

    @Value("${ridewise.admin.alert-email:}")
    private String defaultAlertEmail;

    public FeedbackService(FeedbackRepository feedbackRepository,
                           PlatformSettingRepository platformSettingRepository,
                           UserRepository userRepository,
                           NotificationService notificationService,
                           @Autowired(required = false) JavaMailSender mailSender) {
        this.feedbackRepository = feedbackRepository;
        this.platformSettingRepository = platformSettingRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.mailSender = mailSender;
    }

    @Transactional
    public Map<String, Object> submit(Long userId, Map<String, Object> body) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));

        String rawCategory = stringField(body, "category").toUpperCase(Locale.ROOT);
        String category = VALID_CATEGORIES.contains(rawCategory) ? rawCategory : "FEEDBACK";

        String message = stringField(body, "message");
        if (message.length() < 5) {
            throw ApiException.badRequest("Please describe your feedback or issue in at least a few words.");
        }
        if (message.length() > 4000) {
            throw ApiException.badRequest("Message is too long (maximum 4000 characters).");
        }

        String subject = stringField(body, "subject");
        if (subject.isEmpty()) {
            subject = message.length() <= 72 ? message : message.substring(0, 72) + "…";
        } else if (subject.length() > 160) {
            subject = subject.substring(0, 160);
        }

        String pageContext = stringField(body, "pageContext");
        if (pageContext.length() > 200) {
            pageContext = pageContext.substring(0, 200);
        }

        Feedback feedback = new Feedback();
        feedback.setUserId(user.getId());
        feedback.setUsername(user.getUsername());
        feedback.setUserEmail(user.getEmail());
        feedback.setCategory(category);
        feedback.setSubject(subject);
        feedback.setMessage(message);
        feedback.setPageContext(pageContext.isEmpty() ? null : pageContext);
        feedback.setStatus("OPEN");

        Feedback saved = feedbackRepository.save(feedback);

        // 1. Notify every platform ADMIN account in-app
        List<Long> adminIds = userRepository.findByRole("ADMIN").stream()
                .map(User::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        String senderName = (user.getUsername() != null && !user.getUsername().isBlank())
                ? "@" + user.getUsername()
                : user.getEmail();
        String label = categoryLabel(category);
        String notifTitle = label + " from " + senderName;
        String notifBody = subject.length() <= 100 ? subject : subject.substring(0, 100) + "…";
        notificationService.notifyManyWithLink(adminIds, "feedback_received", notifTitle, notifBody, "/admin/feedback");

        // 2. Forward to the admin's configured Gmail address (asynchronously so UI never blocks)
        String targetEmail = resolveAlertEmail();
        if (!targetEmail.isBlank() && isSmtpConfigured()) {
            sendAlertEmailAsync(targetEmail, saved);
        }

        return toMap(saved);
    }

    public List<Map<String, Object>> getMyFeedback(Long userId) {
        return feedbackRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toMap)
                .collect(Collectors.toList());
    }

    public Map<String, Object> adminList(String status, String category, String search, int page, int size) {
        int clampedSize = Math.max(1, Math.min(size, 100));
        Pageable pageable = PageRequest.of(Math.max(0, page), clampedSize);

        String normStatus = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        if (!VALID_STATUSES.contains(normStatus)) normStatus = "";

        String normCategory = category == null ? "" : category.trim().toUpperCase(Locale.ROOT);
        if (!VALID_CATEGORIES.contains(normCategory)) normCategory = "";

        String normSearch = search == null ? "" : search.trim();

        Page<Feedback> resultPage = feedbackRepository.searchFeedback(normStatus, normCategory, normSearch, pageable);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", resultPage.getContent().stream().map(this::toMap).collect(Collectors.toList()));
        out.put("total", resultPage.getTotalElements());
        out.put("totalPages", resultPage.getTotalPages());
        out.put("page", resultPage.getNumber());
        out.put("size", resultPage.getSize());
        out.put("openCount", feedbackRepository.countByStatus("OPEN"));
        out.put("reviewedCount", feedbackRepository.countByStatus("REVIEWED"));
        out.put("resolvedCount", feedbackRepository.countByStatus("RESOLVED"));
        return out;
    }

    @Transactional
    public Map<String, Object> adminUpdate(Long id, Map<String, Object> body) {
        Feedback feedback = feedbackRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Feedback entry not found"));

        String previousStatus = feedback.getStatus();
        String previousReply = feedback.getAdminReply();

        if (body.containsKey("status")) {
            String nextStatus = stringField(body, "status").toUpperCase(Locale.ROOT);
            if (!VALID_STATUSES.contains(nextStatus)) {
                throw ApiException.badRequest("Status must be OPEN, REVIEWED, or RESOLVED.");
            }
            feedback.setStatus(nextStatus);
        }

        if (body.containsKey("adminReply")) {
            String reply = stringField(body, "adminReply");
            if (reply.length() > 2000) {
                throw ApiException.badRequest("Reply is too long (maximum 2000 characters).");
            }
            feedback.setAdminReply(reply.isEmpty() ? null : reply);
        }

        Feedback saved = feedbackRepository.save(feedback);

        // Notify the rider when an admin replies or marks their report resolved
        boolean replyAdded = saved.getAdminReply() != null && !Objects.equals(previousReply, saved.getAdminReply());
        boolean newlyResolved = "RESOLVED".equals(saved.getStatus()) && !"RESOLVED".equals(previousStatus);
        if (replyAdded || newlyResolved) {
            String title = replyAdded
                    ? "RideWise replied to your " + categoryLabel(saved.getCategory()).toLowerCase(Locale.ROOT)
                    : "Your " + categoryLabel(saved.getCategory()).toLowerCase(Locale.ROOT) + " was marked resolved";
            String msg = replyAdded ? saved.getAdminReply() : saved.getSubject();
            if (msg != null && msg.length() > 140) msg = msg.substring(0, 140) + "…";
            notificationService.notifyWithLink(saved.getUserId(), "feedback_reply", title, msg, "/settings#help-feedback");
        }

        return toMap(saved);
    }

    @Transactional
    public void adminDelete(Long id) {
        if (!feedbackRepository.existsById(id)) {
            throw ApiException.notFound("Feedback entry not found");
        }
        feedbackRepository.deleteById(id);
    }

    public Map<String, Object> getAdminSettings() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("alertEmail", resolveAlertEmail());
        out.put("smtpConfigured", isSmtpConfigured());
        return out;
    }

    @Transactional
    public Map<String, Object> updateAdminSettings(Map<String, Object> body) {
        String email = stringField(body, "alertEmail").toLowerCase(Locale.ROOT);
        if (!email.isEmpty() && !EMAIL_PATTERN.matcher(email).matches()) {
            throw ApiException.badRequest("Enter a valid email address (for example, yourname@gmail.com).");
        }

        PlatformSetting setting = platformSettingRepository.findById(SETTING_ADMIN_EMAIL)
                .orElseGet(() -> {
                    PlatformSetting created = new PlatformSetting();
                    created.setSettingKey(SETTING_ADMIN_EMAIL);
                    return created;
                });
        setting.setSettingValue(email);
        platformSettingRepository.save(setting);

        return getAdminSettings();
    }

    public String resolveAlertEmail() {
        return platformSettingRepository.findById(SETTING_ADMIN_EMAIL)
                .map(PlatformSetting::getSettingValue)
                .filter(v -> v != null && !v.isBlank())
                .orElse(defaultAlertEmail == null ? "" : defaultAlertEmail.trim());
    }

    private boolean isSmtpConfigured() {
        return mailSender != null && smtpUsername != null && !smtpUsername.isBlank();
    }

    private void sendAlertEmailAsync(String toEmail, Feedback f) {
        CompletableFuture.runAsync(() -> {
            try {
                SimpleMailMessage mail = new SimpleMailMessage();
                mail.setFrom(smtpUsername);
                mail.setTo(toEmail);
                if (f.getUserEmail() != null && !f.getUserEmail().isBlank()) {
                    mail.setReplyTo(f.getUserEmail());
                }
                mail.setSubject("[RideWise " + categoryLabel(f.getCategory()) + "] " + f.getSubject());
                StringBuilder sb = new StringBuilder();
                sb.append("New ").append(categoryLabel(f.getCategory())).append(" submitted on RideWise\n");
                sb.append("--------------------------------------------------\n");
                sb.append("From: ").append(f.getUsername() != null ? "@" + f.getUsername() + " " : "")
                  .append("<").append(f.getUserEmail() != null ? f.getUserEmail() : "unknown").append(">\n");
                sb.append("Category: ").append(f.getCategory()).append("\n");
                if (f.getPageContext() != null && !f.getPageContext().isBlank()) {
                    sb.append("Screen: ").append(f.getPageContext()).append("\n");
                }
                sb.append("Subject: ").append(f.getSubject()).append("\n\n");
                sb.append(f.getMessage()).append("\n\n");
                sb.append("--------------------------------------------------\n");
                sb.append("Manage in RideWise Admin -> Feedback (/admin/feedback)");
                mail.setText(sb.toString());
                mailSender.send(mail);
            } catch (Exception ex) {
                System.err.println("[FeedbackService] Failed to forward feedback email to " + toEmail + ": " + ex.getMessage());
            }
        });
    }

    private static String categoryLabel(String category) {
        if ("BUG".equals(category)) return "Bug report";
        if ("FEATURE".equals(category)) return "Feature request";
        if ("HELP".equals(category)) return "Help question";
        return "Feedback";
    }

    private static String stringField(Map<String, Object> body, String key) {
        if (body == null) return "";
        Object val = body.get(key);
        return val == null ? "" : String.valueOf(val).trim();
    }

    private Map<String, Object> toMap(Feedback f) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", f.getId());
        map.put("userId", f.getUserId());
        map.put("username", f.getUsername());
        map.put("userEmail", f.getUserEmail());
        map.put("category", f.getCategory());
        map.put("subject", f.getSubject());
        map.put("message", f.getMessage());
        map.put("pageContext", f.getPageContext());
        map.put("status", f.getStatus());
        map.put("adminReply", f.getAdminReply());
        map.put("createdAt", f.getCreatedAt());
        map.put("updatedAt", f.getUpdatedAt());
        return map;
    }
}

