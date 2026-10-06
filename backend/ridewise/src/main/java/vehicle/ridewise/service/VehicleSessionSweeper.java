package vehicle.ridewise.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vehicle.ridewise.repository.VehicleSessionRepository;

import java.time.LocalDateTime;
import java.util.List;

// ============================================================
// VehicleSessionSweeper — ends vehicle trips that went silent
//
// A driver's phone runs out of battery, the browser is closed, the driver
// simply forgets to press "End trip": without this, the vehicle would stay
// "in use" — locked for every other driver and shown as live on a map at a
// place it left hours ago.
//
// Once a minute, every running trip that has not been heard from for
// ridewise.fleet.session-timeout-minutes (default 30) is ended. The driver
// is notified, and the trip keeps the distance it had really covered.
//
// "Heard from" means any message from the driver's device — the driver's
// screen keeps reporting while it is open, even when the vehicle stands
// still or the GPS signal is poor (a bus waiting inside a depot is not an
// abandoned trip). See VehicleSessionService.endByTimeout.
// ============================================================
@Component
public class VehicleSessionSweeper {

    private static final Logger log = LoggerFactory.getLogger(VehicleSessionSweeper.class);

    private final VehicleSessionRepository sessionRepository;
    private final VehicleSessionService sessionService;
    private final long timeoutMinutes;

    public VehicleSessionSweeper(VehicleSessionRepository sessionRepository,
                                 VehicleSessionService sessionService,
                                 @Value("${ridewise.fleet.session-timeout-minutes:30}") long timeoutMinutes) {
        this.sessionRepository = sessionRepository;
        this.sessionService = sessionService;
        this.timeoutMinutes = timeoutMinutes;
    }

    @Scheduled(initialDelay = 2 * 60_000, fixedDelay = 60_000)
    public void endSilentTrips() {
        if (timeoutMinutes <= 0) return;

        List<Long> silent = sessionRepository.findStaleActiveIds(LocalDateTime.now().minusMinutes(timeoutMinutes));
        int ended = 0;
        for (Long sessionId : silent) {
            try {
                if (sessionService.endByTimeout(sessionId, timeoutMinutes)) ended++;
            } catch (Exception e) {
                log.warn("Could not auto-end vehicle trip #{}: {}", sessionId, e.getMessage());
            }
        }
        if (ended > 0) {
            log.info("Ended {} vehicle trip(s) that sent no position for {} minutes", ended, timeoutMinutes);
        }
    }
}
