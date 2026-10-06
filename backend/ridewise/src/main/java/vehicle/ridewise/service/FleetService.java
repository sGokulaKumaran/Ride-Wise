package vehicle.ridewise.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.dto.OrgDtos.LiveTrip;
import vehicle.ridewise.dto.OrgDtos.RouteDto;
import vehicle.ridewise.dto.OrgDtos.RouteRequest;
import vehicle.ridewise.dto.OrgDtos.StopDto;
import vehicle.ridewise.dto.OrgDtos.VehicleDto;
import vehicle.ridewise.dto.OrgDtos.VehicleRequest;
import vehicle.ridewise.entity.OrgRoute;
import vehicle.ridewise.entity.Organization;
import vehicle.ridewise.entity.User;
import vehicle.ridewise.entity.Vehicle;
import vehicle.ridewise.entity.VehicleSession;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.repository.OrgRouteRepository;
import vehicle.ridewise.repository.UserRepository;
import vehicle.ridewise.repository.VehicleRepository;
import vehicle.ridewise.repository.VehicleSessionRepository;
import vehicle.ridewise.service.VehicleSessionService.LiveSnapshot;
import vehicle.ridewise.websocket.FleetBroadcaster;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

// ============================================================
// FleetService — an organization's vehicles and saved routes
//
// VEHICLES
//   Admins add, edit, change the status of and remove vehicles. Anyone who
//   may view the organization sees the fleet (retired vehicles only for
//   admins), each vehicle with its running trip when it has one.
//
//   Status rules
//     • only ACTIVE vehicles can be taken out by a driver
//     • a vehicle on a trip cannot be taken out of ACTIVE — end the trip
//       first, so nobody is left "driving" a bus marked as under repair
//     • removing a vehicle that has trip history retires it instead of
//       deleting it: past trips keep the vehicle they belong to
//
// ROUTES
//   A saved route (road + stops) that drivers pick when starting a trip.
//
// WHO SEES A DRIVER'S PHONE NUMBER
//   Admins of the organization always (they manage their drivers).
//   Everyone else only when the organization switched "show driver phone"
//   on — a public bus service does not publish its drivers' numbers by
//   accident.
// ============================================================
@Service
public class FleetService {

    static final Set<String> VEHICLE_TYPES = Set.of("BUS", "VAN", "AMBULANCE", "CAR", "OTHER");
    static final Set<String> VEHICLE_STATUSES = Set.of("ACTIVE", "IN_SERVICE", "REPAIR", "RETIRED");

    private static final Pattern VEHICLE_CODE = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9 ._/#-]{0,19}$");
    private static final int MAX_VEHICLES_PER_ORG = 1_000;
    private static final int MAX_ROUTES_PER_ORG = 200;
    private static final int MAX_STOPS = 60;
    private static final int MAX_ROUTE_CHARS = 1_500_000;
    private static final int MAX_STEPS_CHARS = 400_000;

    private final VehicleRepository vehicleRepository;
    private final OrgRouteRepository routeRepository;
    private final VehicleSessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final OrgGuard guard;
    private final VehicleSessionService sessionService;
    private final VehicleAlertService alertService;
    private final OrgAuditService audit;
    private final FleetBroadcaster broadcaster;
    private final ObjectMapper objectMapper;

    public FleetService(VehicleRepository vehicleRepository,
                        OrgRouteRepository routeRepository,
                        VehicleSessionRepository sessionRepository,
                        UserRepository userRepository,
                        OrgGuard guard,
                        VehicleSessionService sessionService,
                        VehicleAlertService alertService,
                        OrgAuditService audit,
                        FleetBroadcaster broadcaster,
                        ObjectMapper objectMapper) {
        this.vehicleRepository = vehicleRepository;
        this.routeRepository = routeRepository;
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
        this.guard = guard;
        this.sessionService = sessionService;
        this.alertService = alertService;
        this.audit = audit;
        this.broadcaster = broadcaster;
        this.objectMapper = objectMapper;
    }

    // ============================================================
    // VEHICLES — read
    // ============================================================

