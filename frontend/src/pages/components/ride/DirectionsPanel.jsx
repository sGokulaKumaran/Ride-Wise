// ============================================================
// DirectionsPanel.jsx — the full list of turns
//
// A bottom sheet with every step of the route. It follows the rider:
//   • steps already ridden are ticked and dimmed
//   • the NEXT step is highlighted with the live distance to it
//   • the list scrolls to keep that step in view
//
// PROPS
//   steps           route steps (each with an instruction and distance)
//   activeIndex     index of the next step; -1 for a finished ride
//   activeDistance  metres to that step (live), or null
//   offRoute        true while the rider is off the route
//   joining         …and has not been on it yet (the ride starts off the road)
//   summary         one line under the title ("12 km · 25 min left")
//   destName        destination name for the title
//   onClose         close the sheet
//   tc              theme classes
// ============================================================

import { useEffect, useRef } from "react";
import Icon from "../ui/Icon";
import { IconButton } from "../ui/Button";
import {
  formatDistance,
  formatManeuverDistance,
  stepIconName,
} from "../../../services/routingApi";

export default function DirectionsPanel({
  steps = [],
  activeIndex = -1,
  activeDistance = null,
  offRoute = false,
  joining = false,
  summary = "",
  destName = "Destination",
  onClose,
  tc,
}) {
  const activeRef = useRef(null);

  // Keep the next step in view as the rider advances
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeIndex]);

  // Escape closes the sheet
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-[1200] flex flex-col justify-end ${tc.overlay}`}
      onClick={(event) => { if (event.target === event.currentTarget) onClose?.(); }}
    >
      <div
        role="dialog"
        aria-label="Directions"
        className={`mx-auto flex max-h-[76vh] w-full max-w-xl flex-col rounded-t-xl border border-b-0 ${tc.card} ${tc.text}`}
        style={{ animation: "rw-sheet-up 0.28s cubic-bezier(0.32,0.72,0,1) both" }}
      >
        {/* Header */}
        <div className={`flex shrink-0 items-center gap-3 border-b px-4 py-3.5 ${tc.divider}`}>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
            <Icon name="route" size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">Directions to {destName}</p>
            <p className={`truncate text-xs ${tc.sub}`}>
              {summary || `${steps.length} ${steps.length === 1 ? "step" : "steps"}`}
            </p>
          </div>
          <IconButton icon="close" label="Close directions" size="sm" tc={tc} onClick={onClose} />
        </div>

        {offRoute && (
          <p className={`mx-4 mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${tc.rejoinSoft}`}>
            <Icon name="maneuverMerge" size={15} className="mt-px" />
            {joining
              ? "You're not on the route yet. Follow the purple line on the map — these steps start where you join it."
              : "You're off the route. Follow the purple line on the map — these steps continue from where you rejoin."}
          </p>
        )}

        {/* Steps */}
        <ol className="flex-1 overflow-y-auto px-2 py-2">
          {steps.map((step, index) => {
            const active = index === activeIndex;
            const passed = activeIndex >= 0 && index < activeIndex;
            return (
              <li
                key={index}
                ref={active ? activeRef : null}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-3 rounded-lg px-2.5 py-2.5 ${
                  active ? `border ${tc.accentSoft}` : "border border-transparent"
                } ${passed ? "opacity-50" : ""}`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    active ? tc.inkTile : tc.surface2
                  }`}
                >
                  <Icon name={passed ? "check" : stepIconName(step)} size={18} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className={`block text-sm leading-snug ${active ? "font-semibold" : "font-medium"} ${active ? tc.text : ""}`}>
                    {step.instruction}
                  </span>
                  {active && activeDistance != null && !offRoute && (
                    <span className="mt-0.5 block text-xs font-semibold">
                      {activeDistance <= 15 ? "Now" : `In ${formatManeuverDistance(activeDistance)}`}
                    </span>
                  )}
                </span>

                {step.distance > 0 && (
                  <span className={`shrink-0 text-xs tabular-nums ${active ? "" : tc.sub}`}>
                    {formatDistance(step.distance)}
                  </span>
                )}
              </li>
            );
          })}

          {steps.length === 0 && (
            <li className={`px-3 py-8 text-center text-sm ${tc.sub}`}>
              Turn-by-turn directions aren&apos;t stored for this ride.
            </li>
          )}
        </ol>
      </div>

      <style>{`
        @keyframes rw-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}
