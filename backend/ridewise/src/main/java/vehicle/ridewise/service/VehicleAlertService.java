package vehicle.ridewise.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vehicle.ridewise.dto.OrgDtos.AlertDto;
import vehicle.ridewise.dto.OrgDtos.AlertRequest;
import vehicle.ridewise.entity.Organization;
import vehicle.ridewise.entity.Vehicle;
import vehicle.ridewise.entity.VehicleAlert;
import vehicle.ridewise.exception.ApiException;
import vehicle.ridewise.repository.VehicleAlertRepository;
import vehicle.ridewise.repository.VehicleRepository;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// ============================================================
// VehicleAlertService — "tell me when the bus is near"
//
// A person tracking a vehicle saves one place (their stop, or where they
// stand) and a distance. Each time the vehicle's position is stored, the
// alerts of that vehicle are checked; the first time it comes within the
// distance during a trip, the person gets a notification.
//
// WHY ON THE SERVER
//   The whole point is to be told while NOT staring at the map. A check
//   in the browser stops the moment the tab is closed.
//
// COST
//   Positions arrive every few seconds for every running vehicle, so the
//   alerts of a vehicle are kept in memory (loaded once, refreshed when
//   someone adds or removes one). A vehicle nobody set an alert for costs
//   one map lookup per position.
//
// ONCE PER TRIP
//   lastFiredSessionId remembers the trip an alert fired for, so it does
//   not repeat while the bus waits at the stop — and it works again on
//   the next trip without being set up again.
// ============================================================
@Service
public class VehicleAlertService {

    private static final Logger log = LoggerFactory.getLogger(VehicleAlertService.class);
    private static final int MIN_RADIUS_M = 100;
    private static final int MAX_RADIUS_M = 10_000;
    private static final int MAX_ALERTS_PER_VEHICLE = 5_000;

    private final VehicleAlertRepository alertRepository;
    private final VehicleRepository vehicleRepository;
    private final OrgGuard guard;
    private final NotificationService notificationService;

    // vehicle id → its alerts (absent = not loaded yet)
    private final Map<Long, List<VehicleAlert>> byVehicle = new ConcurrentHashMap<>();

    public VehicleAlertService(VehicleAlertRepository alertRepository,
                               VehicleRepository vehicleRepository,
                               OrgGuard guard,
                               NotificationService notificationService) {
        this.alertRepository = alertRepository;
        this.vehicleRepository = vehicleRepository;
        this.guard = guard;
        this.notificationService = notificationService;
    }

    public AlertDto myAlert(Long userId, Long vehicleId) {
        return alertRepository.findByUserIdAndVehicleId(userId, vehicleId).map(VehicleAlertService::toDto).orElse(null);
    }

    @Transactional
    public AlertDto save(Long userId, AlertRequest request) {
        if (request == null || request.vehicleId() == null) throw ApiException.badRequest("A vehicle is required");
        if (!GeoMath.validLatLng(request.lat(), request.lng())) {
            throw ApiException.badRequest("Choose a place for the alert");
        }

        Vehicle vehicle = vehicleRepository.findById(request.vehicleId())
                .orElseThrow(() -> ApiException.notFound("Vehicle not found"));
        Organization org = guard.requireOrg(vehicle.getOrgId());
        guard.requireView(org, userId); // only for vehicles you are allowed to track

        int radius = request.radiusMeters() == null ? 1000
                : Math.max(MIN_RADIUS_M, Math.min(MAX_RADIUS_M, request.radiusMeters()));
        String label = request.label() == null || request.label().isBlank()
                ? "your place" : request.label().trim();
        if (label.length() > 120) label = label.substring(0, 120);

        VehicleAlert alert = alertRepository.findByUserIdAndVehicleId(userId, vehicle.getId())
                .orElseGet(VehicleAlert::new);
        if (alert.getId() == null && cached(vehicle.getId()).size() >= MAX_ALERTS_PER_VEHICLE) {
            throw ApiException.conflict("Too many people already have an alert for this vehicle");
        }
        alert.setUserId(userId);
        alert.setVehicleId(vehicle.getId());
        alert.setOrgId(org.getId());
        alert.setLabel(label);
        alert.setLat(request.lat());
        alert.setLng(request.lng());
        alert.setRadiusMeters(radius);
        alert.setLastFiredSessionId(null); // a changed alert may fire again on the running trip
        VehicleAlert saved = alertRepository.save(alert);
        Long vehicleId = vehicle.getId();
        Tx.afterCommit(() -> byVehicle.remove(vehicleId)); // reload once the new alert is really stored
        return toDto(saved);
    }

