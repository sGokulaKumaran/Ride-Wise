package vehicle.ridewise.service;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.dto.OrgDtos.ActivityDto;
import vehicle.ridewise.dto.OrgDtos.Analytics;
import vehicle.ridewise.dto.OrgDtos.AnnouncementDto;
import vehicle.ridewise.dto.OrgDtos.AnnouncementRequest;
import vehicle.ridewise.dto.OrgDtos.Dashboard;
import vehicle.ridewise.dto.OrgDtos.DayStat;
import vehicle.ridewise.dto.OrgDtos.DriverStat;
import vehicle.ridewise.dto.OrgDtos.VehicleStat;
import vehicle.ridewise.entity.OrgAnnouncement;
import vehicle.ridewise.entity.Organization;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.entity.Vehicle;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.repository.OrgAccessRepository;
import vehicle.ridewise.repository.OrgAnnouncementRepository;
import vehicle.ridewise.repository.OrgMemberRepository;
import vehicle.ridewise.repository.UserRepository;
import vehicle.ridewise.repository.VehicleRepository;
import vehicle.ridewise.repository.VehicleSessionRepository;
import vehicle.ridewise.websocket.FleetBroadcaster;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

// ============================================================
// OrgInsightsService — what an organization's admins look at:
// the overview, the statistics, the activity log, announcements.
//
// STATISTICS
//   Every figure is added up inside the database (COUNT / SUM / MAX with
//   GROUP BY) — the server never loads trips one by one to count them, so
//   a fleet with a hundred thousand trips costs the same few queries as a
//   fleet with ten.
//
//   "A day" is the VIEWER's day. Timestamps are stored in UTC; the browser
//   sends its offset (minutes east of UTC, e.g. 330 for India) and the day
//   boundaries are shifted by it. Without that, a trip at 2 a.m. in
//   Chennai would be counted on the previous day.
//
// ANNOUNCEMENTS
//   A short message from the admins ("Bus 4 starts 20 minutes late today").
//   It appears on the organization's page and is sent as a notification to
//   the members and to everyone who has the organization on their list.
// ============================================================
@Service
public class OrgInsightsService {

    private static final Set<String> LEVELS = Set.of("INFO", "WARNING", "URGENT");
    private static final int MAX_ANNOUNCEMENTS_PER_DAY = 20;
    private static final int MAX_AUDIENCE = 5_000;
    private static final int MAX_OFFSET_MINUTES = 14 * 60;

    private final VehicleSessionRepository sessionRepository;
    private final VehicleRepository vehicleRepository;
    private final OrgMemberRepository memberRepository;
    private final OrgAccessRepository accessRepository;
    private final OrgAnnouncementRepository announcementRepository;
    private final UserRepository userRepository;
    private final OrgGuard guard;
    private final OrgAuditService audit;
    private final NotificationService notificationService;
    private final FleetBroadcaster broadcaster;

    public OrgInsightsService(VehicleSessionRepository sessionRepository,
                              VehicleRepository vehicleRepository,
                              OrgMemberRepository memberRepository,
                              OrgAccessRepository accessRepository,
                              OrgAnnouncementRepository announcementRepository,
                              UserRepository userRepository,
                              OrgGuard guard,
                              OrgAuditService audit,
                              NotificationService notificationService,
                              FleetBroadcaster broadcaster) {
        this.sessionRepository = sessionRepository;
        this.vehicleRepository = vehicleRepository;
        this.memberRepository = memberRepository;
        this.accessRepository = accessRepository;
        this.announcementRepository = announcementRepository;
        this.userRepository = userRepository;
        this.guard = guard;
        this.audit = audit;
        this.notificationService = notificationService;
        this.broadcaster = broadcaster;
    }

    // ============================================================
    // OVERVIEW (admins)
    // ============================================================
    public Dashboard dashboard(Long orgId, Long userId, Integer tzOffsetMinutes) {
        guard.requireOrg(orgId);
        guard.requireManager(orgId, userId);

        long retired = vehicleRepository.countByOrgIdAndStatus(orgId, "RETIRED");
        long vehicles = vehicleRepository.countByOrgId(orgId) - retired;
        long usable = vehicleRepository.countByOrgIdAndStatus(orgId, "ACTIVE");
        long onTrip = sessionRepository.countByOrgIdAndStatus(orgId, "ACTIVE");

        LocalDateTime dayStart = startOfLocalDay(LocalDateTime.now(), offset(tzOffsetMinutes), 0);
        Object[] today = totals(orgId, dayStart, dayStart.plusDays(1));

        return new Dashboard(
                vehicles,
                Math.max(0, usable - onTrip),
                onTrip,
                Math.max(0, vehicles - usable),
                memberRepository.countByOrgIdAndStatusAndRoleIn(orgId, "ACTIVE", List.of("DRIVER")),
                memberRepository.countByOrgIdAndStatus(orgId, "ACTIVE"),
                memberRepository.countByOrgIdAndStatus(orgId, "PENDING"),
                accessRepository.countByOrgId(orgId),
                number(today[0]).longValue(),
                number(today[1]).doubleValue(),
                sessionRepository.countByOrgIdAndStatusAndSosActiveTrue(orgId, "ACTIVE"),
                audit.recent(orgId, 12));
    }

