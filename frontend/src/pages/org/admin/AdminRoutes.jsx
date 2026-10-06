// ============================================================
// AdminRoutes — saved routes with stops (Routes tab)
//
// A saved route is what makes a bus a bus: the driver picks "Morning loop"
// instead of typing a destination, and everyone following the vehicle
// sees its stops and when it reaches each of them.
//
// BUILDING ONE
//   start → stops (in the order they are served) → destination
//   "Plan the road" asks the routing service for a road THROUGH the stops
//   in that order — not the fastest way from start to end, which would
//   happily skip half of them. The result is shown on a map before saving.
//
// Trips that already used a route keep their own copy of it, so editing
// or deleting a route never changes a trip that is under way or history.
// ============================================================

import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useLoad } from "../../hooks/useFleet";
import Icon from "../../components/ui/Icon";
import Button, { IconButton } from "../../components/ui/Button";
import LocationSearchInput from "../../components/shared/LocationSearchInput";
import FleetMapView from "../../components/org/FleetMapView";
import {
  ConfirmButton, ErrorNote, Field, LoadError, Loading, Modal, Notice, Section, TextInput,
} from "../../components/org/kit";
import { plural } from "../../components/org/fleetUi";
import { parseRouteCoordinates } from "../../../services/navigation";
import { fetchRoutes, formatDistance, formatDuration, shortPlaceName } from "../../../services/routingApi";
import { addRoute, getRouteDetail, getRoutes, removeRoute, updateRoute } from "../../../services/orgApi";

const MAX_STOPS = 40;

