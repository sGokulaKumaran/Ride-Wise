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
// ============================================================
@Component
public class UserStatusCache {

    private static final long TTL_MS = 30_000;

    private record Entry(boolean active, long checkedAt) { }

    private final Map<Long, Entry> entries = new ConcurrentHashMap<>();
    private final UserRepository userRepository;

    public UserStatusCache(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /** True when the account exists and has not been suspended. */
    public boolean isActive(Long userId) {
        if (userId == null) return false;

        long now = System.currentTimeMillis();
        Entry cached = entries.get(userId);
        if (cached != null && now - cached.checkedAt() < TTL_MS) {
            return cached.active();
        }

        boolean active = userRepository.findById(userId)
                .map(user -> !Boolean.FALSE.equals(user.getEnabled()))
                .orElse(false);
        entries.put(userId, new Entry(active, now));
        return active;
    }

    /** Forget what is known about a user — call after changing their status. */
    public void evict(Long userId) {
        if (userId != null) entries.remove(userId);
    }
}