    /** The fleet with every running trip — the organization page, the fleet map, the driver's list. */
    public List<VehicleDto> listVehicles(Long orgId, Long userId) {
        Organization org = guard.requireOrg(orgId);
        guard.requireView(org, userId);
        boolean manager = guard.isManager(orgId, userId);

        Map<Long, VehicleSession> running = sessionRepository.findByOrgIdAndStatus(orgId, "ACTIVE").stream()
                .collect(Collectors.toMap(VehicleSession::getVehicleId, s -> s, (a, b) -> a));
        Map<Long, String> phones = driverPhones(org, manager, running.values().stream().toList());

        List<VehicleDto> result = new ArrayList<>();
        for (Vehicle vehicle : vehicleRepository.findByOrgIdOrderByVehicleCodeAsc(orgId)) {
            if (!manager && "RETIRED".equals(vehicle.getStatus())) continue;
            VehicleSession trip = running.get(vehicle.getId());
            result.add(forViewer(
                    toDto(vehicle, trip, trip == null ? null : phones.get(trip.getDriverUserId())), manager));
        }
        return result;
    }

    /** One vehicle with its running trip (if any). */
    public VehicleDto getVehicle(Long orgId, Long vehicleId, Long userId) {
        Organization org = guard.requireOrg(orgId);
        guard.requireView(org, userId);
        boolean manager = guard.isManager(orgId, userId);

        Vehicle vehicle = requireVehicle(orgId, vehicleId);
        if (!manager && "RETIRED".equals(vehicle.getStatus())) throw ApiException.notFound("Vehicle not found");

        VehicleSession trip = sessionService.activeForVehicle(vehicleId);
        String phone = trip == null ? null
                : driverPhones(org, manager, List.of(trip)).get(trip.getDriverUserId());
        return forViewer(toDto(vehicle, trip, phone), manager);
    }

    // ============================================================
    // VEHICLES — change (admins)
    // ============================================================

    @Transactional
    public VehicleDto addVehicle(Long orgId, Long userId, VehicleRequest request) {
        guard.requireOrg(orgId);
        guard.requireManager(orgId, userId);
        if (vehicleRepository.countByOrgId(orgId) >= MAX_VEHICLES_PER_ORG) {
            throw ApiException.conflict("This organization has reached the limit of " + MAX_VEHICLES_PER_ORG + " vehicles");
        }

        Vehicle vehicle = new Vehicle();
        vehicle.setOrgId(orgId);
        apply(vehicle, request, true);
        vehicle.setStatus("ACTIVE");
        Vehicle saved = vehicleRepository.save(vehicle);

        audit.record(orgId, userId, "vehicle.add", "added " + saved.getVehicleCode());
        announceChange(orgId, saved.getId());
        return toDto(saved, null, null);
    }

    @Transactional
    public VehicleDto updateVehicle(Long orgId, Long vehicleId, Long userId, VehicleRequest request) {
        guard.requireOrg(orgId);
        guard.requireManager(orgId, userId);
        Vehicle vehicle = requireVehicle(orgId, vehicleId);

        apply(vehicle, request, false);
        Vehicle saved = vehicleRepository.save(vehicle);

        audit.record(orgId, userId, "vehicle.edit", "edited " + saved.getVehicleCode());
        announceChange(orgId, saved.getId());
        return toDto(saved, sessionService.activeForVehicle(vehicleId), null);
    }

    @Transactional
    public VehicleDto setVehicleStatus(Long orgId, Long vehicleId, Long userId, String status) {
        guard.requireOrg(orgId);
        guard.requireManager(orgId, userId);
        Vehicle vehicle = requireVehicle(orgId, vehicleId);

        String next = status == null ? "" : status.trim().toUpperCase();
        if (!VEHICLE_STATUSES.contains(next)) throw ApiException.badRequest("Unknown vehicle status");
        if (next.equals(vehicle.getStatus())) return toDto(vehicle, sessionService.activeForVehicle(vehicleId), null);

        VehicleSession trip = sessionService.activeForVehicle(vehicleId);
        if (trip != null && !"ACTIVE".equals(next)) {
            throw ApiException.conflict(vehicle.getVehicleCode() + " is on a trip with " + trip.getDriverName()
                    + ". End the trip before changing its status.");
        }

        vehicle.setStatus(next);
        Vehicle saved = vehicleRepository.save(vehicle);
        audit.record(orgId, userId, "vehicle.status",
                "set " + saved.getVehicleCode() + " to " + statusWords(next));
        announceChange(orgId, saved.getId());
        return toDto(saved, trip, null);
    }

