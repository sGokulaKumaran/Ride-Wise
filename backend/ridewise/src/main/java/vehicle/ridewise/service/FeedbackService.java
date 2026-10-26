package vehicle.ridewise.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
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
    public static final String SETTING_ADMIN_SMTP_PASSWORD = "admin_smtp_password";
    private static final Set<String> VALID_CATEGORIES = Set.of("BUG", "FEEDBACK", "FEATURE", "HELP");
    private static final Set<String> VALID_STATUSES = Set.of("OPEN", "REVIEWED", "RESOLVED");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final FeedbackRepository feedbackRepository;
    private final PlatformSettingRepository platformSettingRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final JavaMailSender defaultMailSender;

    @Value("${spring.mail.username:}")
    private String defaultSmtpUsername;

    @Value("${ridewise.admin.alert-email:}")
    private String defaultAlertEmail;

    public FeedbackService(FeedbackRepository feedbackRepository,
                           PlatformSettingRepository platformSettingRepository,
                           UserRepository userRepository,
                           NotificationService notificationService,
                           @Autowired(required = false) JavaMailSender defaultMailSender) {
        this.feedbackRepository = feedbackRepository;
        this.platformSettingRepository = platformSettingRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.defaultMailSender = defaultMailSender;
    }

    private record SmtpSenderInfo(String fromEmail, JavaMailSender sender) {}

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
        SmtpSenderInfo activeSmtp = getActiveSmtp();
        if (!targetEmail.isBlank() && activeSmtp != null) {
            sendAlertEmailAsync(targetEmail, saved, activeSmtp);
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
        String email = resolveAlertEmail();
        String pass = getSetting(SETTING_ADMIN_SMTP_PASSWORD);
        boolean hasAppPassword = !pass.isBlank();
        boolean smtpActive = (hasAppPassword && !email.isBlank())
                || (defaultMailSender != null && defaultSmtpUsername != null && !defaultSmtpUsername.isBlank());

        out.put("alertEmail", email);
        out.put("hasAppPassword", hasAppPassword);
        out.put("smtpConfigured", smtpActive);
        return out;
    }

    @Transactional
    public Map<String, Object> updateAdminSettings(Map<String, Object> body) {
        if (body.containsKey("alertEmail")) {
            String email = stringField(body, "alertEmail").toLowerCase(Locale.ROOT);
            if (!email.isEmpty() && !EMAIL_PATTERN.matcher(email).matches()) {
                throw ApiException.badRequest("Enter a valid email address (for example, yourname@gmail.com).");
            }
            saveSetting(SETTING_ADMIN_EMAIL, email);
        }

        if (body.containsKey("clearPassword") && Boolean.TRUE.equals(body.get("clearPassword"))) {
            saveSetting(SETTING_ADMIN_SMTP_PASSWORD, "");
        } else if (body.containsKey("appPassword")) {
            String password = stringField(body, "appPassword").replaceAll("\\s+", "");
            if (!password.isEmpty()) {
                if (password.length() < 8 || password.length() > 64) {
                    throw ApiException.badRequest("Google App Passwords are 16 characters (found " + password.length() + ").");
                }
                saveSetting(SETTING_ADMIN_SMTP_PASSWORD, password);
            }
        }

        return getAdminSettings();
    }

    public Map<String, Object> testEmail(Map<String, Object> body) {
        String email = stringField(body, "alertEmail").toLowerCase(Locale.ROOT);
        String pass = stringField(body, "appPassword").replaceAll("\\s+", "");

        if (email.isEmpty()) {
            email = resolveAlertEmail();
        }
        if (pass.isEmpty()) {
            pass = getSetting(SETTING_ADMIN_SMTP_PASSWORD);
        }

        if (email.isEmpty()) {
            throw ApiException.badRequest("Please enter or save your Gmail address first.");
        }
        if (pass.isEmpty() && (defaultMailSender == null || defaultSmtpUsername == null || defaultSmtpUsername.isBlank())) {
            throw ApiException.badRequest("Please enter your 16-character Google App Password.");
        }

        JavaMailSender sender = !pass.isEmpty()
                ? createDynamicMailSender(email, pass)
                : defaultMailSender;

        try {
            SimpleMailMessage mail = new SimpleMailMessage();
            mail.setFrom(email);
            mail.setTo(email);
            mail.setSubject("[RideWise] Test email — Gmail alert configuration");
            mail.setText("Hello Admin,\n\n"
                    + "This is a test email confirming that your Gmail address and Google App Password "
                    + "are working correctly in RideWise!\n\n"
                    + "From now on, user feedback, bug reports, and help questions submitted on RideWise "
                    + "will be automatically forwarded to this inbox.\n\n"
                    + "Sent at: " + new Date() + "\n"
                    + "RideWise Platform");
            sender.send(mail);

            Map<String, Object> out = new LinkedHashMap<>();
            out.put("ok", true);
            out.put("message", "Test email sent successfully to " + email + "! Check your Gmail inbox.");
            return out;
        } catch (Exception ex) {
            String msg = ex.getMessage() != null ? ex.getMessage() : ex.toString();
            if (msg.contains("AuthenticationFailed") || msg.contains("535") || msg.contains("Username and Password not accepted")) {
                throw ApiException.badRequest("Google rejected the credentials (535 Authentication Failed). Make sure 2-Step Verification is turned ON and you generated a 16-character App Password at myaccount.google.com/apppasswords.");
            }
            throw ApiException.badRequest("Failed to send test email: " + msg);
        }
    }

    public String resolveAlertEmail() {
        String email = getSetting(SETTING_ADMIN_EMAIL);
        if (!email.isBlank()) return email;
        if (defaultAlertEmail != null && !defaultAlertEmail.isBlank()) return defaultAlertEmail.trim();
        if (defaultSmtpUsername != null && !defaultSmtpUsername.isBlank()) return defaultSmtpUsername.trim();
        return "";
    }

    public boolean isSmtpConfigured() {
        return getActiveSmtp() != null;
    }

    private SmtpSenderInfo getActiveSmtp() {
        String dbEmail = getSetting(SETTING_ADMIN_EMAIL);
        String dbPassword = getSetting(SETTING_ADMIN_SMTP_PASSWORD);

        if (!dbEmail.isBlank() && !dbPassword.isBlank()) {
            return new SmtpSenderInfo(dbEmail.trim(), createDynamicMailSender(dbEmail.trim(), dbPassword.trim()));
        }

        if (defaultMailSender != null && defaultSmtpUsername != null && !defaultSmtpUsername.isBlank()) {
            return new SmtpSenderInfo(defaultSmtpUsername.trim(), defaultMailSender);
        }

        return null;
    }

    private JavaMailSender createDynamicMailSender(String email, String appPassword) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost("smtp.gmail.com");
        sender.setPort(587);
        sender.setUsername(email);
        sender.setPassword(appPassword != null ? appPassword.replaceAll("\\s+", "") : "");

        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.starttls.required", "true");
        props.put("mail.smtp.ssl.trust", "smtp.gmail.com");
        props.put("mail.smtp.connectiontimeout", "6000");
        props.put("mail.smtp.timeout", "6000");
        props.put("mail.smtp.writetimeout", "6000");
        return sender;
    }

    private void sendAlertEmailAsync(String toEmail, Feedback f, SmtpSenderInfo senderInfo) {
        CompletableFuture.runAsync(() -> {
            try {
                SimpleMailMessage mail = new SimpleMailMessage();
                mail.setFrom(senderInfo.fromEmail());
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
                senderInfo.sender().send(mail);
            } catch (Exception ex) {
                System.err.println("[FeedbackService] Failed to forward feedback email to " + toEmail + ": " + ex.getMessage());
            }
        });
    }

    private String getSetting(String key) {
        return platformSettingRepository.findById(key)
                .map(PlatformSetting::getSettingValue)
                .filter(v -> v != null && !v.isBlank())
                .orElse("");
    }

    private void saveSetting(String key, String value) {
        PlatformSetting setting = platformSettingRepository.findById(key)
                .orElseGet(() -> {
                    PlatformSetting created = new PlatformSetting();
                    created.setSettingKey(key);
                    return created;
                });
        setting.setSettingValue(value == null ? "" : value.trim());
        platformSettingRepository.save(setting);
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
