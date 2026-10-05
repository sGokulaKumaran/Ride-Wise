// ============================================================
// useLocationSearch — search-as-you-type for places (OpenStreetMap data)
//
//   const { results, loading, searched, failed, search, clear } = useLocationSearch();
//   search("marina", near)   → results: [{ label, name, detail, lat, lng }, …]  (max 6)
//
//   near      optional { lat, lng } — places close to it are listed first.
//             Defaults to the rider's last known position, when there is one.
//   searched  true once the latest query has an answer — lets the UI tell
//             "no places found" apart from "still typing".
//   failed    true when the search services could not be reached, so the
//             UI can say "check your connection" instead of "no such place".
//
// Requests are debounced, a request for an older query is cancelled, and
// an answer that still arrives late is discarded (a slow early request
// used to overwrite the results of a faster later one).
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { searchPlaces } from "../../services/routingApi";
import { getLastKnownLocation } from "../../services/locationService";

export function useLocationSearch(debounceMs = 350) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef(null);
  const latestRef = useRef(0);   // id of the newest query
  const requestRef = useRef(null); // AbortController of the request in flight

  // Drop whatever is waiting or in flight; returns the id for a new query.
  const cancelPending = useCallback(() => {
    clearTimeout(timerRef.current);
    requestRef.current?.abort();
    requestRef.current = null;
    latestRef.current += 1;
    return latestRef.current;
  }, []);

  const search = useCallback((query, near = null) => {
    const id = cancelPending();
    const text = (query || "").trim();
    setSearched(false);
    setFailed(false);

    if (text.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      requestRef.current = controller;
      setLoading(true);

      let found = [];
      let unreachable = false;
      try {
        found = await searchPlaces(text, {
          near: near || getLastKnownLocation(),
          limit: 6,
          signal: controller.signal,
        });
      } catch (err) {
        if (err?.name === "AbortError") return; // a newer query took over
        unreachable = true;
      }
      if (id !== latestRef.current) return;     // a newer query took over

      setResults(found);
      setFailed(unreachable);
      setSearched(true);
      setLoading(false);
    }, debounceMs);
  }, [debounceMs, cancelPending]);

  const clear = useCallback(() => {
    cancelPending();
    setResults([]);
    setSearched(false);
    setFailed(false);
    setLoading(false);
  }, [cancelPending]);

  // Nothing may fire after the input is gone
  useEffect(() => () => { cancelPending(); }, [cancelPending]);

  return { results, loading, searched, failed, search, clear };
}
