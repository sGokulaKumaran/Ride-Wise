import { useState, useRef, useCallback } from 'react';
import { OpenStreetMapProvider } from 'leaflet-geosearch';

const provider = new OpenStreetMapProvider();

export function useLocationSearch(debounceMs = 500) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  const search = useCallback((query) => {
    clearTimeout(timerRef.current);
    if (!query || !query.trim()) {
      setResults([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await provider.search({ query: query.trim() });
        setResults(
          (res || []).slice(0, 6).map(item => ({
            label: item.label,
            lat: item.y,
            lng: item.x,
          }))
        );
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);
  }, [debounceMs]);

  const clear = useCallback(() => {
    clearTimeout(timerRef.current);
    setResults([]);
  }, []);

  return { results, loading, search, clear };
}
