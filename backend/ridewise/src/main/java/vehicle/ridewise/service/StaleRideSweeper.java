package vehicle.ridewise.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vehicle.ridewise.entity.Ride;
import vehicle.ridewise.repository.RideRepository;

import java.time.LocalDateTime;
import java.util.List;

// ============================================================
// StaleRideSweeper — ends rides that were never ended
//
// A ride stays "active" until someone presses End. When that never
// happens (the rider closed the app, the phone died, the group admin
// went home) the ride used to stay live forever: it sat under "Continue
// riding" for every member, kept the admin dashboard's "active rides"
// count wrong, and its route data was never cleaned up.
//
// Once an hour, rides that have been active for longer than
//     ridewise.rides.auto-end-hours   (default 48, 0 = never)
// are ended as "completed", exactly as if the owner had ended them —
// riders watching the map are told, and GPS data is cleaned up.
// ============================================================
@Component
public class StaleRideSweeper {

    private static final Logger log = LoggerFactory.getLogger(StaleRideSweeper.class);

    private final RideRepository rideRepository;
    private final RideService rideService;
    private final long autoEndHours;

    public StaleRideSweeper(RideRepository rideRepository,
                            RideService rideService,
                            @Value("${ridewise.rides.auto-end-hours:48}") long autoEndHours) {
        this.rideRepository = rideRepository;
        this.rideService = rideService;
        this.autoEndHours = autoEndHours;
    }

    @Scheduled(initialDelay = 5 * 60_000, fixedRate = 60 * 60_000)
    public void endAbandonedRides() {
        if (autoEndHours <= 0) return;

        LocalDateTime cutoff = LocalDateTime.now().minusHours(autoEndHours);
        List<Ride> abandoned = rideRepository.findByStatusAndCreatedAtBefore("active", cutoff);
        int ended = 0;
        for (Ride ride : abandoned) {
            try {
                rideService.endAbandonedRide(ride.getId());
                ended++;
            } catch (Exception e) {
                log.warn("Could not auto-end ride #{}: {}", ride.getId(), e.getMessage());
            }
        }
        if (ended > 0) {
            log.info("Ended {} ride(s) that had been active for more than {} hours", ended, autoEndHours);
        }
    }
}