    /**
     * Remove a vehicle. Returns true when it was deleted, false when it was
     * retired instead (it has trip history that must keep its vehicle).
     */
    @Transactional
    public boolean removeVehicle(Long orgId, Long vehicleId, Long userId) {
        guard.requireOrg(orgId);
        guard.requireManager(orgId, userId);
        Vehicle vehicle = requireVehicle(orgId, vehicleId);

        if (sessionService.activeForVehicle(vehicleId) != null) {
            throw ApiException.conflict(vehicle.getVehicleCode() + " is on a trip. End the trip before removing it.");
        }

        boolean hasHistory = sessionRepository.existsByVehicleId(vehicleId);
        if (hasHistory) {
            vehicle.setStatus("RETIRED");
            vehicleRepository.save(vehicle);
            audit.record(orgId, userId, "vehicle.retire", "retired " + vehicle.getVehicleCode());
        } else {
            alertService.removeForVehicle(vehicleId);
            vehicleRepository.delete(vehicle);
            audit.record(orgId, userId, "vehicle.remove", "removed " + vehicle.getVehicleCode());
        }
        announceChange(orgId, vehicleId);
        return !hasHistory;
    }

    private void apply(Vehicle vehicle, VehicleRequest request, boolean creating) {
        if (request == null) throw ApiException.badRequest("Vehicle details are required");

        if (creating || request.vehicleCode() != null) {
            String code = request.vehicleCode() == null ? "" : request.vehicleCode().trim();
            if (!VEHICLE_CODE.matcher(code).matches()) {
                throw ApiException.badRequest("Give the vehicle a short code, such as BUS-01 (letters, numbers, spaces and - . / #, up to 20 characters)");
            }
            vehicleRepository.findByOrgIdAndVehicleCodeIgnoreCase(vehicle.getOrgId(), code).ifPresent(existing -> {
                if (!existing.getId().equals(vehicle.getId())) {
                    throw ApiException.conflict("Another vehicle already uses the code " + existing.getVehicleCode());
                }
            });
            vehicle.setVehicleCode(code);
        }

        if (creating || request.vehicleType() != null) {
            String type = request.vehicleType() == null ? "BUS" : request.vehicleType().trim().toUpperCase();
            if (!VEHICLE_TYPES.contains(type)) throw ApiException.badRequest("Unknown vehicle type");
            vehicle.setVehicleType(type);
        }

        if (request.registrationNumber() != null) {
            String registration = request.registrationNumber().trim().toUpperCase();
            if (registration.length() > 20) throw ApiException.badRequest("The registration number is too long");
            vehicle.setRegistrationNumber(registration.isEmpty() ? null : registration);
        }

        if (request.capacity() != null) {
            int capacity = request.capacity();
            if (capacity < 0 || capacity > 500) throw ApiException.badRequest("Seats must be between 1 and 500");
            vehicle.setCapacity(capacity == 0 ? null : capacity);
        }

        if (request.description() != null) {
            String description = request.description().trim();
            if (description.length() > 300) throw ApiException.badRequest("Notes can be at most 300 characters");
            vehicle.setDescription(description.isEmpty() ? null : description);
        }
    }

    // ============================================================
    // ROUTES
    // ============================================================

    /** Saved routes without their geometry (lists). */
    public List<RouteDto> listRoutes(Long orgId, Long userId) {
        Organization org = guard.requireOrg(orgId);
        guard.requireView(org, userId);
        return routeRepository.findSummaryByOrgIdOrderByNameAsc(orgId).stream()
                .map(r -> new RouteDto(r.getId(), r.getOrgId(), r.getName(),
                        r.getFromName(), r.getFromLat(), r.getFromLng(),
                        r.getDestinationName(), r.getDestinationLat(), r.getDestinationLng(),
                        r.getDistanceMeters(), r.getDurationSeconds(),
                        sessionService.readStops(r.getStopsJson()), null, null))
                .toList();
    }

    /** One saved route with its road and turn-by-turn steps. */
    public RouteDto getRoute(Long orgId, Long routeId, Long userId) {
        Organization org = guard.requireOrg(orgId);
        guard.requireView(org, userId);
        return toDto(requireRoute(orgId, routeId), true);
    }

    @Transactional
    public RouteDto addRoute(Long orgId, Long userId, RouteRequest request) {
        guard.requireOrg(orgId);
        guard.requireManager(orgId, userId);
        if (routeRepository.countByOrgId(orgId) >= MAX_ROUTES_PER_ORG) {
            throw ApiException.conflict("This organization has reached the limit of " + MAX_ROUTES_PER_ORG + " routes");
        }
        OrgRoute route = new OrgRoute();
        route.setOrgId(orgId);
        apply(route, request, true);
        OrgRoute saved = routeRepository.save(route);
        audit.record(orgId, userId, "route.add", "added the route " + saved.getName());
        return toDto(saved, false);
    }

