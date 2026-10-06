package vehicle.ridewise.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vehicle.ridewise.config.SessionAuthInterceptor;
import vehicle.ridewise.dto.OrgDtos.AlertDto;
import vehicle.ridewise.dto.OrgDtos.AlertRequest;
import vehicle.ridewise.dto.OrgDtos.CrowdRequest;
import vehicle.ridewise.dto.OrgDtos.DriverTrip;
import vehicle.ridewise.dto.OrgDtos.PageDto;
import vehicle.ridewise.dto.OrgDtos.PositionRequest;
import vehicle.ridewise.dto.OrgDtos.SessionDto;
import vehicle.ridewise.dto.OrgDtos.SessionTrack;
import vehicle.ridewise.dto.OrgDtos.SosRequest;
import vehicle.ridewise.dto.OrgDtos.StartSessionRequest;
import vehicle.ridewise.service.VehicleAlertService;
import vehicle.ridewise.service.VehicleSessionService;

import java.util.Map;

// ============================================================
// VehicleSessionController — trips
//
//   /api/vehicle-sessions            a driver's trip: start, the one in
//                                    progress, position, SOS, seats, end
//   /api/vehicle-alerts              "tell me when the bus is near"
//
// POSITIONS normally travel over the fleet WebSocket (/ws/fleet). The
// POST …/position endpoint is the same thing over plain HTTP — the driver's
// app falls back to it whenever the socket is down, so a weak connection
// never stops a vehicle from reporting where it is.
// ============================================================
@RestController
@RequestMapping("/api")
public class VehicleSessionController {

    private final VehicleSessionService sessionService;
    private final VehicleAlertService alertService;

    public VehicleSessionController(VehicleSessionService sessionService, VehicleAlertService alertService) {
        this.sessionService = sessionService;
        this.alertService = alertService;
    }

    private static Long me(HttpServletRequest request) {
        return SessionAuthInterceptor.requireUserId(request);
    }

    // ── The driver's trip ─────────────────────────────────────────────

    @PostMapping("/vehicle-sessions")
    public ResponseEntity<DriverTrip> start(@RequestBody StartSessionRequest body, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(sessionService.start(me(request), body));
    }

    /** The trip I am driving right now — 204 when there is none. */
    @GetMapping("/vehicle-sessions/active")
    public ResponseEntity<DriverTrip> active(HttpServletRequest request) {
        DriverTrip trip = sessionService.myActiveTrip(me(request));
        return trip == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(trip);
    }

    @GetMapping("/vehicle-sessions/mine")
    public PageDto<SessionDto> mine(@RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "20") int size,
                                    HttpServletRequest request) {
        return sessionService.myHistory(me(request), page, size);
    }

    @PostMapping("/vehicle-sessions/{sessionId}/position")
    public Map<String, Object> position(@PathVariable Long sessionId, @RequestBody PositionRequest body,
                                        HttpServletRequest request) {
        boolean accepted = sessionService.acceptPosition(sessionId, me(request), body);
        return Map.of("accepted", accepted);
    }

    @PutMapping("/vehicle-sessions/{sessionId}/sos")
    public SessionDto sos(@PathVariable Long sessionId, @RequestBody SosRequest body, HttpServletRequest request) {
        boolean active = body != null && Boolean.TRUE.equals(body.active());
        return sessionService.setSos(sessionId, me(request), active, body == null ? null : body.message());
    }

    @PutMapping("/vehicle-sessions/{sessionId}/crowd")
    public SessionDto crowd(@PathVariable Long sessionId, @RequestBody CrowdRequest body, HttpServletRequest request) {
        return sessionService.setCrowd(sessionId, me(request), body == null ? null : body.level());
    }

    /** The driver ends their trip. */
    @PostMapping("/vehicle-sessions/{sessionId}/stop")
    public SessionDto stop(@PathVariable Long sessionId, HttpServletRequest request) {
        return sessionService.stop(sessionId, me(request));
    }

    /** An admin ends a trip its driver left running. */
    @PostMapping("/vehicle-sessions/{sessionId}/end")
    public SessionDto forceEnd(@PathVariable Long sessionId, HttpServletRequest request) {
        return sessionService.forceEnd(sessionId, me(request));
    }

    /** A trip with the path it really took (its driver, or an admin of the organization). */
    @GetMapping("/vehicle-sessions/{sessionId}/track")
    public SessionTrack track(@PathVariable Long sessionId, HttpServletRequest request) {
        return sessionService.track(sessionId, me(request));
    }

    // ── "Tell me when it is near" ─────────────────────────────────────

    @PutMapping("/vehicle-alerts")
    public AlertDto saveAlert(@RequestBody AlertRequest body, HttpServletRequest request) {
        return alertService.save(me(request), body);
    }

    @DeleteMapping("/vehicle-alerts/{vehicleId}")
    public ResponseEntity<Void> removeAlert(@PathVariable Long vehicleId, HttpServletRequest request) {
        alertService.remove(me(request), vehicleId);
        return ResponseEntity.noContent().build();
    }
}
