package vehicle.ridewise.service;

import org.springframework.stereotype.Service;
import vehicle.ridewise.exception.ApiException;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// ============================================================
// LoginAttemptService — slows down password guessing
//
// The login endpoint accepted unlimited attempts, so a password could be
// guessed by simply trying thousands of them.
//
// Per email address: MAX_FAILURES wrong passwords within WINDOW_MS locks
// further attempts for LOCK_MS. A successful login clears the count.
//
// Kept in memory on purpose — it needs no table, and a restart merely
// resets the counters. (The check is keyed by the email being tried, so
// it protects an account whichever device the guesses come from.)
// ============================================================
@Service
public class LoginAttemptService {

    private static final int MAX_FAILURES = 8;
    private static final long WINDOW_MS = 15 * 60_000L;
    private static final long LOCK_MS = 10 * 60_000L;
    private static final int MAX_TRACKED = 50_000; // hard cap on memory use

    private static final class Attempts {
        int failures;
        long windowStart;
        long lockedUntil;
    }

    private final Map<String, Attempts> attempts = new ConcurrentHashMap<>();

    /** Throws 429 while the email is locked out. */
    public void assertAllowed(String email) {
        if (email == null) return;
        Attempts a = attempts.get(email);
        if (a == null) return;

        long now = System.currentTimeMillis();
        synchronized (a) {
            if (a.lockedUntil > now) {
                long minutes = Math.max(1, (a.lockedUntil - now + 59_999) / 60_000);
                throw ApiException.tooManyRequests(
                        "Too many failed sign-in attempts. Try again in " + minutes
                                + (minutes == 1 ? " minute." : " minutes."));
            }
        }
    }

    public void recordFailure(String email) {
        if (email == null) return;
        if (attempts.size() >= MAX_TRACKED) purgeExpired();

        long now = System.currentTimeMillis();
        Attempts a = attempts.computeIfAbsent(email, key -> new Attempts());
        synchronized (a) {
            if (now - a.windowStart > WINDOW_MS) {
                a.windowStart = now;
                a.failures = 0;
            }
            a.failures++;
            if (a.failures >= MAX_FAILURES) {
                a.lockedUntil = now + LOCK_MS;
                a.failures = 0;
                a.windowStart = now;
            }
        }
    }

    public void recordSuccess(String email) {
        if (email != null) attempts.remove(email);
    }

    private void purgeExpired() {
        long now = System.currentTimeMillis();
        attempts.entrySet().removeIf(entry -> {
            Attempts a = entry.getValue();
            return a.lockedUntil < now && now - a.windowStart > WINDOW_MS;
        });
    }
}