    @Transactional
    public RouteDto updateRoute(Long orgId, Long routeId, Long userId, RouteRequest request) {
        guard.requireOrg(orgId);
        guard.requireManager(orgId, userId);
        OrgRoute route = requireRoute(orgId, routeId);
        apply(route, request, false);
        OrgRoute saved = routeRepository.save(route);
        audit.record(orgId, userId, "route.edit", "edited the route " + saved.getName());
        return toDto(saved, false);
    }

    /** Trips already driven on the route keep their own copy of it. */
    @Transactional
    public void removeRoute(Long orgId, Long routeId, Long userId) {
        guard.requireOrg(orgId);
        guard.requireManager(orgId, userId);
        OrgRoute route = requireRoute(orgId, routeId);
        routeRepository.delete(route);
        audit.record(orgId, userId, "route.remove", "removed the route " + route.getName());
    }

    private void apply(OrgRoute route, RouteRequest request, boolean creating) {
        if (request == null) throw ApiException.badRequest("Route details are required");

        if (creating || request.name() != null) {
            String name = request.name() == null ? "" : request.name().trim();
            if (name.isEmpty() || name.length() > 80) {
                throw ApiException.badRequest("Give the route a name (up to 80 characters)");
            }
            route.setName(name);
        }

        // The road itself: all of it, or (when editing) none of it.
        boolean hasRoad = request.routeCoordinates() != null || request.destinationLat() != null
                || request.fromLat() != null;
        if (creating || hasRoad) {
            if (!GeoMath.validLatLng(request.fromLat(), request.fromLng())
                    || !GeoMath.validLatLng(request.destinationLat(), request.destinationLng())) {
                throw ApiException.badRequest("A route needs a start and a destination");
            }
            String coordinates = request.routeCoordinates();
            if (coordinates == null || coordinates.isBlank()) {
                throw ApiException.badRequest("Plan the route on the map before saving it");
            }
            if (coordinates.length() > MAX_ROUTE_CHARS) throw ApiException.badRequest("This route is too long to save");
            String steps = request.routeSteps();
            if (steps != null && steps.length() > MAX_STEPS_CHARS) {
                throw ApiException.badRequest("This route has too many steps to save");
            }
            route.setFromName(clean(request.fromName(), 255));
            route.setFromLat(request.fromLat());
            route.setFromLng(request.fromLng());
            route.setDestinationName(clean(request.destinationName(), 255));
            route.setDestinationLat(request.destinationLat());
            route.setDestinationLng(request.destinationLng());
            route.setRouteCoordinates(coordinates);
            route.setRouteSteps(steps == null || steps.isBlank() ? null : steps);
            route.setDistanceMeters(GeoMath.nonNegative(request.distanceMeters()));
            route.setDurationSeconds(GeoMath.nonNegative(request.durationSeconds()));
        }

        if (creating || request.stops() != null) {
            route.setStopsJson(writeStops(request.stops()));
        }
    }

    private String writeStops(List<StopDto> stops) {
        if (stops == null || stops.isEmpty()) return null;
        if (stops.size() > MAX_STOPS) throw ApiException.badRequest("A route can have at most " + MAX_STOPS + " stops");

        List<StopDto> clean = new ArrayList<>();
        for (StopDto stop : stops) {
            if (stop == null || !GeoMath.validLatLng(stop.lat(), stop.lng())) {
                throw ApiException.badRequest("Every stop needs a place on the map");
            }
            String name = stop.name() == null ? "" : stop.name().trim();
            if (name.isEmpty()) throw ApiException.badRequest("Every stop needs a name");
            clean.add(new StopDto(name.length() > 80 ? name.substring(0, 80) : name, stop.lat(), stop.lng()));
        }
        try {
            return objectMapper.writeValueAsString(clean);
        } catch (Exception e) {
            throw ApiException.badRequest("The stops could not be saved");
        }
    }

    // ============================================================
    // MAPPING
    // ============================================================

    VehicleDto toDto(Vehicle v, VehicleSession trip, String driverPhone) {
        return new VehicleDto(
                v.getId(), v.getOrgId(), v.getVehicleCode(), v.getVehicleType(),
                v.getRegistrationNumber(), v.getCapacity(), v.getDescription(), v.getStatus(),
                v.getLastLat(), v.getLastLng(), v.getLastLocationAt(),
                trip == null ? null : tripFor(trip, driverPhone));
    }

