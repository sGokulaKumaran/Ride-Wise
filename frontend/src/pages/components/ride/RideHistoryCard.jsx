// ============================================================
// 🛣️ RideHistoryCard — Single ride in the history list
//
// Shows: from → destination, distance, duration, type, status
// On click: expands to show the saved route on the map
// ============================================================

import { useState } from "react";
import RideMap from "./RideMap";
import { formatDistance, formatDuration } from "../../../services/routingApi";

const STATUS_COLORS = {
  planned:   "bg-blue-500/20 text-blue-400 border-blue-500/20",
  active:    "bg-green-500/20 text-green-400 border-green-500/20",
  completed: "bg-zinc-500/20 text-zinc-400 border-zinc-500/20",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/20",
};

const TYPE_ICON = {
  solo:  "fa-motorcycle",
  group: "fa-users",
};

export default function RideHistoryCard({ ride }) {
  const [open, setOpen] = useState(false);

  const dateStr = ride.createdAt
    ? new Date(ride.createdAt).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      })
    : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden transition-all hover:border-white/20">
      {/* Header — click to expand */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 flex items-start justify-between hover:bg-white/5 transition-all text-left gap-3"
      >
        {/* Left: from→to + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <i className={`fa ${TYPE_ICON[ride.type] || "fa-motorcycle"} text-orange-400 text-xs`} />
            <p className="font-bold text-sm truncate">
              {(ride.from?.name || "Unknown").split(",")[0]}
              <span className="mx-1.5 opacity-40">→</span>
              {(ride.destination?.name || "Unknown").split(",")[0]}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs opacity-50">
            {ride.route && (
              <>
                <span>{formatDistance(ride.route.distance)}</span>
                <span>·</span>
                <span>{formatDuration(ride.route.duration)}</span>
                <span>·</span>
              </>
            )}
            {dateStr && <span>{dateStr}</span>}
          </div>
        </div>

        {/* Right: status badge + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[ride.status] || STATUS_COLORS.planned}`}>
            {ride.status}
          </span>
          <i className={`fa fa-chevron-${open ? "up" : "down"} text-xs opacity-40`} />
        </div>
      </button>

      {/* Expanded: map + details */}
      {open && (
        <div className="border-t border-white/10">
          {ride.route ? (
            <div className="p-4 space-y-3">
              <RideMap ride={ride} height="220px" />
              {/* Full from/to names */}
              <div className="text-xs opacity-50 space-y-0.5">
                <p><span className="text-green-400 font-bold">From:</span> {ride.from?.name}</p>
                <p><span className="text-red-400 font-bold">To:</span> {ride.destination?.name}</p>
              </div>
            </div>
          ) : (
            <p className="p-4 text-sm opacity-40 text-center">No route data saved for this ride.</p>
          )}
        </div>
      )}
    </div>
  );
}
