// ============================================================
// 🎛️ RideControls — Buttons shown during an active ride
//
// Buttons:
//   - Close Map    → hides the map (ride stays active)
//   - End Ride     → completes the ride and saves it to history
//
// Role-aware:
//   - Only Creator sees "End Ride"
// ============================================================

import { useAuth } from "../../../context/AuthContext";
import { canDelete, updateRideStatus } from "../../../services/rideApi";
import { formatDistance, formatDuration } from "../../../services/routingApi";

export default function RideControls({ ride, onCloseMap, onRideEnded }) {
  const { user }   = useAuth();
  const canEndRide = canDelete(ride, user?.id); // Only creator can end

  const handleEnd = async () => {
    if (!window.confirm("End this ride? It will be saved to your history.")) return;
    const updated = await updateRideStatus(ride.id, "completed");
    onRideEnded(updated);
  };

  return (
    <div className="mt-4 space-y-3">
      {/* Route summary strip */}
      {ride.route && (
        <div className="flex items-center justify-around py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-center text-sm">
          <div>
            <span className="font-black text-orange-400">{formatDistance(ride.route.distance)}</span>
            <p className="text-[10px] opacity-50 mt-0.5 uppercase tracking-wide">Distance</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div>
            <span className="font-black">{formatDuration(ride.route.duration)}</span>
            <p className="text-[10px] opacity-50 mt-0.5 uppercase tracking-wide">Duration</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              ride.status === "active"
                ? "bg-green-500/20 text-green-400"
                : "bg-blue-500/20 text-blue-400"
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              {ride.status}
            </span>
            <p className="text-[10px] opacity-50 mt-0.5 uppercase tracking-wide">Status</p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {/* Close Map — hides map but keeps ride active */}
        <button
          onClick={onCloseMap}
          className="flex-1 py-3 rounded-xl border border-/15 bg-white/5 hover:bg-white/10 font-bold transition-all text-sm"
        >
          <i className="fa fa-eye-slash mr-2" />Hide Map
        </button>

        {/* End Ride — only visible to creator */}
        {canEndRide && (
          <button
            onClick={handleEnd}
            className="flex-1 py-3 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 font-bold transition-all text-sm"
          >
            <i className="fa fa-flag-checkered mr-2" />End Ride
          </button>
        )}
      </div>
    </div>
  );
}