    public List<ActivityDto> activity(Long orgId, Long userId, int limit) {
        guard.requireOrg(orgId);
        guard.requireManager(orgId, userId);
        return audit.recent(orgId, limit);
    }

    // ============================================================
    // STATISTICS (admins) — the last 7, 30 or 90 days
    // ============================================================
    public Analytics analytics(Long orgId, Long userId, int days, Integer tzOffsetMinutes) {
        Organization org = guard.requireOrg(orgId);
        guard.requireManager(orgId, userId);

        int span = days <= 7 ? 7 : days <= 30 ? 30 : 90;
        int offset = offset(tzOffsetMinutes);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime from = startOfLocalDay(now, offset, span - 1);
        LocalDate firstDay = now.plusMinutes(offset).toLocalDate().minusDays(span - 1L);

        List<DayStat> daily = new ArrayList<>(span);
        long trips = 0;
        double distance = 0;
        long seconds = 0;
        long overspeed = 0;
        for (int i = 0; i < span; i++) {
            LocalDateTime dayStart = from.plusDays(i);
            Object[] row = totals(orgId, dayStart, dayStart.plusDays(1));
            long dayTrips = number(row[0]).longValue();
            double dayDistance = number(row[1]).doubleValue();
            long daySeconds = number(row[2]).longValue();
            daily.add(new DayStat(firstDay.plusDays(i).toString(), dayTrips, dayDistance, daySeconds));
            trips += dayTrips;
            distance += dayDistance;
            seconds += daySeconds;
            overspeed += number(row[3]).longValue();
        }

        List<DriverStat> drivers = sessionRepository.driverStats(orgId, from, PageRequest.of(0, 50)).stream()
                .map(r -> new DriverStat(number(r[0]).longValue(), r[1] == null ? "Driver" : r[1].toString(),
                        number(r[2]).longValue(), number(r[3]).doubleValue(), number(r[4]).longValue(),
                        number(r[5]).doubleValue(), number(r[6]).longValue()))
                .toList();
        List<VehicleStat> vehicles = sessionRepository.vehicleStats(orgId, from, PageRequest.of(0, 50)).stream()
                .map(r -> new VehicleStat(number(r[0]).longValue(), r[1] == null ? "Vehicle" : r[1].toString(),
                        number(r[2]).longValue(), number(r[3]).doubleValue(), number(r[4]).longValue()))
                .toList();

        long cancelled = sessionRepository.countByOrgIdAndStatusAndStartedAtGreaterThanEqual(orgId, "CANCELLED", from);
        return new Analytics(span, trips, distance, seconds, overspeed, cancelled,
                org.getSpeedLimitKmh(), daily, drivers, vehicles);
    }

    private Object[] totals(Long orgId, LocalDateTime from, LocalDateTime to) {
        List<Object[]> rows = sessionRepository.totalsBetween(orgId, from, to);
        return rows.isEmpty() ? new Object[] {0L, 0.0, 0L, 0L} : rows.get(0);
    }

    private static Number number(Object value) {
        return value instanceof Number n ? n : 0;
    }

    private static int offset(Integer tzOffsetMinutes) {
        if (tzOffsetMinutes == null) return 0;
        return Math.max(-MAX_OFFSET_MINUTES, Math.min(MAX_OFFSET_MINUTES, tzOffsetMinutes));
    }

    // 00:00 of the viewer's day, `daysBack` days ago, expressed in the
    // server's clock (UTC).
    private static LocalDateTime startOfLocalDay(LocalDateTime utcNow, int offsetMinutes, int daysBack) {
        LocalDate localDay = utcNow.plusMinutes(offsetMinutes).toLocalDate().minusDays(daysBack);
        return localDay.atStartOfDay().minusMinutes(offsetMinutes);
    }

    // ============================================================
    // ANNOUNCEMENTS
    // ============================================================

    /** What is currently announced — for everyone who may see the organization. */
    public List<AnnouncementDto> announcements(Long orgId, Long userId) {
        Organization org = guard.requireOrg(orgId);
        guard.requireView(org, userId);
        boolean manager = guard.isManager(orgId, userId);

        LocalDateTime now = LocalDateTime.now();
        List<OrgAnnouncement> rows = announcementRepository
                .findByOrgIdOrderByCreatedAtDesc(orgId, PageRequest.of(0, 50)).stream()
                .filter(a -> manager || a.getExpiresAt() == null || a.getExpiresAt().isAfter(now))
                .toList();

        Set<Long> vehicleIds = rows.stream().map(OrgAnnouncement::getVehicleId)
                .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Map<Long, String> codes = vehicleIds.isEmpty() ? Map.of()
                : vehicleRepository.findAllById(vehicleIds).stream()
                        .collect(Collectors.toMap(Vehicle::getId, Vehicle::getVehicleCode));

        return rows.stream()
                .map(a -> toDto(a, a.getVehicleId() == null ? null : codes.get(a.getVehicleId())))
                .toList();
    }

