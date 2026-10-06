package vehicle.ridewise.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vehicle.ridewise.config.SessionAuthInterceptor;
import vehicle.ridewise.dto.OrgDtos.AccessHolder;
import vehicle.ridewise.dto.OrgDtos.AccessPasswordRequest;
import vehicle.ridewise.dto.OrgDtos.AccessRequest;
import vehicle.ridewise.dto.OrgDtos.ActivityDto;
import vehicle.ridewise.dto.OrgDtos.Analytics;
import vehicle.ridewise.dto.OrgDtos.AnnouncementDto;
import vehicle.ridewise.dto.OrgDtos.AnnouncementRequest;
import vehicle.ridewise.dto.OrgDtos.Dashboard;
import vehicle.ridewise.dto.OrgDtos.InviteRequest;
import vehicle.ridewise.dto.OrgDtos.MemberDto;
import vehicle.ridewise.dto.OrgDtos.MemberPatch;
import vehicle.ridewise.dto.OrgDtos.MySummary;
import vehicle.ridewise.dto.OrgDtos.OrgCard;
import vehicle.ridewise.dto.OrgDtos.OrgDetail;
import vehicle.ridewise.dto.OrgDtos.OrgRequest;
import vehicle.ridewise.dto.OrgDtos.PageDto;
import vehicle.ridewise.dto.OrgDtos.RouteDto;
import vehicle.ridewise.dto.OrgDtos.RouteRequest;
import vehicle.ridewise.dto.OrgDtos.SessionDto;
import vehicle.ridewise.dto.OrgDtos.StatusRequest;
import vehicle.ridewise.dto.OrgDtos.TransferRequest;
import vehicle.ridewise.dto.OrgDtos.VehicleDetail;
import vehicle.ridewise.dto.OrgDtos.VehicleDto;
import vehicle.ridewise.dto.OrgDtos.VehicleRequest;
import vehicle.ridewise.service.FleetService;
import vehicle.ridewise.service.OrgInsightsService;
import vehicle.ridewise.service.OrgMemberService;
import vehicle.ridewise.service.OrganizationService;
import vehicle.ridewise.service.VehicleSessionService;

import java.util.List;
import java.util.Map;

// ============================================================
// OrganizationController — /api/organizations
//
// Organizations, their people, their vehicles and routes, and what their
// admins look at. The controller only reads the request and hands it to a
// service: every permission ("may this person do that here?") is decided
// in the services through OrgGuard, so a rule cannot be forgotten on one
// endpoint and remembered on another.
//
//   /me                              my organizations at a glance
//   /search, /access, /saved         find, open (code + password), my list
//   /{orgId}                         one organization
//   /{orgId}/members, /invitations   people
//   /{orgId}/vehicles, /routes       the fleet
//   /{orgId}/trips                   trip history
//   /{orgId}/announcements           messages to everyone following
//   /{orgId}/dashboard, /analytics, /activity   the admins' overview
// ============================================================
@RestController
@RequestMapping("/api/organizations")
public class OrganizationController {

    private final OrganizationService organizationService;
    private final OrgMemberService memberService;
    private final FleetService fleetService;
    private final OrgInsightsService insightsService;
    private final VehicleSessionService sessionService;

    public OrganizationController(OrganizationService organizationService,
                                  OrgMemberService memberService,
                                  FleetService fleetService,
                                  OrgInsightsService insightsService,
                                  VehicleSessionService sessionService) {
        this.organizationService = organizationService;
        this.memberService = memberService;
        this.fleetService = fleetService;
        this.insightsService = insightsService;
        this.sessionService = sessionService;
    }

    private static Long me(HttpServletRequest request) {
        return SessionAuthInterceptor.requireUserId(request);
    }

    // ── Mine ──────────────────────────────────────────────────────────

    @GetMapping("/me")
    public MySummary mine(HttpServletRequest request) {
        return organizationService.summary(me(request));
    }

    @GetMapping("/saved")
    public List<OrgCard> saved(HttpServletRequest request) {
        return organizationService.saved(me(request));
    }

    // ── Find and open ─────────────────────────────────────────────────

    @GetMapping("/search")
    public List<OrgCard> search(@RequestParam(name = "q", required = false) String query,
                                HttpServletRequest request) {
        return organizationService.search(query, me(request));
    }

    @PostMapping("/access")
    public OrgCard access(@RequestBody AccessRequest body, HttpServletRequest request) {
        return organizationService.access(me(request), body);
    }

    @PutMapping("/{orgId}/saved")
    public OrgCard save(@PathVariable Long orgId, HttpServletRequest request) {
        return organizationService.save(orgId, me(request));
    }

    @DeleteMapping("/{orgId}/saved")
    public ResponseEntity<Void> unsave(@PathVariable Long orgId, HttpServletRequest request) {
        organizationService.unsave(orgId, me(request));
        return ResponseEntity.noContent().build();
    }

