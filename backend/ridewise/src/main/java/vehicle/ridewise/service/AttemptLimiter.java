package vehicle.ridewise.service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// ============================================================
// AttemptLimiter — "too many wrong tries, wait a while"
//
// A small reusable counter (not a Spring bean; each use creates its own
// with its own limits). After `maxFailures` failures inside `windowMs`,
// the key is locked for `lockMs`. A success clears the key.
//
// Used for the access password of private organizations: without it a
// password could be found by simply trying thousands of them.
//
// Kept in memory on purpose — it needs no table, and a restart merely
// resets the counters.
// ============================================================
public class AttemptLimiter {

    private static final int MAX_TRACKED = 50_000; // hard cap on memory use

    private static final class Attempts {
        int failures;
        long windowStart;
        long lockedUntil;
    }

    private final int maxFailures;
    private final long windowMs;
    private final long lockMs;
    private final Map<String, Attempts> attempts = new ConcurrentHashMap<>();

    public AttemptLimiter(int maxFailures, long windowMs, long lockMs) {
        this.maxFailures = maxFailures;
        this.windowMs = windowMs;
        this.lockMs = lockMs;
    }

    /** Minutes the key is still locked for; 0 when it may try. */
    public long lockedMinutes(String key) {
        Attempts a = key == null ? null : attempts.get(key);
        if (a == null) return 0;
        long now = System.currentTimeMillis();
        synchronized (a) {
            return a.lockedUntil > now ? Math.max(1, (a.lockedUntil - now + 59_999) / 60_000) : 0;
        }
    }

    public void recordFailure(String key) {
        if (key == null) return;
        if (attempts.size() >= MAX_TRACKED) purgeExpired();

        long now = System.currentTimeMillis();
        Attempts a = attempts.computeIfAbsent(key, k -> new Attempts());
        synchronized (a) {
            if (now - a.windowStart > windowMs) {
                a.windowStart = now;
                a.failures = 0;
            }
            a.failures++;
            if (a.failures >= maxFailures) {
                a.lockedUntil = now + lockMs;
                a.failures = 0;
                a.windowStart = now;
            }
        }
    }

    public void recordSuccess(String key) {
        if (key != null) attempts.remove(key);
    }

    private void purgeExpired() {
        long now = System.currentTimeMillis();
        attempts.entrySet().removeIf(entry -> {
            Attempts a = entry.getValue();
            return a.lockedUntil < now && now - a.windowStart > windowMs;
        });
    }
}
