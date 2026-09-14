// ============================================================
// 📍 useRideLocation — React hook for live rider location
//
// Uses locationService.watchLocation() under the hood.
// When the component unmounts, location tracking stops automatically.
//
// Usage:
//   const { location, error, isWatching } = useRideLocation(active);
//
// active = true  → starts watching
// active = false → stops watching
// ============================================================

import { useState, useEffect } from "react";
import { watchLocation } from "../../services/locationService";

export function useRideLocation(active = true) {
  const [location,   setLocation]   = useState(null);
  const [error,      setError]      = useState(null);
  const [isWatching, setIsWatching] = useState(false);

  useEffect(() => {
    if (!active) return;

    setIsWatching(true);
    
    // Start watching; the cleanup function stops it
    const stop = watchLocation((loc) => {
      setLocation(loc);
      setError(null);
    });

    // Cleanup when component unmounts or active changes to false
    return () => {
      stop();
      setIsWatching(false);
    };
  }, [active]);

  return { location, error, isWatching };
}
