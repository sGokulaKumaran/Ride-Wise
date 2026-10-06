// ============================================================
// AdminLiveMap — the whole fleet on one map (Live map tab)
//
//   every vehicle that has ever reported a position: live ones in blue
//   with their heading, parked ones in outline where they were last seen,
//   an emergency in pulsing red
//   a list beside the map (below it on a phone) — emergencies first
//   tap a vehicle → its driver, route and speed, a call button,
//   "End trip" for a trip its driver left running, "Clear" for an emergency
//
// /org-admin/:orgId/map?vehicle=<id> opens with that vehicle selected —
// this is where an SOS notification leads.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useDebounced, useFleetWatch, useLoad, useNow } from "../../hooks/useFleet";
import Icon from "../../components/ui/Icon";
import Button from "../../components/ui/Button";
import FleetMapView from "../../components/org/FleetMapView";
import { Badge, ConfirmButton, LiveDot, LoadError, Loading, Notice } from "../../components/org/kit";
import { VehicleRow } from "../../components/org/rows";
import {
  LIVE_STATE, applyPosition, crowdLevel, formatClockTime, isStale, kmh, liveState, stampVehicles, timeAgo,
  toMapVehicle, tripTitle,
} from "../../components/org/fleetUi";
import { parseRouteCoordinates } from "../../../services/navigation";
import { formatDistance } from "../../../services/routingApi";
import { forceEndTrip, getVehicleDetail, getVehicles, setTripSos } from "../../../services/orgApi";

const ORDER = { sos: 0, live: 1, stale: 2, starting: 3, idle: 4, off: 5 };

