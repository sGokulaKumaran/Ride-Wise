// ============================================================
// TrackVehicle — follow one vehicle, live
// Route: /organizations/:orgId/track/:vehicleId (protected)
//
// A full-screen map with the vehicle on it, and one sheet that answers
// the three things somebody waiting for a bus wants to know:
//   where is it?    the marker, gliding as positions arrive
//   when is it here? time and distance left, arrival time, each stop
//   will there be room? what the driver reported
//
// HOW IT STAYS LIVE
//   • positions come over the fleet socket (and by re-reading every 10 s
//     whenever the socket is down)
//   • the VEHICLE is watched, not a trip: when its trip ends and a new one
//     starts — tomorrow morning, say — this screen goes live again by itself
//   • the vehicle's fixes are run through the same navigation engine a
//     rider's own position goes through (services/navigation.js). That is
//     where "12 min · 4.3 km left" and the grey/blue split of the route
//     come from — computed here from the planned road, so following a bus
//     costs the server nothing per watcher.
//
// HONEST ABOUT WHAT IT KNOWS
//   No position for 45 seconds → the marker turns grey and the sheet says
//   "No signal — last seen …". The last known place is still shown; an
//   arrival time that can no longer be trusted is not.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../hooks/useTheme";
import { useDebounced, useFleetWatch, useLoad, useNow } from "../hooks/useFleet";
import { useNavigation } from "../hooks/useNavigation";
import Icon from "../components/ui/Icon";
import Button, { Chip, IconButton } from "../components/ui/Button";
import FleetMapView from "../components/org/FleetMapView";
import { Badge, ErrorNote, Figure, LiveDot, Loading, MapChip, Modal, Notice } from "../components/org/kit";
import {
  LIVE_STATE, applyPosition, crowdLevel, formatClockTime, isStale, kmh, liveState, parseTime, stampVehicle,
  timeAgo, toMapVehicle, tripTitle, vehicleStatus, vehicleType,
} from "../components/org/fleetUi";
import { projectOnRoute, remainingDuration, routeLatLngs, sliceRoute } from "../../services/navigation";
import {
  formatClock, formatDistance, formatDuration, haversineDistance, shortPlaceName,
} from "../../services/routingApi";
import { getCurrentLocation } from "../../services/locationService";
import { getVehicleDetail, removeVehicleAlert, saveVehicleAlert } from "../../services/orgApi";

const RADII = [300, 500, 1000, 2000];
const PASSED_STOP_M = 40; // a stop counts as passed this far beyond it