    @Transactional
    public void remove(Long userId, Long vehicleId) {
        alertRepository.deleteByUserIdAndVehicleId(userId, vehicleId);
        Tx.afterCommit(() -> byVehicle.remove(vehicleId));
    }

    /** The vehicle is gone (deleted): nobody can be alerted about it. */
    @Transactional
    public void removeForVehicle(Long vehicleId) {
        alertRepository.deleteByVehicleId(vehicleId);
        Tx.afterCommit(() -> byVehicle.remove(vehicleId));
    }

    /** One person lost access to the organization: their alerts there go too. */
    @Transactional
    public void removeForUserInOrg(Long userId, Long orgId) {
        alertRepository.deleteByUserIdAndOrgId(userId, orgId);
        Tx.afterCommit(byVehicle::clear); // rare; simply reload on demand
    }

    /** The organization is gone: so are all alerts for its vehicles. */
    @Transactional
    public void removeForOrg(Long orgId) {
        alertRepository.deleteByOrgId(orgId);
        Tx.afterCommit(byVehicle::clear);
    }

    /** The organization became private: only its members keep their alerts. */
    @Transactional
    public void removeForNonMembers(Long orgId) {
        alertRepository.deleteForNonMembers(orgId);
        Tx.afterCommit(byVehicle::clear);
    }

    // ============================================================
    // CHECK — called with each stored position of a running trip
    // ============================================================
    public void onPosition(Long sessionId, Long orgId, Long vehicleId, String vehicleCode, double lat, double lng) {
        List<VehicleAlert> alerts = cached(vehicleId);
        if (alerts.isEmpty()) return;

        Organization org = null;
        for (VehicleAlert alert : alerts) {
            double distance = GeoMath.distanceMeters(lat, lng, alert.getLat(), alert.getLng());
            if (distance > alert.getRadiusMeters()) continue;

            synchronized (alert) {
                if (sessionId.equals(alert.getLastFiredSessionId())) continue; // already told on this trip
                alert.setLastFiredSessionId(sessionId); // in memory at once: no double notification
            }
            try {
                // Asked again at the moment of telling: someone whose access
                // was taken away meanwhile must not learn where the bus is.
                if (org == null) org = guard.requireOrg(orgId);
                if (!guard.canView(org, alert.getUserId())) {
                    alertRepository.deleteByUserIdAndVehicleId(alert.getUserId(), vehicleId);
                    byVehicle.remove(vehicleId);
                    continue;
                }
                if (alertRepository.markFired(alert.getId(), sessionId) == 0) continue; // removed meanwhile
                notificationService.notifyWithLink(
                        alert.getUserId(), "vehicle_alert",
                        vehicleCode + " is nearly there",
                        vehicleCode + " is about " + describe(distance) + " from " + alert.getLabel() + ".",
                        "/organizations/" + orgId + "/track/" + vehicleId);
            } catch (Exception e) {
                log.warn("Could not deliver a vehicle alert to user #{}: {}", alert.getUserId(), e.getMessage());
            }
        }
    }

    private List<VehicleAlert> cached(Long vehicleId) {
        return byVehicle.computeIfAbsent(vehicleId, id -> List.copyOf(alertRepository.findByVehicleId(id)));
    }

    private static String describe(double meters) {
        if (meters < 950) return Math.max(50, Math.round(meters / 50.0) * 50) + " m";
        return String.format(java.util.Locale.ROOT, "%.1f km", meters / 1000.0);
    }

    private static AlertDto toDto(VehicleAlert alert) {
        return new AlertDto(alert.getVehicleId(), alert.getLabel(), alert.getLat(), alert.getLng(), alert.getRadiusMeters());
    }
}