export default function AdminLiveMap({ orgId, tc }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const now = useNow(5000);
  const mapRef = useRef(null);

  const fleet = useLoad(`admin-fleet-${orgId}`, async () => stampVehicles(await getVehicles(orgId)));
  const reload = fleet.reload;
  const setFleet = fleet.setData;
  const reloadSoon = useDebounced(reload);

  const watch = useFleetWatch({ orgId }, {
    onEvent: (event) => {
      if (event.type === "position") {
        setFleet((list) => (list || []).map((vehicle) => (
          vehicle.id === event.vehicleId ? applyPosition(vehicle, event) : vehicle
        )));
      } else if (event.type !== "announcement") {
        reloadSoon();
      }
    },
    onSync: reload,
  });

  useEffect(() => {
    if (watch.status === "connected") return undefined;
    const timer = setInterval(reload, 15_000);
    return () => clearInterval(timer);
  }, [watch.status, reload]);

  // ── Selection (from the URL the first time, then by tapping) ──
  const linked = Number(searchParams.get("vehicle")) || null;
  const [picked, setPicked] = useState(undefined); // undefined = nothing tapped yet
  const selectedId = picked === undefined ? linked : picked;

  const vehicles = useMemo(() => {
    const list = (fleet.data || []).filter((vehicle) => vehicle.status !== "RETIRED");
    list.sort((a, b) => (
      ORDER[liveState(a, now)] - ORDER[liveState(b, now)] ||
      a.vehicleCode.localeCompare(b.vehicleCode, undefined, { numeric: true })
    ));
    return list;
  }, [fleet.data, now]);
  const mapVehicles = useMemo(
    () => vehicles.map((vehicle) => toMapVehicle(vehicle, now)).filter(Boolean),
    [vehicles, now],
  );
  const selected = vehicles.find((vehicle) => vehicle.id === selectedId) || null;
  const selectedSession = selected?.trip?.sessionId ?? null;

  // The planned road of the selected vehicle's trip.
  const road = useLoad(
    selected && selectedSession != null ? `admin-road-${selected.id}-${selectedSession}` : null,
    () => getVehicleDetail(orgId, selected.id),
  );
  const roadCoordinates = road.data?.route?.routeCoordinates ?? null;
  const roadStops = road.data?.route?.stops;
  const routeLine = useMemo(() => {
    const points = parseRouteCoordinates(roadCoordinates).map((point) => [point.lat, point.lng]);
    return points.length > 1 ? { passed: [], ahead: points } : null;
  }, [roadCoordinates]);
  const stops = useMemo(() => roadStops || [], [roadStops]);

  const select = (vehicleId) => {
    setPicked(vehicleId);
    const target = mapVehicles.find((vehicle) => vehicle.id === vehicleId);
    if (target) mapRef.current?.panTo(target.lat, target.lng);
  };

  const endTrip = async (vehicle) => {
    try {
      await forceEndTrip(vehicle.trip.sessionId);
      toast.success(`Trip on ${vehicle.vehicleCode} ended. ${vehicle.trip.driverName} has been told.`);
      reload();
    } catch (err) {
      toast.error(err.message || "Couldn't end the trip. Please try again.");
    }
  };

  const clearSos = async (vehicle) => {
    try {
      await setTripSos(vehicle.trip.sessionId, false);
      toast.info(`Emergency on ${vehicle.vehicleCode} cleared.`);
      reload();
    } catch (err) {
      toast.error(err.message || "Couldn't clear the emergency.");
    }
  };

  if (fleet.loading) return <Loading label="Loading the fleet…" tc={tc} />;
  if (!fleet.data) return <LoadError error={fleet.error} onRetry={reload} tc={tc} />;
  if (vehicles.length === 0) {
    return (
      <Notice icon="bus" title="No vehicles to show yet" tc={tc}
        action={<Button variant="primary" icon="plus" tc={tc} onClick={() => navigate(`/org-admin/${orgId}/vehicles`)}>Add a vehicle</Button>}>
        Add your vehicles first — each appears here as soon as a driver takes it out.
      </Notice>
    );
  }

  const onTrip = vehicles.filter((vehicle) => vehicle.trip).length;
  const emergencies = vehicles.filter((vehicle) => vehicle.trip?.sos).length;
  const unplaced = vehicles.length - mapVehicles.length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* ── Map ── */}
      <div>
        <div className={`relative h-[56vh] min-h-[320px] overflow-hidden rounded-xl border lg:h-[72vh] ${tc.divider}`}>
          <FleetMapView
            ref={mapRef}
            tc={tc}
            vehicles={mapVehicles}
            selectedId={selectedId}
            onSelect={select}
            route={selected && routeLine ? routeLine : null}
            stops={selected ? stops : undefined}
            fitKey={`admin-${orgId}`}
          />
          {mapVehicles.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-[1001] flex items-center justify-center p-6">
              <p className={`rounded-xl border px-4 py-3 text-center text-sm shadow-sm ${tc.card}`}>
                None of your vehicles has reported a position yet.
              </p>
            </div>
          )}
        </div>
        <p className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${tc.sub}`}>
          <span className="inline-flex items-center gap-1.5"><LiveDot tone={onTrip ? "ok" : "neutral"} pulse={onTrip > 0} />{onTrip} on a trip</span>
          {emergencies > 0 && <span className={`inline-flex items-center gap-1.5 font-semibold ${tc.danger}`}><Icon name="sos" size={13} />{emergencies} emergency</span>}
          {unplaced > 0 && <span>{unplaced} never seen yet</span>}
          {watch.status === "disconnected" && <span>· reconnecting, refreshing every 15 s</span>}
        </p>
      </div>

      {/* ── Selected vehicle + list ── */}
      <div className="min-w-0 space-y-3">
        {selected && (
          <SelectedPanel
            vehicle={selected}
            now={now}
            tc={tc}
            onTrack={() => navigate(`/organizations/${orgId}/track/${selected.id}`)}
            onEnd={() => endTrip(selected)}
            onClearSos={() => clearSos(selected)}
            onClose={() => setPicked(null)}
          />
        )}
        <div className="space-y-2 lg:max-h-[72vh] lg:overflow-y-auto lg:pr-1">
          {vehicles.map((vehicle) => (
            <div key={vehicle.id} className={vehicle.id === selectedId ? `rounded-xl ring-2 ring-[#FF7A1A]/60` : ""}>
              <VehicleRow vehicle={vehicle} now={now} tc={tc} onOpen={() => select(vehicle.id)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Everything about the selected vehicle, and what can be done ──
function SelectedPanel({ vehicle, now, tc, onTrack, onEnd, onClearSos, onClose }) {
  const trip = vehicle.trip;
  const state = liveState(vehicle, now);
  const info = LIVE_STATE[state];
  const crowd = trip ? crowdLevel(trip.crowdLevel) : null;
  const quiet = isStale(trip, now); // also true for an emergency that stopped reporting
  const speed = trip && !quiet && state !== "starting" ? kmh(trip.speed) : null;

  return (
    <section className={`rounded-xl border p-3.5 ${state === "sos" ? tc.dangerSoft : tc.card}`} aria-label={`${vehicle.vehicleCode} details`}>
      <div className="flex items-center gap-2">
        <p className={`min-w-0 flex-1 truncate text-base font-bold ${tc.text}`}>{vehicle.vehicleCode}</p>
        <Badge tone={info.tone} tc={tc}>{info.label}</Badge>
        <button type="button" onClick={onClose} aria-label="Close details" className={`flex h-7 w-7 items-center justify-center rounded-full ${tc.sub}`}>
          <Icon name="close" size={15} />
        </button>
      </div>

      {trip ? (
        <>
          {trip.sos && (
            <p className="mt-2 flex items-start gap-2 text-sm font-semibold">
              <Icon name="sos" size={16} className="mt-0.5" />
              Emergency{trip.sosMessage ? `: ${trip.sosMessage}` : " reported by the driver"}
            </p>
          )}
          <dl className={`mt-2 space-y-1.5 text-sm ${tc.text}`}>
            <Row icon="steering" label="Driver" tc={tc}>
              {trip.driverName}
              {trip.driverPhone && (
                <a href={`tel:${trip.driverPhone.replace(/[^\d+]/g, "")}`} className={`ml-2 inline-flex items-center gap-1 font-semibold ${tc.accent}`}>
                  <Icon name="phone" size={13} />{trip.driverPhone}
                </a>
              )}
            </Row>
            <Row icon="route" label="Trip" tc={tc}>{tripTitle(trip)}</Row>
            <Row icon="clock" label="Started" tc={tc}>
              {formatClockTime(trip.startedAt)}
              {trip.distanceMeters > 0 ? ` · ${formatDistance(trip.distanceMeters)} driven` : ""}
            </Row>
            <Row icon="gauge" label="Now" tc={tc}>
              {quiet ? `No signal — last seen ${timeAgo(trip.seenAt, now)}`
                : state === "starting" ? "Waiting for its first position"
                : speed != null ? (speed > 2 ? `${speed} km/h` : "Standing") : "—"}
              {crowd && <Badge tone={crowd.tone} icon="seat" tc={tc} className="ml-2">{crowd.label}</Badge>}
            </Row>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon="navigate" tc={tc} onClick={onTrack}>Follow</Button>
            {trip.sos && (
              <Button variant="secondary" size="sm" icon="check" tc={tc} onClick={onClearSos}>Clear emergency</Button>
            )}
            <ConfirmButton label="End trip" confirmLabel="End it" keepLabel="Leave running" icon="finish" tc={tc} onConfirm={onEnd} />
          </div>
        </>
      ) : (
        <>
          <p className={`mt-1.5 text-sm ${tc.sub}`}>
            {vehicle.status === "ACTIVE" ? "Not on a trip." : "Not in use right now."}
            {vehicle.lastLocationAt ? ` Shown where it was last seen (${timeAgo(Date.parse(vehicle.lastLocationAt), now)}).` : ""}
          </p>
          <div className="mt-3">
            <Button variant="secondary" size="sm" icon="navigate" tc={tc} onClick={onTrack}>Open</Button>
          </div>
        </>
      )}
    </section>
  );
}

function Row({ icon, label, tc, children }) {
  return (
    <div className="flex items-start gap-2">
      <Icon name={icon} size={14} className={`mt-1 ${tc.sub}`} />
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  );
}