    // ── One organization ──────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<OrgDetail> create(@RequestBody OrgRequest body, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(organizationService.create(me(request), body));
    }

    @GetMapping("/{orgId}")
    public OrgDetail detail(@PathVariable Long orgId, HttpServletRequest request) {
        return organizationService.detail(orgId, me(request));
    }

    @PatchMapping("/{orgId}")
    public OrgDetail update(@PathVariable Long orgId, @RequestBody OrgRequest body, HttpServletRequest request) {
        return organizationService.update(orgId, me(request), body);
    }

    @DeleteMapping("/{orgId}")
    public ResponseEntity<Void> delete(@PathVariable Long orgId, HttpServletRequest request) {
        organizationService.delete(orgId, me(request));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{orgId}/access-password")
    public ResponseEntity<Void> accessPassword(@PathVariable Long orgId, @RequestBody AccessPasswordRequest body,
                                               HttpServletRequest request) {
        organizationService.setAccessPassword(orgId, me(request), body);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{orgId}/access")
    public PageDto<AccessHolder> accessHolders(@PathVariable Long orgId,
                                               @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "30") int size,
                                               HttpServletRequest request) {
        return organizationService.accessHolders(orgId, me(request), page, size);
    }

    @DeleteMapping("/{orgId}/access/{userId}")
    public ResponseEntity<Void> revokeAccess(@PathVariable Long orgId, @PathVariable Long userId,
                                             HttpServletRequest request) {
        organizationService.revokeAccess(orgId, me(request), userId);
        return ResponseEntity.noContent().build();
    }

    // ── People ────────────────────────────────────────────────────────

    @GetMapping("/{orgId}/members")
    public List<MemberDto> members(@PathVariable Long orgId, HttpServletRequest request) {
        return memberService.list(orgId, me(request));
    }

    @PostMapping("/{orgId}/members")
    public ResponseEntity<MemberDto> invite(@PathVariable Long orgId, @RequestBody InviteRequest body,
                                            HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(memberService.invite(orgId, me(request), body));
    }

    @PatchMapping("/{orgId}/members/{memberId}")
    public MemberDto patchMember(@PathVariable Long orgId, @PathVariable Long memberId,
                                 @RequestBody MemberPatch body, HttpServletRequest request) {
        return memberService.patch(orgId, memberId, me(request), body);
    }

    @DeleteMapping("/{orgId}/members/{memberId}")
    public ResponseEntity<Void> removeMember(@PathVariable Long orgId, @PathVariable Long memberId,
                                             HttpServletRequest request) {
        memberService.remove(orgId, memberId, me(request));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{orgId}/leave")
    public ResponseEntity<Void> leave(@PathVariable Long orgId, HttpServletRequest request) {
        memberService.leave(orgId, me(request));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{orgId}/transfer")
    public OrgDetail transfer(@PathVariable Long orgId, @RequestBody TransferRequest body,
                              HttpServletRequest request) {
        Long userId = me(request);
        memberService.transfer(orgId, userId, body);
        return organizationService.detail(orgId, userId);
    }

    @PostMapping("/invitations/{memberId}/accept")
    public OrgDetail acceptInvitation(@PathVariable Long memberId, HttpServletRequest request) {
        Long userId = me(request);
        Long orgId = memberService.accept(memberId, userId);
        return organizationService.detail(orgId, userId);
    }

    @PostMapping("/invitations/{memberId}/reject")
    public ResponseEntity<Void> rejectInvitation(@PathVariable Long memberId, HttpServletRequest request) {
        memberService.reject(memberId, me(request));
        return ResponseEntity.noContent().build();
    }

    // ── Vehicles ──────────────────────────────────────────────────────

    @GetMapping("/{orgId}/vehicles")
    public List<VehicleDto> vehicles(@PathVariable Long orgId, HttpServletRequest request) {
        return fleetService.listVehicles(orgId, me(request));
    }

    @PostMapping("/{orgId}/vehicles")
    public ResponseEntity<VehicleDto> addVehicle(@PathVariable Long orgId, @RequestBody VehicleRequest body,
                                                 HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(fleetService.addVehicle(orgId, me(request), body));
    }

    @GetMapping("/{orgId}/vehicles/{vehicleId}")
    public VehicleDetail vehicle(@PathVariable Long orgId, @PathVariable Long vehicleId,
                                 HttpServletRequest request) {
        return organizationService.vehicleDetail(orgId, vehicleId, me(request));
    }

    @PatchMapping("/{orgId}/vehicles/{vehicleId}")
    public VehicleDto updateVehicle(@PathVariable Long orgId, @PathVariable Long vehicleId,
                                    @RequestBody VehicleRequest body, HttpServletRequest request) {
        return fleetService.updateVehicle(orgId, vehicleId, me(request), body);
    }

    @PutMapping("/{orgId}/vehicles/{vehicleId}/status")
    public VehicleDto vehicleStatus(@PathVariable Long orgId, @PathVariable Long vehicleId,
                                    @RequestBody StatusRequest body, HttpServletRequest request) {
        return fleetService.setVehicleStatus(orgId, vehicleId, me(request), body == null ? null : body.status());
    }

    /** { "deleted": true } — or false when the vehicle was retired because it has trip history. */
    @DeleteMapping("/{orgId}/vehicles/{vehicleId}")
    public Map<String, Object> removeVehicle(@PathVariable Long orgId, @PathVariable Long vehicleId,
                                             HttpServletRequest request) {
        boolean deleted = fleetService.removeVehicle(orgId, vehicleId, me(request));
        return Map.of("deleted", deleted);
    }

    // ── Routes ────────────────────────────────────────────────────────

    @GetMapping("/{orgId}/routes")
    public List<RouteDto> routes(@PathVariable Long orgId, HttpServletRequest request) {
        return fleetService.listRoutes(orgId, me(request));
    }

    @PostMapping("/{orgId}/routes")
    public ResponseEntity<RouteDto> addRoute(@PathVariable Long orgId, @RequestBody RouteRequest body,
                                             HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(fleetService.addRoute(orgId, me(request), body));
    }

    @GetMapping("/{orgId}/routes/{routeId}")
    public RouteDto route(@PathVariable Long orgId, @PathVariable Long routeId, HttpServletRequest request) {
        return fleetService.getRoute(orgId, routeId, me(request));
    }

    @PatchMapping("/{orgId}/routes/{routeId}")
    public RouteDto updateRoute(@PathVariable Long orgId, @PathVariable Long routeId,
                                @RequestBody RouteRequest body, HttpServletRequest request) {
        return fleetService.updateRoute(orgId, routeId, me(request), body);
    }

    @DeleteMapping("/{orgId}/routes/{routeId}")
    public ResponseEntity<Void> removeRoute(@PathVariable Long orgId, @PathVariable Long routeId,
                                            HttpServletRequest request) {
        fleetService.removeRoute(orgId, routeId, me(request));
        return ResponseEntity.noContent().build();
    }

    // ── Trips (history) ───────────────────────────────────────────────

    @GetMapping("/{orgId}/trips")
    public PageDto<SessionDto> trips(@PathVariable Long orgId,
                                     @RequestParam(required = false) Long vehicleId,
                                     @RequestParam(required = false) Long driverId,
                                     @RequestParam(required = false) String status,
                                     @RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "20") int size,
                                     HttpServletRequest request) {
        return sessionService.history(orgId, me(request), vehicleId, driverId, status, page, size);
    }

    // ── Announcements ─────────────────────────────────────────────────

    @GetMapping("/{orgId}/announcements")
    public List<AnnouncementDto> announcements(@PathVariable Long orgId, HttpServletRequest request) {
        return insightsService.announcements(orgId, me(request));
    }

    @PostMapping("/{orgId}/announcements")
    public ResponseEntity<AnnouncementDto> announce(@PathVariable Long orgId, @RequestBody AnnouncementRequest body,
                                                    HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(insightsService.announce(orgId, me(request), body));
    }

    @DeleteMapping("/{orgId}/announcements/{announcementId}")
    public ResponseEntity<Void> removeAnnouncement(@PathVariable Long orgId, @PathVariable Long announcementId,
                                                   HttpServletRequest request) {
        insightsService.removeAnnouncement(orgId, announcementId, me(request));
        return ResponseEntity.noContent().build();
    }

    // ── The admins' overview ──────────────────────────────────────────
    // tz = the browser's offset in minutes east of UTC, so "today" and each
    // day of the statistics are the viewer's own days.

    @GetMapping("/{orgId}/dashboard")
    public Dashboard dashboard(@PathVariable Long orgId,
                               @RequestParam(name = "tz", required = false) Integer tzOffsetMinutes,
                               HttpServletRequest request) {
        return insightsService.dashboard(orgId, me(request), tzOffsetMinutes);
    }

    @GetMapping("/{orgId}/analytics")
    public Analytics analytics(@PathVariable Long orgId,
                               @RequestParam(defaultValue = "30") int days,
                               @RequestParam(name = "tz", required = false) Integer tzOffsetMinutes,
                               HttpServletRequest request) {
        return insightsService.analytics(orgId, me(request), days, tzOffsetMinutes);
    }

    @GetMapping("/{orgId}/activity")
    public List<ActivityDto> activity(@PathVariable Long orgId,
                                      @RequestParam(defaultValue = "50") int limit,
                                      HttpServletRequest request) {
        return insightsService.activity(orgId, me(request), limit);
    }
}
