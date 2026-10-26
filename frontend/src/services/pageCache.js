// ============================================================
// pageCache.js — keeps what each screen loaded, for the session
//
// WHY THIS EXISTS
//   Every screen used to start empty and show a spinner, even when the
//   rider had looked at the same list seconds earlier. Big apps
//   (Instagram, YouTube, Google) instead show what they already have at
//   once and refresh it quietly: "stale-while-revalidate".
//
// HOW IT BEHAVES
//   • Opening a screen again shows its last data instantly (no spinner);
//     the screen still asks the server and swaps in the fresh answer.
//   • The cache lives in memory ONLY. A real reload — pull-to-refresh on
//     a phone, F5 / the reload button on a computer — empties it, so a
//     reload always loads everything fresh from the server.
//   • It belongs to one account. When the signed-in user changes (login,
//     logout, session expired, account deleted) it is emptied, so one
//     rider's data can never be shown to the next person on this device.
//   • Bounded: the least recently used entries are dropped past MAX_ENTRIES.
//
// EXPORTS
//   peekCache(key)            → cached data, or undefined
//   writeCache(key, data)     store / replace an entry
//   forgetCache(prefix)       drop every entry whose key starts with prefix
//   clearCache()              drop everything
//   setCacheOwner(userId)     empty the cache when the account changes
// ============================================================

const MAX_ENTRIES = 80;

// Map keeps insertion order — re-inserting on read makes it an LRU.
const store = new Map();
let owner = null;

export function peekCache(key) {
  if (key == null || !store.has(key)) return undefined;
  const data = store.get(key);
  store.delete(key);
  store.set(key, data); // most recently used goes to the end
  return data;
}

export function writeCache(key, data) {
  if (key == null || data === undefined) return;
  store.delete(key);
  store.set(key, data);
  while (store.size > MAX_ENTRIES) {
    store.delete(store.keys().next().value); // oldest first
  }
}

export function forgetCache(prefix) {
  for (const key of [...store.keys()]) {
    if (String(key).startsWith(prefix)) store.delete(key);
  }
}

export function clearCache() {
  store.clear();
}

export function setCacheOwner(userId) {
  const next = userId ?? null;
  if (next !== owner) {
    store.clear();
    owner = next;
  }
}