export default function AdminRoutes({ orgId, tc }) {
  const routes = useLoad(`admin-routes-${orgId}`, () => getRoutes(orgId));
  const [editing, setEditing] = useState(null); // { id } to edit, {} for a new one

  const remove = async (route) => {
    try {
      await removeRoute(orgId, route.id);
      toast.success(`"${route.name}" removed.`);
      routes.reload();
    } catch (err) {
      toast.error(err.message || "Couldn't remove the route.");
    }
  };

  if (routes.loading) return <Loading label="Loading the routes…" tc={tc} />;
  if (!routes.data) return <LoadError error={routes.error} onRetry={routes.reload} tc={tc} />;

  return (
    <>
      <Section
        title="Routes"
        count={routes.data.length}
        tc={tc}
        action={<Button variant="primary" size="sm" icon="plus" tc={tc} onClick={() => setEditing({})}>New route</Button>}
      >
        {routes.data.length === 0 ? (
          <Notice icon="route" title="No saved routes yet" tc={tc}
            action={<Button variant="primary" icon="plus" tc={tc} onClick={() => setEditing({})}>New route</Button>}>
            Save the routes your vehicles drive every day, with their stops. Drivers start a trip with one tap, and
            passengers see when the vehicle reaches their stop. (Drivers can always choose another destination too.)
          </Notice>
        ) : (
          <div className="space-y-2">
            {routes.data.map((route) => (
              <div key={route.id} className={`flex items-center gap-3 rounded-xl border p-3.5 ${tc.card}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
                  <Icon name="route" size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{route.name}</p>
                  <p className={`truncate text-xs ${tc.sub}`}>
                    {shortPlaceName(route.fromName, "Start")} → {shortPlaceName(route.destinationName, "Destination")}
                  </p>
                  <p className={`truncate text-[11px] ${tc.sub} opacity-80`}>
                    {[
                      route.distanceMeters > 0 ? formatDistance(route.distanceMeters) : null,
                      route.durationSeconds > 0 ? formatDuration(route.durationSeconds) : null,
                      plural(route.stops?.length || 0, "stop"),
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <IconButton icon="edit" label={`Edit ${route.name}`} size="sm" tc={tc} onClick={() => setEditing({ id: route.id })} />
                <ConfirmButton label="Remove" confirmLabel="Remove" icon="trash" iconOnly variant="ghost" tc={tc}
                  title={`Remove ${route.name}`} onConfirm={() => remove(route)} />
              </div>
            ))}
          </div>
        )}
      </Section>

      {editing && (
        <RouteEditor
          key={editing.id ?? "new"}
          tc={tc}
          orgId={orgId}
          routeId={editing.id ?? null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); routes.reload(); }}
        />
      )}
    </>
  );
}

// ── Load (when editing), then show the builder ───────────────
function RouteEditor({ tc, orgId, routeId, onClose, onSaved }) {
  const existing = useLoad(routeId != null ? `admin-route-${routeId}` : null, () => getRouteDetail(orgId, routeId));

  if (routeId != null && (existing.loading || !existing.data)) {
    return (
      <Modal tc={tc} wide icon="route" title="Edit route" onClose={onClose}>
        {existing.loading
          ? <Loading label="Loading the route…" tc={tc} compact />
          : <LoadError error={existing.error} onRetry={existing.reload} tc={tc} />}
      </Modal>
    );
  }
  return <RouteBuilder tc={tc} orgId={orgId} route={existing.data || null} onClose={onClose} onSaved={onSaved} />;
}

const placeOf = (name, lat, lng) => (Number.isFinite(lat) && Number.isFinite(lng) ? { name: name || "", lat, lng } : null);

// The spoken directions say "Stop: <name>" at every stop. A stop renamed
// after the road was planned must be announced by its new name.
function withStopNames(stepsJson, stops) {
  if (!stepsJson) return stepsJson;
  try {
    let index = 0;
    const steps = JSON.parse(stepsJson).map((step) => {
      if (step?.maneuverType !== "waypoint") return step;
      const name = stops[index]?.name?.trim();
      index += 1;
      return { ...step, instruction: name ? `Stop: ${name}` : `Stop ${index}` };
    });
    return JSON.stringify(steps);
  } catch {
    return stepsJson;
  }
}

function RouteBuilder({ tc, orgId, route, onClose, onSaved }) {
  const [name, setName] = useState(route?.name || "");

  const [from, setFrom] = useState(() => placeOf(route?.fromName, route?.fromLat, route?.fromLng));
  const [fromText, setFromText] = useState(route?.fromName || "");
  const [to, setTo] = useState(() => placeOf(route?.destinationName, route?.destinationLat, route?.destinationLng));
  const [toText, setToText] = useState(route?.destinationName || "");
  const [stops, setStops] = useState(() => route?.stops || []);
  const [stopText, setStopText] = useState("");

  // The planned road. `stale` = the places changed since it was planned.
  const [road, setRoad] = useState(() => (route?.routeCoordinates ? {
    coordinates: route.routeCoordinates,     // JSON text, as stored
    steps: route.routeSteps || null,
    distance: route.distanceMeters,
    duration: route.durationSeconds,
  } : null));
  const [stale, setStale] = useState(false);

  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const placesChanged = () => { setStale(true); setError(""); };

  const moveStop = (index, delta) => {
    setStops((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    placesChanged();
  };

  const plan = async () => {
    setError("");
    if (!from || !to) { setError("Choose where the route starts and where it ends — pick a suggestion from the list."); return; }
    setPlanning(true);
    try {
      const [best] = await fetchRoutes(from, to, { via: stops });
      setRoad({
        coordinates: JSON.stringify(best.coordinates),
        steps: JSON.stringify(best.steps || []),
        distance: best.distance,
        duration: best.duration,
      });
      setStale(false);
    } catch (err) {
      setError(err.message || "Couldn't plan the road. Please try again.");
    } finally {
      setPlanning(false);
    }
  };

  const save = async () => {
    setError("");
    if (!name.trim()) { setError("Give the route a name, such as “Morning loop”."); return; }
    if (stops.some((stop) => !stop.name.trim())) { setError("Every stop needs a name."); return; }
    if (!road || stale) { setError("Plan the road first, so you can see it before saving."); return; }

    const body = {
      name: name.trim(),
      fromName: from.name,
      fromLat: from.lat,
      fromLng: from.lng,
      destinationName: to.name,
      destinationLat: to.lat,
      destinationLng: to.lng,
      routeCoordinates: road.coordinates,
      routeSteps: withStopNames(road.steps, stops),
      distanceMeters: road.distance,
      durationSeconds: road.duration,
      stops: stops.map((stop) => ({ name: stop.name.trim(), lat: stop.lat, lng: stop.lng })),
    };
    setSaving(true);
    try {
      if (route) await updateRoute(orgId, route.id, body);
      else await addRoute(orgId, body);
      toast.success(route ? `"${body.name}" updated.` : `"${body.name}" saved — drivers can pick it now.`);
      onSaved();
    } catch (err) {
      setError(err.message || "Couldn't save the route.");
      setSaving(false);
    }
  };

  // ── Map preview ──
  const line = useMemo(
    () => parseRouteCoordinates(road?.coordinates).map((point) => [point.lat, point.lng]),
    [road],
  );
  const mapRoute = useMemo(() => (line.length > 1 && !stale ? { passed: [], ahead: line } : null), [line, stale]);
  const fitKey = `${from?.lat},${from?.lng}|${to?.lat},${to?.lng}|${stops.length}|${road?.distance ?? 0}`;
  const ready = Boolean(road) && !stale;

  return (
    <Modal
      tc={tc}
      wide
      icon="route"
      title={route ? "Edit route" : "New route"}
      onClose={onClose}
      busy={saving || planning}
      footer={
        <>
          <Button variant="ghost" tc={tc} disabled={saving} onClick={onClose}>Cancel</Button>
          {!ready ? (
            <Button variant="primary" icon="route" tc={tc} loading={planning} onClick={plan}>
              {planning ? "Planning…" : road ? "Plan the road again" : "Plan the road"}
            </Button>
          ) : (
            <Button variant="primary" icon="check" tc={tc} loading={saving} onClick={save}>
              {route ? "Save changes" : "Save route"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Route name" tc={tc}>
          <TextInput tc={tc} value={name} onChange={(event) => setName(event.target.value)}
            placeholder="Morning loop · Route 7 · Campus ⇄ Station" maxLength={80} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-semibold">Starts at</p>
            <LocationSearchInput
              icon="dot"
              label="Where the route starts"
              placeholder="Depot, campus, landmark"
              value={fromText}
              onChange={(text) => { setFromText(text); setFrom(null); placesChanged(); }}
              onSelect={(result) => { setFromText(result.label); setFrom({ name: result.label, lat: result.lat, lng: result.lng }); placesChanged(); }}
              near={to}
              tc={tc}
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold">Ends at</p>
            <LocationSearchInput
              icon="pin"
              label="Where the route ends"
              placeholder="Terminus, hospital, station"
              value={toText}
              onChange={(text) => { setToText(text); setTo(null); placesChanged(); }}
              onSelect={(result) => { setToText(result.label); setTo({ name: result.label, lat: result.lat, lng: result.lng }); placesChanged(); }}
              near={from}
              tc={tc}
            />
          </div>
        </div>

        {/* ── Stops, in the order they are served ── */}
        <div>
          <p className="mb-1.5 flex items-baseline justify-between text-xs font-semibold">
            <span>Stops on the way</span>
            <span className={`font-normal ${tc.sub}`}>{stops.length ? `${stops.length} · in this order` : "Optional"}</span>
          </p>
          {stops.length > 0 && (
            <ol className={`mb-2 overflow-hidden rounded-lg border ${tc.divider}`}>
              {stops.map((stop, index) => (
                <li key={`${stop.lat},${stop.lng},${index}`}
                  className={`flex items-center gap-2 px-2.5 py-2 ${index > 0 ? `border-t ${tc.divider}` : ""}`}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${tc.chipSelected}`}>
                    {index + 1}
                  </span>
                  <input
                    aria-label={`Name of stop ${index + 1}`}
                    value={stop.name}
                    maxLength={80}
                    onChange={(event) => setStops((list) => list.map((item, at) => (
                      at === index ? { ...item, name: event.target.value } : item
                    )))}
                    className={`h-9 min-w-0 flex-1 rounded-lg border px-2.5 text-sm ${tc.input}`}
                  />
                  <IconButton icon="arrowUp" label="Move up" size="sm" tc={tc} disabled={index === 0}
                    onClick={() => moveStop(index, -1)} />
                  <IconButton icon="chevronDown" label="Move down" size="sm" tc={tc} disabled={index === stops.length - 1}
                    onClick={() => moveStop(index, 1)} />
                  <IconButton icon="close" label={`Remove ${stop.name || "stop"}`} size="sm" tc={tc}
                    onClick={() => { setStops((list) => list.filter((_, at) => at !== index)); placesChanged(); }} />
                </li>
              ))}
            </ol>
          )}
          {stops.length < MAX_STOPS && (
            <LocationSearchInput
              icon="busStop"
              label="Add a stop"
              placeholder="Add a stop — search for the place"
              value={stopText}
              onChange={setStopText}
              onSelect={(result) => {
                setStops((list) => [...list, { name: shortPlaceName(result.label, "Stop"), lat: result.lat, lng: result.lng }]);
                setStopText("");
                placesChanged();
              }}
              near={from || to}
              tc={tc}
            />
          )}
        </div>

        {/* ── The road ── */}
        {(from || to || stops.length > 0) && (
          <div>
            <div className={`relative h-[240px] overflow-hidden rounded-xl border sm:h-[280px] ${tc.divider}`}>
              <FleetMapView compact tc={tc} route={mapRoute} stops={stops} start={from} destination={to} fitKey={fitKey} />
            </div>
            <p className={`mt-2 flex items-center gap-2 text-xs ${ready ? tc.sub : tc.warn}`}>
              <Icon name={ready ? "road" : "info"} size={14} />
              {ready
                ? `${formatDistance(road.distance)} · about ${formatDuration(road.duration)} of driving · ${plural(stops.length, "stop")}`
                : road ? "The places changed — plan the road again to see the new route."
                : "Plan the road to see it on the map."}
            </p>
          </div>
        )}

        <ErrorNote message={error} tc={tc} />
      </div>
    </Modal>
  );
}