    @Transactional
    public AnnouncementDto announce(Long orgId, Long userId, AnnouncementRequest request) {
        Organization org = guard.requireOrg(orgId);
        guard.requireManager(orgId, userId);
        if (!org.isActive()) throw ApiException.forbidden("This organization is suspended");
        if (request == null) throw ApiException.badRequest("An announcement needs a title and a message");

        String title = request.title() == null ? "" : request.title().trim();
        String message = request.message() == null ? "" : request.message().trim();
        if (title.isEmpty() || title.length() > 120) {
            throw ApiException.badRequest("Give the announcement a title (up to 120 characters)");
        }
        if (message.isEmpty() || message.length() > 1000) {
            throw ApiException.badRequest("Write the announcement (up to 1000 characters)");
        }
        String level = request.level() == null || request.level().isBlank()
                ? "INFO" : request.level().trim().toUpperCase(Locale.ROOT);
        if (!LEVELS.contains(level)) throw ApiException.badRequest("Unknown announcement type");

        if (announcementRepository.countByOrgIdAndCreatedAtAfter(orgId, LocalDateTime.now().minusDays(1))
                >= MAX_ANNOUNCEMENTS_PER_DAY) {
            throw ApiException.tooManyRequests("That is a lot of announcements for one day. Try again tomorrow.");
        }

        Vehicle vehicle = null;
        if (request.vehicleId() != null) {
            vehicle = vehicleRepository.findByIdAndOrgId(request.vehicleId(), orgId)
                    .orElseThrow(() -> ApiException.notFound("Vehicle not found"));
        }
        LocalDateTime expiresAt = null;
        if (request.expiresInHours() != null && request.expiresInHours() > 0) {
            expiresAt = LocalDateTime.now().plusHours(Math.min(request.expiresInHours(), 24 * 30));
        }

        User author = userRepository.findById(userId).orElse(null);
        OrgAnnouncement announcement = new OrgAnnouncement();
        announcement.setOrgId(orgId);
        announcement.setAuthorUserId(userId);
        announcement.setAuthorName(author != null && author.getUsername() != null ? author.getUsername() : "An admin");
        announcement.setTitle(title);
        announcement.setMessage(message);
        announcement.setLevel(level);
        announcement.setVehicleId(vehicle == null ? null : vehicle.getId());
        announcement.setExpiresAt(expiresAt);
        OrgAnnouncement saved = announcementRepository.save(announcement);

        // Members first (they must not be the ones cut off by the cap),
        // then everyone who has the organization on their list.
        Set<Long> audience = new LinkedHashSet<>(
                memberRepository.findActiveUserIds(orgId, PageRequest.of(0, MAX_AUDIENCE)));
        if (audience.size() < MAX_AUDIENCE) {
            audience.addAll(accessRepository.findUserIdsByOrgId(orgId, PageRequest.of(0, MAX_AUDIENCE - audience.size())));
        }
        audience.remove(userId);
        String link = vehicle == null ? "/organizations/" + orgId
                : "/organizations/" + orgId + "/track/" + vehicle.getId();
        notificationService.notifyManyWithLink(audience, "org_announcement",
                org.getName() + ": " + title,
                message.length() > 240 ? message.substring(0, 237) + "…" : message,
                link);

        audit.record(orgId, userId, "announcement.post", "announced \"" + title + "\"");
        Tx.afterCommit(() -> broadcaster.publishOrgWide(orgId, Map.of("type", "announcement", "orgId", orgId)));
        return toDto(saved, vehicle == null ? null : vehicle.getVehicleCode());
    }

    @Transactional
    public void removeAnnouncement(Long orgId, Long announcementId, Long userId) {
        guard.requireOrg(orgId);
        guard.requireManager(orgId, userId);
        OrgAnnouncement announcement = announcementRepository.findByIdAndOrgId(announcementId, orgId)
                .orElseThrow(() -> ApiException.notFound("Announcement not found"));
        announcementRepository.delete(announcement);
        audit.record(orgId, userId, "announcement.remove", "removed the announcement \"" + announcement.getTitle() + "\"");
        Tx.afterCommit(() -> broadcaster.publishOrgWide(orgId, Map.of("type", "announcement", "orgId", orgId)));
    }

    private static AnnouncementDto toDto(OrgAnnouncement a, String vehicleCode) {
        return new AnnouncementDto(a.getId(), a.getOrgId(), a.getTitle(), a.getMessage(), a.getLevel(),
                a.getVehicleId(), vehicleCode, a.getAuthorName(), a.getCreatedAt(), a.getExpiresAt());
    }
}
