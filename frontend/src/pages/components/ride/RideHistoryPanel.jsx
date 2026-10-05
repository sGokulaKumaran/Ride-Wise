// ============================================================
// RideHistoryPanel.jsx — every ride, in a side panel
//
// Per ride:
//   • start → destination, distance, time, date, status
//   • "Open map" (live ride) / "View route" (finished ride)
//   • a small route preview that expands in place
//   • delete — two taps, and only for rides this rider owns
//     (the server refuses to delete someone else's group ride)
//
// The filter chips narrow the list; they appear once there is more than
// a handful of rides.
//
// PROPS
//   rides          lightweight ride rows (no route geometry)
//   currentUserId  the logged-in rider (decides who may delete)
//   onOpenRide     (ride) → open the full-screen map
//   onDeleteRide   async (rideId) → delete and refresh
//   onClose        close the panel
//   tc             theme classes
// ============================================================

import { useEffect, useState } from "react";
import RideMap from "./RideMap";
import Icon from "../ui/Icon";
import Button, { Chip, IconButton } from "../ui/Button";
import { getRide } from "../../../services/rideApi";
import {
  formatDistance,
  formatDuration,
  hasTrackedDistance,
  rideTimeSeconds,
  shortPlaceName,
} from "../../../services/routingApi";

const FILTERS = [
  { id: "all",       label: "All",       test: () => true },
  { id: "active",    label: "Active",    test: (ride) => ride.status === "active" },
  { id: "completed", label: "Completed", test: (ride) => ride.status === "completed" },
  { id: "group",     label: "Group",     test: (ride) => ride.rideType === "group" },
];