export default function TrackVehicle() {
  const { orgId, vehicleId } = useParams();
  const { user } = useAuth();
  const { tc } = useTheme(user?.id);
  const navigate = useNavigate();
  const now = useNow(5000);

  const detail = useLoad(`track-${orgId}-${vehicleId}`, async () => {
    const answer = await getVehicleDetail(orgId, vehicleId);
    return { ...answer, vehicle: stampVehicle(answer.vehicle) };
  });
  const data = detail.data;
  const vehicle = data?.vehicle ?? null;
  const trip = vehicle?.trip ?? null;
  const reload = detail.reload;
  const setData = detail.setData;

  // ── Live ──
  const reloadSoon = useDebounced(reload);
  const watch = useFleetWatch(data ? { vehicleId: Number(vehicleId) } : null, {
    onEvent: (event) => {
      if (event.type === "position") {
        setData((current) => (current ? { ...current, vehicle: applyPosition(current.vehicle, event) } : current));
      } else if (event.type !== "announcement") {
        reloadSoon();
      }
    },
    onSync: reload,
  });

  useEffect(() => {
    if (!data || watch.status === "connected") return undefined;
    const timer = setInterval(reload, 10_000);
    return () => clearInterval(timer);
  }, [data, watch.status, reload]);

  // ── The trip, run through the navigation engine ──
  const sessionId = trip?.sessionId ?? null;
  const routeCoordinates = data?.route?.routeCoordinates ?? null;
  const destinationLat = trip?.destinationLat ?? null;
  const destinationLng = trip?.destinationLng ?? null;
  const plannedDistance = trip?.plannedDistanceMeters ?? null;
  const plannedDuration = trip?.plannedDurationSeconds ?? null;
  const ride = useMemo(() => (sessionId == null ? null : {
    id: `watch-${sessionId}`,
    routeCoordinates,
    routeSteps: null,
    destinationLat,
    destinationLng,
    distanceMeters: plannedDistance,
    durationSeconds: plannedDuration,
  }), [sessionId, routeCoordinates, destinationLat, destinationLng, plannedDistance, plannedDuration]);
  const { nav, pushFix } = useNavigation(ride, { rejoin: false, persist: false });

  const lat = trip?.lat ?? null;
  const lng = trip?.lng ?? null;
  const seenAt = trip?.seenAt ?? null;
  const accuracy = trip?.accuracy ?? null;
  const speed = trip?.speed ?? null;
  const heading = trip?.heading ?? null;
  useEffect(() => {
    if (sessionId == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    pushFix({ lat, lng, accuracy, speed, heading, timestamp: seenAt ?? Date.now() });
  }, [sessionId, lat, lng, seenAt, accuracy, speed, heading, pushFix]);

  const state = vehicle ? liveState(vehicle, now) : "off";
  const onTrip = Boolean(trip);
  const hasPosition = Number.isFinite(lat) && Number.isFinite(lng);
  const tracked = onTrip && hasPosition && nav.position != null;

  // ── What the map draws ──
  const navRoute = onTrip ? nav.route : null;
  const progress = tracked ? nav.progress : null;
  const arrived = tracked && nav.status === "arrived";
  const routeLines = useMemo(() => {
    if (!navRoute) return null;
    if (arrived) return { passed: routeLatLngs(navRoute), ahead: [] };
    if (progress == null) return { passed: [], ahead: routeLatLngs(navRoute) };
    return { passed: sliceRoute(navRoute, 0, progress), ahead: sliceRoute(navRoute, progress, navRoute.total) };
  }, [navRoute, progress, arrived]);

  // Every stop with where it lies on the route, so "passed" and "in 6 min"
  // can be told.
  const rawStops = data?.route?.stops;
  const stops = useMemo(() => (rawStops || []).map((stop) => {
    const hit = navRoute ? projectOnRoute(navRoute, stop.lat, stop.lng) : null;
    const at = hit && hit.lateralMeters < 400 ? hit.progress : null;
    const done = at != null && progress != null && progress > at + PASSED_STOP_M;
    let seconds = null;
    if (at != null && progress != null && !done) {
      const here = remainingDuration(navRoute, progress);
      const there = remainingDuration(navRoute, at);
      if (here != null && there != null) seconds = Math.max(0, here - there);
    }
    return {
      ...stop,
      done: done || arrived,
      seconds,
      note: done || arrived ? "Passed" : seconds != null ? `In about ${formatDuration(seconds)}` : "Stop",
    };
  }), [rawStops, navRoute, progress, arrived]);

  const mapVehicle = useMemo(() => (vehicle ? toMapVehicle(vehicle, now) : null), [vehicle, now]);
  const mapVehicles = useMemo(() => (mapVehicle ? [mapVehicle] : []), [mapVehicle]);
  const destinationName = trip?.destinationName ?? null;
  const destination = useMemo(() => (
    onTrip && Number.isFinite(destinationLat) && Number.isFinite(destinationLng)
      ? { lat: destinationLat, lng: destinationLng, name: shortPlaceName(destinationName, "Destination") }
      : null
  ), [onTrip, destinationLat, destinationLng, destinationName]);

  // ── "Me" and the alert ──
  const [me, setMe] = useState(null);
  const [locating, setLocating] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const myAlert = data?.myAlert ?? null;

  const locateMe = async () => {
    setLocating(true);
    try {
      const here = await getCurrentLocation();
      setMe({ lat: here.lat, lng: here.lng });
      return here;
    } catch (err) {
      toast.error(err.message || "Couldn't get your location.");
      return null;
    } finally {
      setLocating(false);
    }
  };

  // ── Sheet height → map padding ──
  const mapRef = useRef(null);
  const topRef = useRef(null);
  const sheetRef = useRef(null);
  const [bars, setBars] = useState({ top: 76, bottom: 190 });
  const ready = Boolean(data);
  useEffect(() => {
    if (!ready) return undefined;
    const measure = () => {
      const top = Math.round(topRef.current?.getBoundingClientRect().height ?? 0);
      const bottom = Math.round(sheetRef.current?.getBoundingClientRect().height ?? 0);
      setBars((previous) => (previous.top === top && previous.bottom === bottom ? previous : { top, bottom }));
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (observer) {
      if (topRef.current) observer.observe(topRef.current);
      if (sheetRef.current) observer.observe(sheetRef.current);
    }
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [ready]);

  const back = () => navigate(`/organizations/${orgId}`);

  // ── Loading / not allowed ──
  // "Not allowed" also covers access that was taken away while this screen
  // was open: the live line says so, and nothing further is shown.
  const denied = watch.denied || (detail.error?.status === 403 ? detail.error.message : null);
  if (detail.loading || !data || denied) {
    return (
      <div className={`flex min-h-screen items-center justify-center p-4 ${tc.bg} ${tc.text}`}>
        <div className="w-full max-w-md">
          {detail.loading ? (
            <Loading label="Finding the vehicle…" tc={tc} />
          ) : (
            <Notice
              icon={denied ? "lock" : "alertTriangle"}
              title={denied ? "You can't follow this vehicle" : "Couldn't open this vehicle"}
              tc={tc}
              action={
                <>
                  <Button variant="secondary" icon="arrowLeft" tc={tc} onClick={() => navigate("/organizations")}>
                    Organizations
                  </Button>
                  {!denied && <Button variant="primary" icon="refresh" tc={tc} onClick={reload}>Try again</Button>}
                </>
              }
            >
              {denied || detail.error?.message || "Please try again."}
            </Notice>
          )}
        </div>
      </div>
    );
  }

  const type = vehicleType(vehicle.vehicleType);
  const info = LIVE_STATE[state];
  const crowd = trip ? crowdLevel(trip.crowdLevel) : null;
  const quiet = isStale(trip, now);                       // on a trip, but no position lately
  const speedKmh = onTrip && hasPosition && !quiet ? kmh(trip.speed) : null;
  const trusted = onTrip && hasPosition && !quiet;        // an arrival time worth showing
  const offRoute = tracked && trusted && nav.status === "off-route";
  const lastSeen = parseTime(vehicle.lastLocationAt);
  const upcoming = stops.filter((stop) => !stop.done);

  return (
    <div className={`fixed inset-0 z-[900] ${tc.bg} ${tc.text}`}>
      {/* ── MAP ── */}
      <div className="absolute inset-0">
        <FleetMapView
          ref={mapRef}
          tc={tc}
          vehicles={mapVehicles}
          selectedId={vehicle.id}
          followId={onTrip ? vehicle.id : null}
          route={routeLines}
          stops={stops}
          destination={destination}
          me={me}
          alert={myAlert}
          padding={bars}
          fitKey={`${vehicleId}-${sessionId ?? "idle"}`}
        />
      </div>

      {/* ── TOP: which vehicle, whose, and its state ── */}
      <div
        ref={topRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-[1100] px-3 pb-1"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <div className="mx-auto w-full max-w-xl space-y-2">
          <div className={`pointer-events-auto flex items-center gap-3 rounded-xl border p-2.5 shadow-sm ${tc.card}`}>
            <IconButton icon="arrowLeft" label="Back to the organization" size="sm" tc={tc} onClick={back} />
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
              state === "sos" ? tc.dangerSoft : state === "live" ? tc.okSoft : `${tc.surface2} ${tc.divider}`
            }`}>
              <Icon name={type.icon} size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{vehicle.vehicleCode}</p>
              <p className={`truncate text-xs ${tc.sub}`}>
                {data.org.name}{vehicle.registrationNumber ? ` · ${vehicle.registrationNumber}` : ""}
              </p>
            </div>
            <Badge tone={info.tone} tc={tc}>
              {(state === "live" || state === "sos") && <LiveDot tone={info.tone} />}
              {info.label}
            </Badge>
          </div>

          {state === "sos" && (
            <MapChip icon="sos" tone="danger" tc={tc}>
              The driver reported an emergency{trip.sosMessage ? ` — ${trip.sosMessage}` : ""}
            </MapChip>
          )}
          {quiet && (
            <MapChip icon="gpsOff" tone="warn" tc={tc}>
              No signal — last seen {timeAgo(trip.seenAt, now)}
            </MapChip>
          )}
          {state === "starting" && (
            <MapChip icon="spinner" spin tc={tc}>The trip has started — waiting for its first position</MapChip>
          )}
          {offRoute && (
            <MapChip icon="maneuverMerge" tone="rejoin" tc={tc}>Off its planned route right now</MapChip>
          )}
          {watch.status === "disconnected" && onTrip && (
            <MapChip icon="refresh" tc={tc}>Reconnecting — updating every 10 seconds</MapChip>
          )}
        </div>
      </div>

      {/* ── BOTTOM: when, how full, and what next ── */}
      <div
        ref={sheetRef}
        className={`absolute inset-x-0 bottom-0 z-[1100] overflow-hidden rounded-t-xl border border-b-0 ${tc.card}`}
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto w-full max-w-xl px-4 pt-3">
          {onTrip ? (
            <>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Icon name="route" size={16} className={tc.sub} />
                <span className="min-w-0 flex-1 truncate">{tripTitle(trip)}</span>
                {trip.driverName && <span className={`shrink-0 text-xs font-normal ${tc.sub}`}>{trip.driverName}</span>}
              </p>

              {arrived ? (
                <p className={`mt-3 flex items-center gap-2 rounded-lg border p-3 text-sm font-semibold ${tc.okSoft}`}>
                  <Icon name="finish" size={18} />
                  It has reached {shortPlaceName(trip.destinationName, "its destination")}
                </p>
              ) : tracked && trusted && nav.remainingDistance != null ? (
                <div className="mt-3 flex items-start gap-2">
                  <Figure strong tc={tc} label="Arrives in" value={formatDuration(nav.remainingTime)} />
                  <span className={`mt-1 h-9 w-px shrink-0 ${tc.hairline}`} />
                  <Figure strong tc={tc} label="Distance" value={formatDistance(nav.remainingDistance)} />
                  <span className={`mt-1 h-9 w-px shrink-0 ${tc.hairline}`} />
                  <Figure strong tc={tc} label="Arrival" value={formatClock(nav.eta)} />
                </div>
              ) : (
                <p className={`mt-3 text-sm ${tc.sub}`}>
                  {quiet
                    ? "An arrival time will show again as soon as the vehicle reports its position."
                    : "Working out when it arrives…"}
                </p>
              )}

              <div className={`mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs ${tc.sub}`}>
                {speedKmh != null && <span>{speedKmh > 2 ? `${speedKmh} km/h` : "Standing"}</span>}
                {crowd && <Badge tone={crowd.tone} icon="seat" tc={tc}>{crowd.label}</Badge>}
                <span>Started {formatClockTime(trip.startedAt)}</span>
                {me && hasPosition && (
                  <span>{formatDistance(haversineDistance(me.lat, me.lng, lat, lng))} from you</span>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">
                {vehicle.status === "ACTIVE" ? "Not on a trip right now" : `${vehicleStatus(vehicle.status).label} — not in use`}
              </p>
              <p className={`mt-1 text-sm ${tc.sub}`}>
                {data.lastTrip
                  ? `Its last trip${
                    data.lastTrip.routeName ? ` (${data.lastTrip.routeName})`
                      : data.lastTrip.destinationName ? ` (to ${shortPlaceName(data.lastTrip.destinationName, "")})` : ""
                  } ended ${timeAgo(parseTime(data.lastTrip.endedAt), now)} — the map shows where.`
                  : lastSeen != null ? `Last seen ${timeAgo(lastSeen, now)}.` : "It has not been on a trip yet."}
                {" "}This screen goes live by itself when its next trip starts.
              </p>
            </>
          )}

          {/* Actions */}
          <div className="mt-3 flex gap-2">
            <Button
              variant={myAlert ? "soft" : "primary"}
              size="md"
              full
              icon={myAlert ? "bell" : "bellOff"}
              tc={tc}
              onClick={() => setShowAlert(true)}
            >
              {myAlert ? `Alert set · ${formatDistance(myAlert.radiusMeters)}` : "Tell me when it's near"}
            </Button>
            {trip?.driverPhone && (
              <Button as="a" href={`tel:${trip.driverPhone.replace(/[^\d+]/g, "")}`} variant="secondary" size="md"
                icon="phone" iconOnly title={`Call the driver, ${trip.driverName}`} tc={tc} className="w-10 shrink-0" />
            )}
            <Button variant="secondary" size="md" icon="recenter" iconOnly tc={tc} loading={locating}
              title="Show where I am" className="w-10 shrink-0"
              onClick={async () => {
                const here = await locateMe();
                // After the marker is on the map, show it together with the vehicle.
                if (here) setTimeout(() => mapRef.current?.fit(), 80);
              }} />
            {stops.length > 0 && (
              <Button variant="secondary" size="md" icon={expanded ? "chevronDown" : "list"} iconOnly tc={tc}
                title={expanded ? "Hide the stops" : "Show the stops"} className="w-10 shrink-0"
                aria-expanded={expanded} onClick={() => setExpanded((open) => !open)} />
            )}
          </div>

          {/* Stops */}
          {expanded && stops.length > 0 && (
            <ol className={`mt-3 max-h-[32vh] overflow-y-auto rounded-lg border ${tc.divider}`}>
              {stops.map((stop, index) => (
                <li key={`${stop.name}-${index}`}
                  className={`flex items-center gap-3 px-3 py-2.5 ${index > 0 ? `border-t ${tc.divider}` : ""} ${stop.done ? "opacity-55" : ""}`}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                    stop.done ? `${tc.surface2} ${tc.divider}` : tc.chipSelected}`}>
                    {stop.done ? <Icon name="check" size={12} /> : index + 1}
                  </span>
                  <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-medium"
                    onClick={() => mapRef.current?.panTo(stop.lat, stop.lng)}>
                    {stop.name}
                  </button>
                  <span className={`shrink-0 text-xs tabular-nums ${tc.sub}`}>
                    {stop.done ? "Passed" : stop.seconds != null && trusted ? formatDuration(stop.seconds) : "—"}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {!expanded && onTrip && upcoming.length > 0 && trusted && (
            <p className={`mt-2 truncate text-center text-xs ${tc.sub}`}>
              Next stop: <span className={`font-semibold ${tc.text}`}>{upcoming[0].name}</span>
              {upcoming[0].seconds != null ? ` · ${formatDuration(upcoming[0].seconds)}` : ""}
            </p>
          )}
        </div>
      </div>

      {showAlert && (
        <AlertModal
          tc={tc}
          vehicle={vehicle}
          current={myAlert}
          stops={stops}
          destination={destination}
          me={me}
          locateMe={locateMe}
          onClose={() => setShowAlert(false)}
          onChanged={(next) => {
            setData((existing) => (existing ? { ...existing, myAlert: next } : existing));
            setShowAlert(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// "Tell me when it's near" — one place, one distance
//
// Checked on the server each time the vehicle's position is stored, so
// the notification arrives even with RideWise closed. It fires once per
// trip, and keeps working for the trips after this one.
// ============================================================
function AlertModal({ tc, vehicle, current, stops, destination, me, locateMe, onClose, onChanged }) {
  // Places to choose from: the stops still ahead, the destination, me.
  const places = useMemo(() => {
    const list = stops.filter((stop) => !stop.done).map((stop, index) => ({
      key: `stop-${index}-${stop.name}`, label: stop.name, lat: stop.lat, lng: stop.lng, icon: "busStop",
    }));
    if (destination) {
      list.push({ key: "destination", label: destination.name, lat: destination.lat, lng: destination.lng, icon: "pin" });
    }
    return list;
  }, [stops, destination]);

  const [place, setPlace] = useState(() => (
    current ? { key: "current", label: current.label, lat: current.lat, lng: current.lng, icon: "bell" } : null
  ));
  const [radius, setRadius] = useState(current?.radiusMeters && RADII.includes(current.radiusMeters) ? current.radiusMeters : 1000);
  const [busy, setBusy] = useState(false);
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState("");

  const useMyLocation = async () => {
    setError("");
    setFinding(true);
    const here = me || await locateMe();
    setFinding(false);
    if (here) setPlace({ key: "me", label: "where I am", lat: here.lat, lng: here.lng, icon: "recenter" });
  };

  const save = async () => {
    if (!place) { setError("Choose the place you want to be told about."); return; }
    setBusy(true);
    setError("");
    try {
      const saved = await saveVehicleAlert({
        vehicleId: vehicle.id, label: place.label, lat: place.lat, lng: place.lng, radiusMeters: radius,
      });
      toast.success(`You'll be told when ${vehicle.vehicleCode} is within ${formatDistance(radius)} of ${place.label}.`);
      onChanged(saved);
    } catch (err) {
      setError(err.message || "Couldn't save the alert. Please try again.");
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await removeVehicleAlert(vehicle.id);
      toast.info("Alert removed.");
      onChanged(null);
    } catch (err) {
      setError(err.message || "Couldn't remove the alert. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Modal
      tc={tc}
      icon="bell"
      title={`Tell me when ${vehicle.vehicleCode} is near`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          {current && (
            <Button variant="danger" tc={tc} icon="trash" disabled={busy} onClick={remove} className="mr-auto">
              Remove
            </Button>
          )}
          <Button variant="ghost" tc={tc} disabled={busy} onClick={onClose}>Cancel</Button>
          <Button variant="primary" tc={tc} icon="check" loading={busy} onClick={save}>
            {current ? "Update alert" : "Set alert"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-semibold">Near which place?</p>
          <div className="space-y-1.5">
            {place && !places.some((option) => option.key === place.key) && (
              <PlaceOption option={place} selected tc={tc} onPick={() => {}} />
            )}
            {places.map((option) => (
              <PlaceOption key={option.key} option={option} selected={place?.key === option.key} tc={tc}
                onPick={() => setPlace(option)} />
            ))}
            <Button variant="secondary" size="md" full icon="recenter" tc={tc} loading={finding} onClick={useMyLocation}>
              Use where I am now
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold">How close?</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Distance">
            {RADII.map((value) => (
              <Chip key={value} selected={radius === value} tc={tc} onClick={() => setRadius(value)}>
                {formatDistance(value)}
              </Chip>
            ))}
          </div>
        </div>

        <p className={`flex items-start gap-2 text-xs ${tc.sub}`}>
          <Icon name="info" size={14} className="mt-0.5" />
          You get one notification per trip, even with RideWise closed, and it keeps working on the following days.
          Your place is used only to send you this alert.
        </p>
        <ErrorNote message={error} tc={tc} />
      </div>
    </Modal>
  );
}

function PlaceOption({ option, selected, onPick, tc }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onPick}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
        selected ? tc.accentSoft : `${tc.card} ${tc.cardHover}`
      }`}
    >
      <Icon name={option.icon} size={16} />
      <span className={`min-w-0 flex-1 truncate ${selected ? "" : tc.text}`}>{option.label}</span>
      {selected && <Icon name="check" size={15} />}
    </button>
  );
}
