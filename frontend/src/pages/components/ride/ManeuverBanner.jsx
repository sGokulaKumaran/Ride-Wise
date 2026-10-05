// ============================================================
// ManeuverBanner.jsx — "what do I do next?" at the top of the map
//
// One card, three parts, read left to right:
//   [ turn icon ]  distance to the turn (big, counts down)
//                  the instruction
//                  "Then …" when another turn follows right after
//
// Everything shown comes from the navigation state (`nav`), so the card
// changes by itself as the rider moves: the distance shrinks, the next
// turn takes over once this one is passed, and when the rider is off
// the route the card switches to the way back (purple, like the line).
//
// PROPS
//   nav          navigation state from useNavigation()
//   destination  short destination name
//   tc           theme classes
//   onMinimize   shrink the map to a floating pill
//   onClose      close the map (the ride stays active)
// ============================================================

import Icon from "../ui/Icon";
import { IconButton } from "../ui/Button";
import { formatManeuverDistance, stepIconName } from "../../../services/routingApi";

export default function ManeuverBanner({ nav, destination, tc, onMinimize, onClose }) {
  const step = nav.step;
  const offRoute = nav.status === "off-route";

  let icon = stepIconName(step);
  let headline = "";      // the big line: distance to the maneuver
  let instruction;
  let then = nav.then;

  if (nav.status === "locating") {
    icon = "recenter";
    instruction = "Finding your location…";
    then = null;
  } else if (nav.status === "arrived") {
    icon = "maneuverArrive";
    headline = "Arrived";
    instruction = destination;
    then = null;
  } else if (step) {
    instruction = step.instruction;
    if (nav.stepDistance != null && step.maneuverType !== "depart") {
      headline = nav.stepDistance <= 15 ? "Now" : formatManeuverDistance(nav.stepDistance);
    }
  } else {
    // A ride without stored turn-by-turn steps
    icon = "navigate";
    instruction = `Ride to ${destination}`;
    if (nav.remainingDistance != null) headline = formatManeuverDistance(nav.remainingDistance);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex items-stretch gap-3 rounded-xl border p-3 shadow-sm ${tc.card} ${tc.text}`}
    >
      {/* Turn icon — ink tile normally, purple-tinted while rejoining */}
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center self-center rounded-lg ${
          offRoute ? `border ${tc.rejoinSoft}` : tc.inkTile
        }`}
      >
        <Icon name={icon} size={30} strokeWidth={1.9} />
      </div>

      <div className="min-w-0 flex-1 self-center">
        {headline && (
          <p className="text-2xl font-bold leading-none tabular-nums">{headline}</p>
        )}
        <p className={`line-clamp-2 text-[15px] font-semibold leading-snug ${headline ? "mt-1" : ""}`}>
          {instruction}
        </p>
        {then && (
          <p className={`mt-1 flex items-center gap-1.5 text-xs ${tc.sub}`}>
            <span className="shrink-0">Then</span>
            <Icon name={stepIconName(then)} size={14} />
            <span className="truncate">{then.instruction}</span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col justify-between">
        <IconButton icon="close" label="Close map (ride stays active)" size="sm" tc={tc} onClick={onClose} />
        <IconButton icon="minimize" label="Minimize map" size="sm" tc={tc} onClick={onMinimize} />
      </div>
    </div>
  );
}
