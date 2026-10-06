// ============================================================
// Driver — take a vehicle out
// Route: /driver (protected)      /driver?org=<id> opens that organization
//
// TOP TO BOTTOM
//   the trip in progress (if there is one) → back to its map
//   the organizations I may drive for → "Start a trip"
//   the trips I have driven → their recorded path
//
// STARTING A TRIP (three taps)
//   1. the vehicle   only vehicles that are free are offered; one that is
//                    out shows who has it
//   2. where to      one of the organization's saved routes, or any other
//                    destination (planned like a ride)
//   3. Start         the phone's location is checked FIRST — a trip that
//                    cannot report where the vehicle is helps nobody
//
// The server has the last word on step 3: if another driver took the same
// vehicle a second earlier, it says so and the list is refreshed.
// ============================================================

import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { useOrgs } from "../../context/OrgContext";
import { useDriverTrip } from "../../context/DriverTripContext";
import { useTheme } from "../hooks/useTheme";
import { useLoad } from "../hooks/useFleet";
import Icon from "../components/ui/Icon";
import Button from "../components/ui/Button";
import RideSetupFlow from "../components/ride/RideSetupFlow";
import TripReplay from "../components/org/TripReplay";
import {
  AppShell, Badge, ErrorNote, LiveDot, LoadError, Loading, Modal, Notice, PageHeader, Section,
} from "../components/org/kit";
import { OrgRow } from "../components/org/rows";
import {
  formatDateTime, plural, tripSeconds, tripTitle, vehicleType,
} from "../components/org/fleetUi";
import { formatDistance, formatDuration } from "../../services/routingApi";
import { getCurrentLocation } from "../../services/locationService";
import { getMyTrips, getRoutes, getVehicles } from "../../services/orgApi";

