// ============================================================
// 🚀 RideSetup — Plan a new ride (Solo or Group)
//
// Flow:
//   1. User types "From" location → geocoded
//   2. User types "Destination" → geocoded
//   3. Route is calculated (from → destination)
//   4. Map is shown with the route
//   5. User clicks "Start Ride" → ride is created and becomes active
//
// Uses:
//   - routingApi    (geocoding + routing)
//   - rideApi       (create + save route)
//   - RideMap       (display)
// ============================================================

import { useState } from "react";
import { geocode, getRoute, formatDistance, formatDuration } from "../../../services/routingApi";
import { createRide, saveRoute } from "../../../services/rideApi";
import RideMap from "./RideMap";

const SUGGESTED = [
  "Marina Beach, Chennai",
  "Pondicherry",
  "Ooty",
  "Mahabalipuram",
  "Coorg",
  "Goa",
];

export default function RideSetup({ rideType, userId, onRideCreated, onCancel }) {
  const [fromText,   setFromText]   = useState("");
  const [destText,   setDestText]   = useState("");
  const [from,       setFrom]       = useState(null); // { lat, lng, name }
  const [destination, setDestination] = useState(null); // { lat, lng, name }
  const [route,      setRoute]      = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);

  // ---- Handle typing in From field ----
  const handleFromChange = (text) => {
    setFromText(text);
    setFromSuggestions(
      text.trim()
        ? SUGGESTED.filter((s) => s.toLowerCase().includes(text.toLowerCase()))
        : []
    );
  };

  // ---- Handle typing in Destination field ----
  const handleDestChange = (text) => {
    setDestText(text);
    setDestSuggestions(
      text.trim()
        ? SUGGESTED.filter((s) => s.toLowerCase().includes(text.toLowerCase()))
        : []
    );
  };

  const pickFrom = (place) => { setFromText(place); setFromSuggestions([]); };
  const pickDest = (place) => { setDestText(place); setDestSuggestions([]); };

  // ---- Resolve text → coordinates → route ----
  const calculateRoute = async () => {
    setError("");
    setRoute(null);
    if (!fromText.trim() || !destText.trim()) {
      setError("Please enter both From and Destination.");
      return;
    }
    setLoading(true);
    try {
      const fromCoords = await geocode(fromText);
      const toCoords   = await geocode(destText);
      if (!fromCoords) throw new Error(`Could not find "${fromText}"`);
      if (!toCoords)   throw new Error(`Could not find "${destText}"`);

      setFrom(fromCoords);
      setDestination(toCoords);

      const routeData = await getRoute(fromCoords, toCoords);
      if (!routeData) throw new Error("No route found between these locations.");
      setRoute(routeData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- Create the ride and start it ----
  const handleStart = async () => {
    if (!from || !destination || !route) {
      setError("Please calculate the route first.");
      return;
    }
    setLoading(true);
    try {
      const ride = await createRide({
        type:        rideType, // "solo" | "group"
        from,
        destination,
        creatorId:   userId,
        members:     [],
      });
      await saveRoute(ride.id, route);
      onRideCreated({ ...ride, route });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* ---- FROM input ---- */}
      <div className="relative">
        <label className="text-xs font-bold opacity-70 mb-1.5 block tracking-wide uppercase">
          From
        </label>
        <div className="relative">
          <i className="fa fa-location-dot absolute left-4 top-1/2 -translate-y-1/2 text-green-400 z-10" />
          <input
            value={fromText}
            onChange={(e) => handleFromChange(e.target.value)}
            placeholder="Starting location or place name"
            className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-white/15 bg-white/5 outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm"
          />
        </div>
        {fromSuggestions.length > 0 && (
          <div className="absolute top-full mt-1 w-full bg-zinc-900/95 backdrop-blur-sm border border-white/10 rounded-xl z-20 overflow-hidden shadow-xl">
            {fromSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => pickFrom(s)}
                className="w-full text-left px-4 py-2.5 hover:bg-white/10 text-sm border-b border-white/5 last:border-0 transition-colors"
              >
                <i className="fa fa-map-marker-alt mr-2 text-orange-400 text-xs" />{s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---- DESTINATION input ---- */}
      <div className="relative">
        <label className="text-xs font-bold opacity-70 mb-1.5 block tracking-wide uppercase">
          Destination
        </label>
        <div className="relative">
          <i className="fa fa-flag-checkered absolute left-4 top-1/2 -translate-y-1/2 text-red-400 z-10" />
          <input
            value={destText}
            onChange={(e) => handleDestChange(e.target.value)}
            placeholder="Search destination..."
            className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-white/15 bg-white/5 outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm"
          />
        </div>
        {destSuggestions.length > 0 && (
          <div className="absolute top-full mt-1 w-full bg-zinc-900/95 backdrop-blur-sm border border-white/10 rounded-xl z-20 overflow-hidden shadow-xl">
            {destSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => pickDest(s)}
                className="w-full text-left px-4 py-2.5 hover:bg-white/10 text-sm border-b border-white/5 last:border-0 transition-colors"
              >
                <i className="fa fa-map-marker-alt mr-2 text-red-400 text-xs" />{s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---- Ride type badge ---- */}
      <div className="flex items-center gap-2 text-xs opacity-60">
        <i className={`fa ${rideType === "solo" ? "fa-motorcycle" : "fa-users"} text-orange-400`} />
        <span className="capitalize font-semibold">{rideType} Ride</span>
      </div>

      {/* ---- Calculate button ---- */}
      {!route && (
        <button
          onClick={calculateRoute}
          disabled={loading || !fromText.trim() || !destText.trim()}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold disabled:opacity-50 hover:scale-[1.02] hover:shadow-lg hover:shadow-orange-500/25 active:scale-[0.98] transition-all"
        >
          {loading
            ? <><i className="fa fa-spinner fa-spin mr-2" />Calculating...</>
            : <><i className="fa fa-route mr-2" />Calculate Route</>
          }
        </button>
      )}

      {/* ---- Recalculate button (if route already shown) ---- */}
      {route && (
        <button
          onClick={calculateRoute}
          disabled={loading}
          className="w-full py-2 text-xs opacity-50 hover:opacity-80 transition-opacity"
        >
          <i className="fa fa-refresh mr-1" />Recalculate route
        </button>
      )}

      {/* ---- Error ---- */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2">
          <i className="fa fa-exclamation-circle mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ---- Map preview (after route calculated) ---- */}
      {route && (
        <>
          <RideMap
            ride={{ from, destination, route }}
            height="280px"
          />

          {/* Route summary cards */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-xl border border-white/10 bg-white/5">
              <p className="font-black text-lg text-orange-400">{formatDistance(route.distance)}</p>
              <p className="opacity-50 text-[10px] mt-0.5 uppercase tracking-wide">Distance</p>
            </div>
            <div className="p-3 rounded-xl border border-white/10 bg-white/5">
              <p className="font-black text-lg">{formatDuration(route.duration)}</p>
              <p className="opacity-50 text-[10px] mt-0.5 uppercase tracking-wide">Duration</p>
            </div>
            <div className="p-3 rounded-xl border border-white/10 bg-white/5">
              <p className="font-black text-lg capitalize">{rideType}</p>
              <p className="opacity-50 text-[10px] mt-0.5 uppercase tracking-wide">Type</p>
            </div>
          </div>

          {/* Start ride button */}
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white font-black text-base hover:scale-[1.02] hover:shadow-xl hover:shadow-orange-500/30 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading
              ? <><i className="fa fa-spinner fa-spin mr-2" />Starting...</>
              : <><i className="fa fa-motorcycle mr-2" />Start Ride!</>
            }
          </button>
        </>
      )}

      {/* Cancel */}
      <button
        onClick={onCancel}
        className="w-full py-2.5 text-sm opacity-50 hover:opacity-80 transition-opacity"
      >
        <i className="fa fa-times mr-1.5" />Cancel
      </button>
    </div>
  );
}