    // A vehicle's notes ("gearbox due in March") are the admins' own.
    private static VehicleDto forViewer(VehicleDto v, boolean manager) {
        if (manager || v.description() == null) return v;
        return new VehicleDto(v.id(), v.orgId(), v.vehicleCode(), v.vehicleType(), v.registrationNumber(),
                v.capacity(), null, v.status(), v.lastLat(), v.lastLng(), v.lastLocationAt(), v.trip());
    }

    /** A running trip as watchers see it: the newest position, and how old it is. */
    LiveTrip tripFor(VehicleSession s, String driverPhone) {
        LiveSnapshot now = sessionService.snapshot(s.getId());
        Double lat = now != null ? Double.valueOf(now.lat()) : s.getLastLat();
        Double lng = now != null ? Double.valueOf(now.lng()) : s.getLastLng();
        LocalDateTime locationAt = now != null
                ? LocalDateTime.ofInstant(Instant.ofEpochMilli(now.fixAtMs()), ZoneId.systemDefault())
                : s.getLastLocationAt();
        Long age = locationAt == null ? null
                : Math.max(0, Duration.between(locationAt, LocalDateTime.now()).getSeconds());

        return new LiveTrip(
                s.getId(), s.getRouteId(), s.getRouteName(),
                s.getFromName(), s.getDestinationName(),
                s.getDestinationLat(), s.getDestinationLng(),
                s.getDriverName(), driverPhone,
                s.getStartedAt(),
                lat, lng,
                now != null ? now.speed() : s.getLastSpeed(),
                now != null ? now.heading() : s.getLastHeading(),
                now != null ? now.accuracy() : s.getLastAccuracy(),
                locationAt, age,
                now != null ? Double.valueOf(now.distanceMeters()) : s.getDistanceMeters(),
                s.getPlannedDistanceMeters(), s.getPlannedDurationSeconds(),
                s.getCrowdLevel(), Boolean.TRUE.equals(s.getSosActive()), s.getSosMessage());
    }

    // driver user id → phone, for the trips whose driver's number this viewer may see
    private Map<Long, String> driverPhones(Organization org, boolean manager, List<VehicleSession> trips) {
        Map<Long, String> phones = new HashMap<>();
        if (trips.isEmpty() || !(manager || Boolean.TRUE.equals(org.getShowDriverPhone()))) return phones;
        List<Long> driverIds = trips.stream().map(VehicleSession::getDriverUserId).distinct().toList();
        for (User driver : userRepository.findAllById(driverIds)) {
            if (driver.getMobile() != null) phones.put(driver.getId(), driver.getMobile());
        }
        return phones;
    }

    private RouteDto toDto(OrgRoute r, boolean withRoad) {
        return new RouteDto(r.getId(), r.getOrgId(), r.getName(),
                r.getFromName(), r.getFromLat(), r.getFromLng(),
                r.getDestinationName(), r.getDestinationLat(), r.getDestinationLng(),
                r.getDistanceMeters(), r.getDurationSeconds(),
                sessionService.readStops(r.getStopsJson()),
                withRoad ? r.getRouteCoordinates() : null,
                withRoad ? r.getRouteSteps() : null);
    }

    Vehicle requireVehicle(Long orgId, Long vehicleId) {
        if (vehicleId == null) throw ApiException.badRequest("A vehicle is required");
        return vehicleRepository.findByIdAndOrgId(vehicleId, orgId)
                .orElseThrow(() -> ApiException.notFound("Vehicle not found"));
    }

    private OrgRoute requireRoute(Long orgId, Long routeId) {
        if (routeId == null) throw ApiException.badRequest("A route is required");
        return routeRepository.findByIdAndOrgId(routeId, orgId)
                .orElseThrow(() -> ApiException.notFound("Route not found"));
    }

    // Lists on other screens refresh themselves when the fleet changes.
    private void announceChange(Long orgId, Long vehicleId) {
        Tx.afterCommit(() -> broadcaster.publish(orgId, vehicleId,
                Map.of("type", "vehicle-changed", "orgId", orgId, "vehicleId", vehicleId)));
    }

    static String statusWords(String status) {
        return switch (status) {
            case "ACTIVE" -> "Active";
            case "IN_SERVICE" -> "In service";
            case "REPAIR" -> "Repair";
            case "RETIRED" -> "Retired";
            default -> status;
        };
    }

    private static String clean(String value, int max) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return null;
        return trimmed.length() > max ? trimmed.substring(0, max) : trimmed;
    }
}
