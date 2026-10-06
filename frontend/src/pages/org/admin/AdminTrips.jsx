// ============================================================
// AdminTrips — every trip of the organization (Trips tab)
//
//   newest first, filtered by state, vehicle or driver
//   tap a trip → the path it really took, replayed on a map
//   a trip still running can be ended from here
//   Export → a spreadsheet (CSV) of what the filters show
//
// The numbers of a trip — distance, top speed, how often the speed limit
// was passed — were measured by the server from the vehicle's positions,
// not reported by the driver's phone.
// ============================================================

import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useLoad } from "../../hooks/useFleet";
import Icon from "../../components/ui/Icon";
import Button, { Chip } from "../../components/ui/Button";
import TripReplay from "../../components/org/TripReplay";
import { Badge, ConfirmButton, LiveDot, LoadError, Loading, Notice, SelectInput } from "../../components/org/kit";
import { END_REASON, downloadCsv, formatDateTime, parseTime, tripSeconds, tripTitle } from "../../components/org/fleetUi";
import { formatDistance, formatDuration } from "../../../services/routingApi";
import { forceEndTrip, getMembers, getOrgTrips, getVehicles } from "../../../services/orgApi";

const PAGE_SIZE = 20;
const EXPORT_LIMIT = 2000;

const STATES = [
  { id: "", label: "All" },
  { id: "ACTIVE", label: "Running" },
  { id: "COMPLETED", label: "Completed" },
  { id: "CANCELLED", label: "No position" },
];

