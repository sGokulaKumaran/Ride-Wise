// ============================================================
// RideStatsSheet.jsx — the bottom sheet of the ride map
//
// THREE STATES
//   live      time left · distance left · arrival time, a progress bar,
//             and the End / Leave action (two taps: ask, then confirm)
//   arrived   "You've arrived" with the action to finish the ride
//   summary   a finished ride being reviewed: what was ridden, and Close
//
// It only displays what it is given — no timers, no data fetching.
//
// PROPS
//   mode           "live" | "arrived" | "summary"
//   nav            navigation state (live / arrived)
//   ride           the ride object
//   tc             theme classes
//   action         "end" | "leave" | null — what this rider may do
//   confirming     true while the action is waiting for its second tap
//   busy           true while the action is being sent
//   onAction       first tap AND confirm tap of the action
//   onCancel       back out of the confirmation
//   onClose        close the map
//   onKeepRiding   dismiss the arrival state
//   riderCount     riders in a group ride (omit for solo)
// ============================================================

import Button from "../ui/Button";
import Icon from "../ui/Icon";
import {
  formatClock,
  formatDistance,
  formatDuration,
  hasTrackedDistance,
  rideTimeSeconds,
  shortPlaceName,
} from "../../../services/routingApi";

function Stat({ value, label, tc, strong = false }) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <p className={`truncate font-bold tabular-nums ${strong ? "text-2xl" : "text-lg"}`}>{value}</p>
      <p className={`mt-0.5 text-[11px] uppercase tracking-wider ${tc.sub}`}>{label}</p>
    </div>
  );
}

// "End ride" / "Leave ride" with a confirmation step.
function RideAction({ action, confirming, busy, onAction, onCancel, tc, emphasise = false, group = false }) {
  if (!action) return null;
  const isEnd = action === "end";
  const label = isEnd ? "End ride" : "Leave ride";

  if (confirming) {
    return (
      <div>
        <p className={`mb-2 text-center text-xs ${tc.sub}`}>
          {!isEnd
            ? "Leave this ride? The others keep riding."
            : group
              ? "End this ride for everyone? It will be saved to each rider's history."
              : "End this ride? It will be saved to your history."}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" full tc={tc} onClick={onCancel} disabled={busy}>
            Keep riding
          </Button>
          <Button variant="danger" size="lg" full tc={tc} icon={isEnd ? "finish" : "leave"} loading={busy} onClick={onAction}>
            {busy ? (isEnd ? "Ending…" : "Leaving…") : label}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant={emphasise ? "primary" : "danger"}
      size="lg"
      full
      tc={tc}
      icon={isEnd ? "finish" : "leave"}
      loading={busy}
      onClick={onAction}
    >
      {busy ? (isEnd ? "Ending…" : "Leaving…") : label}
    </Button>
  );
}

export default function RideStatsSheet({
  mode,
  nav,
  ride,
  tc,
  action = null,
  confirming = false,
  busy = false,
  onAction,
  onCancel,
  onClose,
  onKeepRiding,
  riderCount = null,
  ref,
}) {
  const destination = shortPlaceName(ride?.destinationName, "your destination");
  const percent = Math.round(Math.min(1, Math.max(0, nav?.fraction ?? 0)) * 100);

  return (
    <div
      ref={ref}
      className={`absolute inset-x-0 bottom-0 z-[1100] overflow-hidden rounded-t-xl border border-b-0 ${tc.card} ${tc.text}`}
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      {/* Route progress — how much of the ride is behind the rider */}
      {mode !== "summary" && (
        <div
          className={`h-1 w-full ${tc.surface2}`}
          role="progressbar"
          aria-label="Route completed"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div
            className="h-full rounded-r-full bg-[#2F6FED] transition-[width] duration-700 ease-linear"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <div className="mx-auto w-full max-w-xl px-4 pt-3">
        {/* ── LIVE ─────────────────────────────────────────── */}
        {mode === "live" && (
          <>
            <div className="flex items-start gap-2">
              <Stat strong tc={tc} label="Time left" value={formatDuration(nav.remainingTime)} />
              <span className={`mt-1 h-9 w-px shrink-0 ${tc.hairline}`} />
              <Stat strong tc={tc} label="Distance" value={formatDistance(nav.remainingDistance)} />
              <span className={`mt-1 h-9 w-px shrink-0 ${tc.hairline}`} />
              <Stat strong tc={tc} label="Arrival" value={formatClock(nav.eta)} />
            </div>

            <p className={`mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-xs ${tc.sub}`}>
              <span>Ridden {formatDistance(nav.traveled)}</span>
              {nav.currentRoad && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="max-w-[55vw] truncate">On {nav.currentRoad}</span>
                </>
              )}
              {riderCount != null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Icon name="riders" size={13} />
                    {riderCount} {riderCount === 1 ? "rider" : "riders"}
                  </span>
                </>
              )}
            </p>

            <div className="mt-3">
              <RideAction
                action={action}
                confirming={confirming}
                busy={busy}
                onAction={onAction}
                onCancel={onCancel}
                tc={tc}
                group={ride?.rideType === "group"}
              />
            </div>
          </>
        )}

        {/* ── ARRIVED ──────────────────────────────────────── */}
        {mode === "arrived" && (
          <>
            <div className="flex items-center gap-3">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${tc.okSoft}`}>
                <Icon name="finish" size={24} />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-tight">You&apos;ve arrived</p>
                {/* Distance first: a long place name may be cut off, the
                    figure the rider wants to see must not be. */}
                <p className={`truncate text-sm ${tc.sub}`}>
                  {formatDistance(nav.traveled)} ridden · {destination}
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <RideAction
                action={action}
                confirming={confirming}
                busy={busy}
                onAction={onAction}
                onCancel={onCancel}
                tc={tc}
                group={ride?.rideType === "group"}
                emphasise
              />
              {!confirming && (
                <Button variant="ghost" size="md" full tc={tc} onClick={onKeepRiding} disabled={busy}>
                  Keep riding
                </Button>
              )}
            </div>
          </>
        )}

        {/* ── SUMMARY (finished ride) ──────────────────────── */}
        {mode === "summary" && (
          <>
            <div className="flex items-start gap-2">
              <Stat
                tc={tc}
                label={hasTrackedDistance(ride) ? "Ridden" : "Route"}
                value={formatDistance(hasTrackedDistance(ride) ? ride.actualDistanceMeters : ride?.distanceMeters)}
              />
              <span className={`mt-1 h-8 w-px shrink-0 ${tc.hairline}`} />
              <Stat tc={tc} label="Ride time" value={formatDuration(rideTimeSeconds(ride))} />
              <span className={`mt-1 h-8 w-px shrink-0 ${tc.hairline}`} />
              <Stat tc={tc} label="Date" value={rideDate(ride)} />
            </div>
            <div className="mt-3">
              <Button variant="secondary" size="lg" full tc={tc} icon="close" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function rideDate(ride) {
  const date = new Date(ride?.createdAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}
