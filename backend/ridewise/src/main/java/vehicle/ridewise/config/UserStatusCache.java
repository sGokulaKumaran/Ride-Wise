package vehicle.ridewise.config;

import org.springframework.stereotype.Component;
import vehicle.ridewise.repository.UserRepository;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// ============================================================
// UserStatusCache — "may this account still use the app?"
//
// WHY THIS EXISTS
//   Suspending a user only blocked their NEXT login. A session that was
//   already open stayed valid for up to 30 days, so a suspended rider
//   could keep using everything.
//
//   The session interceptor now asks this cache on every request. The
//   answer is remembered for a few seconds per user, so the check costs
//   one map lookup instead of one database query per request, and
//   suspending someone takes effect at once on this server (the admin
//   service evicts the entry) and within the TTL in any case.
//
// An account that no longer exists counts as "not active" too.
//
// SIGNED OUT ELSEWHERE
//   "Sign out of other devices" and a password change record a moment
//   (User.sessionsValidAfter); a session started before it is refused,
//   while the device that asked gets a fresh session and carries on.
// ============================================================
@Component
public class UserStatusCache {

    private static final long TTL_MS = 30_000;

    /** What a session of this account may do. */
    public enum SessionState { VALID, SUSPENDED, SIGNED_OUT }

    private record Entry(boolean active, Long sessionsValidAfter, long checkedAt) { }

    private final Map<Long, Entry> entries = new ConcurrentHashMap<>();
    private final UserRepository userRepository;

    public UserStatusCache(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /** True when the account exists and has not been suspended. */
    public boolean isActive(Long userId) {
        return userId != null && entry(userId).active();
    }

    /**
     * May a session of this account that started at {@code sessionCreatedAt}
     * (epoch milliseconds) still be used?
     */
    public SessionState check(Long userId, long sessionCreatedAt) {
        if (userId == null) return SessionState.SUSPENDED;
        Entry entry = entry(userId);
        if (!entry.active()) return SessionState.SUSPENDED;
        Long validAfter = entry.sessionsValidAfter();
        if (validAfter != null && sessionCreatedAt < validAfter) return SessionState.SIGNED_OUT;
        return SessionState.VALID;
    }

    /** Forget what is known about a user — call after changing their status. */
    public void evict(Long userId) {
        if (userId != null) entries.remove(userId);
    }

    private Entry entry(Long userId) {
        long now = System.currentTimeMillis();
        Entry cached = entries.get(userId);
        if (cached != null && now - cached.checkedAt() < TTL_MS) {
            return cached;
        }

        Entry fresh = userRepository.findById(userId)
                .map(user -> new Entry(!Boolean.FALSE.equals(user.getEnabled()), user.getSessionsValidAfter(), now))
                .orElse(new Entry(false, null, now));
        entries.put(userId, fresh);
        return fresh;
    }
}