export default function AdminTrips({ org, orgId, tc }) {
  const [status, setStatus] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [page, setPage] = useState(0);
  const [replayId, setReplayId] = useState(null);
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(() => ({ status, vehicleId, driverId }), [status, vehicleId, driverId]);
  const trips = useLoad(
    `admin-trips-${orgId}-${status}-${vehicleId}-${driverId}-${page}`,
    () => getOrgTrips(orgId, { ...filters, page, size: PAGE_SIZE }),
  );
  const vehicles = useLoad(`admin-trips-vehicles-${orgId}`, () => getVehicles(orgId));
  const members = useLoad(`admin-trips-members-${orgId}`, () => getMembers(orgId));

  const change = (setter) => (value) => { setter(value); setPage(0); };

  const vehicleOptions = useMemo(() => [
    { id: "", label: "Every vehicle" },
    ...(vehicles.data || []).map((vehicle) => ({ id: String(vehicle.id), label: vehicle.vehicleCode })),
  ], [vehicles.data]);
  const driverOptions = useMemo(() => [
    { id: "", label: "Every driver" },
    ...(members.data || [])
      .filter((member) => member.status !== "PENDING" && member.role !== "VIEWER")
      .map((member) => ({ id: String(member.userId), label: `@${member.username}` })),
  ], [members.data]);

  const endTrip = async (trip) => {
    try {
      await forceEndTrip(trip.id);
      toast.success(`Trip on ${trip.vehicleCode} ended. ${trip.driverName} has been told.`);
      trips.reload();
    } catch (err) {
      toast.error(err.message || "Couldn't end the trip.");
    }
  };

  // Everything the filters match (up to a sensible limit), as a spreadsheet.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = [];
      for (let at = 0; rows.length < EXPORT_LIMIT; at++) {
        const batch = await getOrgTrips(orgId, { ...filters, page: at, size: 100 });
        rows.push(...batch.items);
        if (at + 1 >= batch.totalPages) break;
      }
      const minutes = (trip) => {
        const seconds = tripSeconds(trip);
        return seconds == null ? "" : Math.round(seconds / 60);
      };
      const local = (iso) => {
        const ms = parseTime(iso);
        return ms == null ? "" : new Date(ms).toLocaleString();
      };
      downloadCsv(
        `${org.card.name.replace(/[^\w-]+/g, "_")}_trips_${new Date().toISOString().slice(0, 10)}.csv`,
        ["Trip", "Vehicle", "Driver", "Route / destination", "Started", "Ended", "Minutes", "Distance (km)",
          "Top speed (km/h)", "Times over limit", "State", "Ended by"],
        rows.slice(0, EXPORT_LIMIT).map((trip) => [
          trip.id, trip.vehicleCode, trip.driverName, trip.routeName || trip.destinationName || "",
          local(trip.startedAt), local(trip.endedAt), minutes(trip),
          trip.distanceMeters != null ? (trip.distanceMeters / 1000).toFixed(2) : "",
          trip.maxSpeedKmh ? Math.round(trip.maxSpeedKmh) : "",
          trip.overspeedCount ?? 0,
          trip.status === "ACTIVE" ? "Running" : trip.status === "CANCELLED" ? "No position" : "Completed",
          trip.endReason ? (END_REASON[trip.endReason] || trip.endReason) : "",
        ]),
      );
      toast.success(`${Math.min(rows.length, EXPORT_LIMIT)} trips exported.`);
    } catch (err) {
      toast.error(err.message || "Couldn't export the trips.");
    } finally {
      setExporting(false);
    }
  };

  const data = trips.data;

  return (
    <div>
      {/* ── Filters ── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="scrollbar-hide flex gap-1.5 overflow-x-auto" role="radiogroup" aria-label="Trip state">
          {STATES.map((state) => (
            <Chip key={state.id || "all"} selected={status === state.id} tc={tc} className="shrink-0"
              onClick={() => change(setStatus)(state.id)}>
              {state.label}
            </Chip>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-2">
          <SelectInput tc={tc} aria-label="Vehicle" className="!h-9 !w-auto min-w-[9rem] text-xs" options={vehicleOptions}
            value={vehicleId} onChange={(event) => change(setVehicleId)(event.target.value)} />
          <SelectInput tc={tc} aria-label="Driver" className="!h-9 !w-auto min-w-[9rem] text-xs" options={driverOptions}
            value={driverId} onChange={(event) => change(setDriverId)(event.target.value)} />
          <Button variant="secondary" size="sm" icon="download" tc={tc} loading={exporting}
            disabled={!data || data.total === 0} onClick={exportCsv}>
            Export
          </Button>
        </div>
      </div>

      {trips.loading ? (
        <Loading label="Loading the trips…" tc={tc} />
      ) : !data ? (
        <LoadError error={trips.error} onRetry={trips.reload} tc={tc} />
      ) : data.total === 0 ? (
        <Notice icon="history" title={status || vehicleId || driverId ? "No trips match these filters" : "No trips yet"} tc={tc}>
          {status || vehicleId || driverId
            ? "Try another state, vehicle or driver."
            : "Each trip your drivers make is listed here, with the path it took and what was measured."}
        </Notice>
      ) : (
        <>
          <p className={`mb-2 text-xs ${tc.sub}`}>{data.total} trip{data.total === 1 ? "" : "s"}</p>
          <div className="space-y-2">
            {data.items.map((trip) => (
              <TripCard key={trip.id} trip={trip} tc={tc}
                onOpen={() => setReplayId(trip.id)} onEnd={() => endTrip(trip)} />
            ))}
          </div>
          {data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <Button variant="ghost" size="sm" icon="chevronLeft" tc={tc} disabled={page === 0} onClick={() => setPage(page - 1)}>
                Newer
              </Button>
              <span className={`text-xs tabular-nums ${tc.sub}`}>Page {page + 1} of {data.totalPages}</span>
              <Button variant="ghost" size="sm" icon="chevronRight" iconRight tc={tc}
                disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>
                Older
              </Button>
            </div>
          )}
        </>
      )}

      {replayId != null && <TripReplay sessionId={replayId} tc={tc} onClose={() => setReplayId(null)} />}
    </div>
  );
}

function TripCard({ trip, tc, onOpen, onEnd }) {
  const running = trip.status === "ACTIVE";
  const seconds = tripSeconds(trip);
  const figures = [
    trip.distanceMeters > 0 ? formatDistance(trip.distanceMeters) : null,
    seconds != null && seconds > 0 ? formatDuration(seconds) : null,
    trip.maxSpeedKmh > 0 ? `top ${Math.round(trip.maxSpeedKmh)} km/h` : null,
  ].filter(Boolean);

  return (
    <div className={`flex items-center gap-2 rounded-xl border pr-3 ${tc.card}`}>
      <button
        type="button"
        onClick={onOpen}
        className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl p-3.5 text-left transition-colors ${tc.cardHover}`}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
          running ? tc.okSoft : `${tc.surface2} ${tc.divider}`}`}>
          <Icon name="route" size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-semibold">{trip.vehicleCode} · {tripTitle(trip)}</span>
            {running && <Badge tone="ok" tc={tc}><LiveDot />Running</Badge>}
            {trip.status === "CANCELLED" && <Badge tone="warn" tc={tc}>No position</Badge>}
            {trip.overspeedCount > 0 && (
              <Badge tone="danger" icon="gauge" tc={tc} title="Times the organization's speed limit was passed">
                {trip.overspeedCount}× over limit
              </Badge>
            )}
            {trip.endReason && trip.endReason !== "DRIVER" && (
              <Badge tone="warn" tc={tc} title={END_REASON[trip.endReason]}>
                {trip.endReason === "TIMEOUT" ? "Auto-ended" : trip.endReason === "ADMIN" ? "Ended by admin" : "Ended"}
              </Badge>
            )}
          </span>
          <span className={`mt-0.5 block truncate text-xs ${tc.sub}`}>
            {trip.driverName} · {formatDateTime(trip.startedAt)}{figures.length ? ` · ${figures.join(" · ")}` : ""}
          </span>
        </span>
      </button>
      {running ? (
        <ConfirmButton label="End" confirmLabel="End trip" keepLabel="Leave" tc={tc} onConfirm={onEnd} />
      ) : (
        <Icon name="chevronRight" size={16} className={`shrink-0 ${tc.sub}`} />
      )}
    </div>
  );
}