export default function Driver() {
  const { user } = useAuth();
  const userId = user?.id;
  const { theme, setTheme, tc } = useTheme(userId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { summary, loaded } = useOrgs();
  const { trip } = useDriverTrip();

  // Owners and admins may drive too.
  const orgs = useMemo(() => {
    const seen = new Set();
    return [...summary.driving, ...summary.managed].filter((org) => {
      if (seen.has(org.id) || org.status !== "ACTIVE") return false;
      seen.add(org.id);
      return true;
    });
  }, [summary.driving, summary.managed]);

  // ── Which organization is the "start a trip" dialog open for? ──
  // /driver?org=12 opens it straight away (once), unless a trip is running.
  const wanted = searchParams.get("org");
  const [chosen, setChosen] = useState(null);
  const [dismissed, setDismissed] = useState(null);
  const linked = wanted && !trip && dismissed !== wanted
    ? orgs.find((org) => String(org.id) === wanted) || null
    : null;
  const startFor = trip ? null : chosen || linked;
  const closeStart = () => { setChosen(null); setDismissed(wanted); };

  const history = useLoad(userId != null ? `my-trips-${userId}` : null, () => getMyTrips(0, 20));
  const [replayId, setReplayId] = useState(null);

  return (
    <AppShell tc={tc} theme={theme} setTheme={setTheme} userId={userId}>
      <PageHeader
        tc={tc}
        title="Drive"
        subtitle="Take one of your organization's vehicles out. Its position is shared live until you end the trip."
      />

      <div className="space-y-8">
        {/* ── Trip in progress ── */}
        {trip && (
          <section className={`rounded-xl border p-4 ${tc.okSoft}`}>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <LiveDot />
              Trip in progress
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${tc.inkTile}`}>
                <Icon name={vehicleType(trip.vehicleType).icon} size={24} />
              </span>
              <div className={`min-w-0 flex-1 ${tc.text}`}>
                <p className="truncate text-base font-semibold">{trip.session.vehicleCode}</p>
                <p className={`truncate text-xs ${tc.sub}`}>{trip.orgName} · {tripTitle(trip.session)}</p>
              </div>
            </div>
            <Button variant="accent" size="lg" full icon="navigate" tc={tc} className="mt-3"
              onClick={() => navigate("/driver/session")}>
              Open the trip
            </Button>
          </section>
        )}

        {/* ── Where I can drive ── */}
        <Section title="Your organizations" tc={tc}>
          {!loaded ? (
            <Loading tc={tc} compact />
          ) : orgs.length === 0 ? (
            <Notice
              icon="steering"
              title="You're not a driver anywhere yet"
              tc={tc}
              action={
                <Button variant="secondary" icon="building" tc={tc} onClick={() => navigate("/organizations")}>
                  Organizations
                </Button>
              }
            >
              An organization&apos;s admin invites you with your username — <b>@{user?.username}</b> — and you accept
              the invitation under Organizations. Running a fleet yourself? Create an organization there.
            </Notice>
          ) : (
            <div className="space-y-2">
              {orgs.map((org) => (
                <OrgRow key={org.id} org={org} tc={tc} onOpen={() => navigate(`/organizations/${org.id}`)}>
                  <Button
                    variant="primary"
                    size="sm"
                    icon="play"
                    tc={tc}
                    disabled={Boolean(trip)}
                    title={trip ? "End the trip in progress first" : `Start a trip for ${org.name}`}
                    onClick={() => setChosen(org)}
                  >
                    Start a trip
                  </Button>
                </OrgRow>
              ))}
            </div>
          )}
        </Section>

        {/* ── What I have driven ── */}
        <Section title="Your trips" count={history.data ? history.data.total : null} tc={tc}>
          {history.loading ? (
            <Loading tc={tc} compact />
          ) : !history.data ? (
            <LoadError error={history.error} onRetry={history.reload} tc={tc} />
          ) : history.data.items.length === 0 ? (
            <Notice icon="history" title="No trips yet" tc={tc} compact>
              Every trip you drive is listed here with the path it took.
            </Notice>
          ) : (
            <div className="space-y-2">
              {history.data.items.map((item) => <TripRow key={item.id} trip={item} tc={tc} onOpen={() => setReplayId(item.id)} />)}
              {history.data.total > history.data.items.length && (
                <p className={`pt-1 text-center text-xs ${tc.sub}`}>
                  Showing your latest {history.data.items.length} of {history.data.total} trips.
                </p>
              )}
            </div>
          )}
        </Section>
      </div>

      {startFor && (
        <StartTripModal
          key={startFor.id}
          org={startFor}
          tc={tc}
          onClose={closeStart}
          onStarted={() => { closeStart(); navigate("/driver/session"); }}
        />
      )}
      {replayId != null && <TripReplay sessionId={replayId} tc={tc} onClose={() => setReplayId(null)} />}
    </AppShell>
  );
}

// ── One trip of the history ──────────────────────────────────
function TripRow({ trip, tc, onOpen }) {
  const seconds = tripSeconds(trip);
  const meta = [
    formatDateTime(trip.startedAt),
    trip.distanceMeters > 0 ? formatDistance(trip.distanceMeters) : null,
    seconds != null && seconds > 0 ? formatDuration(seconds) : null,
  ].filter(Boolean);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${tc.card} ${tc.cardHover}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
        <Icon name="route" size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{trip.vehicleCode} · {tripTitle(trip)}</span>
        <span className={`block truncate text-xs ${tc.sub}`}>{meta.join(" · ")}</span>
      </span>
      {trip.status === "ACTIVE" ? (
        <Badge tone="ok" tc={tc}><LiveDot />Running</Badge>
      ) : trip.status === "CANCELLED" ? (
        <Badge tone="warn" tc={tc}>No position</Badge>
      ) : trip.endReason && trip.endReason !== "DRIVER" ? (
        <Badge tone="warn" tc={tc}>{trip.endReason === "TIMEOUT" ? "Auto-ended" : "Ended for you"}</Badge>
      ) : null}
      <Icon name="chevronRight" size={16} className={`shrink-0 ${tc.sub}`} />
    </button>
  );
}

// ============================================================
// Start a trip — vehicle → where to → start
// ============================================================
function StartTripModal({ org, tc, onClose, onStarted }) {
  const { start } = useDriverTrip();
  const vehicles = useLoad(`start-vehicles-${org.id}`, () => getVehicles(org.id));
  const routes = useLoad(`start-routes-${org.id}`, () => getRoutes(org.id));

  const [vehicle, setVehicle] = useState(null);   // step 2 once chosen
  const [custom, setCustom] = useState(false);    // planning another destination
  const [starting, setStarting] = useState(null); // route id being started
  const [error, setError] = useState("");

  // Vehicles a driver can take out, free ones first.
  const usable = useMemo(() => {
    const list = (vehicles.data || []).filter((item) => item.status === "ACTIVE");
    list.sort((a, b) => (
      Number(Boolean(a.trip)) - Number(Boolean(b.trip)) ||
      a.vehicleCode.localeCompare(b.vehicleCode, undefined, { numeric: true })
    ));
    return list;
  }, [vehicles.data]);

  // The one place a trip is really started.
  const begin = async (request) => {
    // A trip nobody can follow is worse than no trip: make sure this
    // device can share its location before anything is locked.
    await getCurrentLocation();
    try {
      const started = await start({ orgId: org.id, vehicleId: vehicle.id, ...request });
      toast.success(`Trip started on ${started.session.vehicleCode}. Its position is live now.`);
      onStarted();
    } catch (err) {
      // Somebody else may have taken the vehicle a moment ago.
      vehicles.reload();
      throw err;
    }
  };

  const startOnRoute = async (route) => {
    setError("");
    setStarting(route.id);
    try {
      await begin({ routeId: route.id });
    } catch (err) {
      setError(err.message || "Couldn't start the trip. Please try again.");
      setStarting(null);
    }
  };

  const title = !vehicle ? `Start a trip · ${org.name}`
    : custom ? `${vehicle.vehicleCode} · where to?`
    : `${vehicle.vehicleCode} · which route?`;

  return (
    <Modal tc={tc} icon="steering" title={title} onClose={onClose} busy={starting != null}>
      {/* ── 1 · the vehicle ── */}
      {!vehicle && (
        vehicles.loading ? <Loading label="Loading the vehicles…" tc={tc} compact />
          : !vehicles.data ? <LoadError error={vehicles.error} onRetry={vehicles.reload} tc={tc} />
          : usable.length === 0 ? (
            <Notice icon="bus" title="No vehicle is available" tc={tc} compact>
              Every vehicle of {org.name} is out of service right now, or none has been added yet.
            </Notice>
          ) : (
            <div className="space-y-2">
              <p className={`text-xs ${tc.sub}`}>Choose the vehicle you are taking out.</p>
              {usable.map((item) => {
                const taken = Boolean(item.trip);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={taken}
                    onClick={() => { setVehicle(item); setError(""); }}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${tc.card} ${taken ? "" : tc.cardHover}`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
                      <Icon name={vehicleType(item.vehicleType).icon} size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{item.vehicleCode}</span>
                      <span className={`block truncate text-xs ${tc.sub}`}>
                        {taken
                          ? `In use by ${item.trip.driverName}`
                          : [vehicleType(item.vehicleType).label, item.registrationNumber,
                            item.capacity ? plural(item.capacity, "seat") : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {taken
                      ? <Badge tone="warn" tc={tc}>In use</Badge>
                      : <Icon name="chevronRight" size={16} className={tc.sub} />}
                  </button>
                );
              })}
            </div>
          )
      )}

      {/* ── 2 · where to ── */}
      {vehicle && !custom && (
        <div className="space-y-2">
          {routes.loading ? (
            <Loading label="Loading the routes…" tc={tc} compact />
          ) : (
            <>
              {(routes.data || []).length > 0 && (
                <p className={`text-xs ${tc.sub}`}>Pick the route you are driving — passengers see it and its stops.</p>
              )}
              {(routes.data || []).map((route) => (
                <div key={route.id} className={`flex items-center gap-3 rounded-lg border p-3 ${tc.card}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
                    <Icon name="route" size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{route.name}</p>
                    <p className={`truncate text-xs ${tc.sub}`}>
                      {[
                        route.distanceMeters > 0 ? formatDistance(route.distanceMeters) : null,
                        route.durationSeconds > 0 ? formatDuration(route.durationSeconds) : null,
                        route.stops?.length ? plural(route.stops.length, "stop") : null,
                      ].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button variant="accent" size="sm" icon="play" tc={tc}
                    loading={starting === route.id} disabled={starting != null && starting !== route.id}
                    onClick={() => startOnRoute(route)}>
                    Start
                  </Button>
                </div>
              ))}
              <Button variant="secondary" size="lg" full icon="pin" tc={tc} disabled={starting != null}
                onClick={() => { setCustom(true); setError(""); }}>
                {(routes.data || []).length > 0 ? "Another destination" : "Choose the destination"}
              </Button>
            </>
          )}
          <ErrorNote message={error} tc={tc} />
          <Button variant="ghost" tc={tc} icon="arrowLeft" disabled={starting != null}
            onClick={() => { setVehicle(null); setError(""); }}>
            Another vehicle
          </Button>
        </div>
      )}

      {/* ── 2b · any other destination, planned like a ride ── */}
      {vehicle && custom && (
        <RideSetupFlow
          rideType="solo"
          tc={tc}
          onCancel={() => setCustom(false)}
          submitLabel="Start trip"
          submitBusyLabel="Starting…"
          submitIcon="play"
          vehicleLabel={vehicle.vehicleCode}
          onRoutePlanned={({ from, destination, route, routeCoordinates, routeSteps }) => begin({
            fromName: from.name,
            fromLat: from.lat,
            fromLng: from.lng,
            destinationName: destination.name,
            destinationLat: destination.lat,
            destinationLng: destination.lng,
            routeCoordinates,
            routeSteps,
            distanceMeters: route.distance,
            durationSeconds: route.duration,
          })}
        />
      )}
    </Modal>
  );
}