export default function RideHistoryPanel({ rides, currentUserId, onOpenRide, onDeleteRide, onClose, tc }) {
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);   // ride whose preview map is open
  const [details, setDetails] = useState({});           // rideId → ride with its route
  const [confirmId, setConfirmId] = useState(null);     // ride waiting for delete confirmation
  const [deletingId, setDeletingId] = useState(null);

  // Escape closes the panel
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visible = rides.filter(FILTERS.find((f) => f.id === filter).test);

  // Open/close a preview. The list rows carry no geometry, so the route is
  // fetched the first time a preview is opened.
  const togglePreview = async (ride) => {
    const id = String(ride.id);
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (ride.routeCoordinates || details[id]) return;
    try {
      const full = await getRide(ride.id);
      if (full) setDetails((previous) => ({ ...previous, [id]: full }));
    } catch {
      // The preview then shows the two endpoints only.
    }
  };

  // First tap asks, second tap deletes.
  const handleDelete = async (ride) => {
    const id = String(ride.id);
    if (confirmId !== id) { setConfirmId(id); return; }
    setDeletingId(id);
    await onDeleteRide(ride.id);
    setDeletingId(null);
    setConfirmId(null);
  };

  return (
    <div
      className={`fixed inset-0 z-[7000] flex justify-end ${tc.overlay}`}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <aside
        role="dialog"
        aria-label="Ride history"
        className={`flex h-full w-full max-w-[480px] flex-col border-l ${tc.card} ${tc.text}`}
        style={{ animation: "rw-panel-in 0.28s cubic-bezier(0.32,0.72,0,1)" }}
      >
        {/* Header */}
        <div className={`flex shrink-0 items-center gap-3 border-b px-4 py-4 ${tc.divider}`}>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
            <Icon name="history" size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold">Ride history</p>
            <p className={`text-xs ${tc.sub}`}>
              {rides.length} {rides.length === 1 ? "ride" : "rides"}
            </p>
          </div>
          <IconButton icon="close" label="Close ride history" size="sm" tc={tc} onClick={onClose} />
        </div>

        {/* Filters */}
        {rides.length > 4 && (
          <div className={`scrollbar-hide flex shrink-0 gap-2 overflow-x-auto border-b px-4 py-2.5 ${tc.divider}`}>
            {FILTERS.map((option) => (
              <Chip
                key={option.id}
                selected={filter === option.id}
                onClick={() => setFilter(option.id)}
                tc={tc}
                className="shrink-0"
              >
                {option.label}
              </Chip>
            ))}
          </div>
        )}

        {/* List */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {visible.length === 0 && (
            <div className="py-16 text-center">
              <Icon name="route" size={32} className={`mx-auto mb-3 ${tc.sub}`} />
              <p className="text-sm font-semibold">
                {rides.length === 0 ? "No rides yet" : "No rides match this filter"}
              </p>
              <p className={`mt-1 text-xs ${tc.sub}`}>
                {rides.length === 0
                  ? "Start your first ride and it will appear here."
                  : "Choose another filter to see more."}
              </p>
            </div>
          )}

          {visible.map((ride) => {
            const id = String(ride.id);
            const active = ride.status === "active";
            const expanded = expandedId === id;
            const confirming = confirmId === id;
            const mine = String(ride.userId) === String(currentUserId);
            const canPreview = Boolean(ride.routeCoordinates || ride.hasRoute);
            const date = ride.createdAt
              ? new Date(ride.createdAt).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })
              : "";
            const statusTone = active ? tc.okSoft : ride.status === "cancelled" ? tc.dangerSoft : `${tc.surface2} ${tc.sub} ${tc.divider}`;

            return (
              <article key={ride.id} className={`overflow-hidden rounded-xl border ${tc.divider}`}>
                <div className="p-3.5">
                  {/* Start → destination */}
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center pt-1.5" aria-hidden="true">
                      <span className="h-2.5 w-2.5 rounded-full border-2 border-current" />
                      <span className={`my-0.5 h-5 w-px ${tc.hairline}`} />
                      <span className="h-2.5 w-2.5 rounded-full bg-current" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{shortPlaceName(ride.fromName, "Start")}</p>
                      <p className="mt-2 truncate text-sm font-semibold">
                        {shortPlaceName(ride.destinationName, "Destination")}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${statusTone}`}>
                      {active ? "Live" : ride.status}
                    </span>
                  </div>

                  {/* Numbers */}
                  <p className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${tc.sub}`}>
                    {hasTrackedDistance(ride) && (ride.actualDistanceMeters > 0 || !active) && (
                      <span className="inline-flex items-center gap-1" title="Distance actually ridden">
                        <Icon name="navigate" size={13} />
                        {formatDistance(ride.actualDistanceMeters)} ridden
                      </span>
                    )}
                    {ride.distanceMeters > 0 && (
                      <span className="inline-flex items-center gap-1" title="Planned route length">
                        <Icon name="route" size={13} />
                        {formatDistance(ride.distanceMeters)}
                      </span>
                    )}
                    {rideTimeSeconds(ride) > 0 && (
                      <span
                        className="inline-flex items-center gap-1"
                        title={active ? "Planned ride time" : "Time from start to finish"}
                      >
                        <Icon name="clock" size={13} />
                        {formatDuration(rideTimeSeconds(ride))}
                      </span>
                    )}
                    {ride.rideType === "group" && (
                      <span className="inline-flex items-center gap-1">
                        <Icon name="riders" size={13} />
                        Group
                      </span>
                    )}
                    {date && <span>{date}</span>}
                  </p>

                  {/* Actions */}
                  {confirming ? (
                    <div className="mt-3">
                      <p className={`mb-2 text-xs ${tc.sub}`}>
                        Delete this ride for good? This can&apos;t be undone.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" full tc={tc} onClick={() => setConfirmId(null)} disabled={deletingId === id}>
                          Keep
                        </Button>
                        <Button variant="danger" size="sm" full icon="trash" tc={tc} loading={deletingId === id} onClick={() => handleDelete(ride)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant={active ? "accent" : "soft"}
                        size="sm"
                        full
                        icon={active ? "navigate" : "map"}
                        tc={tc}
                        onClick={() => onOpenRide(ride)}
                      >
                        {active ? "Open map" : "View route"}
                      </Button>
                      {canPreview && (
                        <Button
                          variant={expanded ? "soft" : "ghost"}
                          size="sm"
                          icon={expanded ? "chevronUp" : "chevronDown"}
                          iconOnly
                          tc={tc}
                          title={expanded ? "Hide preview" : "Preview route"}
                          onClick={() => togglePreview(ride)}
                        />
                      )}
                      {mine && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="trash"
                          iconOnly
                          tc={tc}
                          title="Delete ride"
                          onClick={() => handleDelete(ride)}
                        />
                      )}
                    </div>
                  )}
                </div>

                {expanded && (
                  <div className={`relative h-[200px] border-t ${tc.divider}`}>
                    <RideMap ride={details[id] || ride} compact tc={tc} />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </aside>

      <style>{`
        @keyframes rw-panel-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}
