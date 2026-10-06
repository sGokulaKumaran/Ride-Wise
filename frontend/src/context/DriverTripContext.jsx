// ============================================================
// DriverTripContext — the vehicle trip I am driving right now
//
// WHY THIS LIVES ABOVE THE PAGES
//   A personal ride is tracked by the map screen, and closing that screen
//   stops the tracking — fine, only the rider depends on it. A VEHICLE
//   trip is different: people are waiting for that bus. If its position
//   stopped the moment the driver opened another page of the app, every
//   watcher would see the bus freeze.
//   So the trip is run here, once, for the whole app: as long as a trip
//   is in progress, the GPS is watched and positions are sent — whatever
//   page is open. The trip screen (/driver/session) only DISPLAYS what
//   this provider holds.
//
// WHAT IT DOES WHILE A TRIP RUNS
//   • watches the GPS (locationService) and feeds the navigation engine
//     — the same one rides use: next turn, distance left, ETA, the way
//     back when off the route
//   • sends every fix to the server: over the live socket, or over plain
//     HTTP whenever the socket is down
//   • says "still here" when there is no GPS signal, so a bus standing in
//     a depot is not mistaken for an abandoned trip
//   • keeps the screen awake and speaks the directions
//   • notices when the trip was ended somewhere else (an admin, the
//     automatic timeout, another device) and stops cleanly
//
// A trip started on another device (or still running after a reload) is
// picked up automatically.
// ============================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "./AuthContext";
import { useOrgs } from "./OrgContext";
import { useLoad } from "../pages/hooks/useFleet";
import { clearNavProgress, useNavigation } from "../pages/hooks/useNavigation";
import { usePersistentFlag, useVoiceGuidance, useWakeLock } from "../pages/hooks/useRideAssist";
import { GPS, watchLocation } from "../services/locationService";
import { driveFleet, sendFleetAlive, sendFleetPosition } from "../services/fleetSocket";
import {
  getActiveTrip,
  postTripPosition,
  setTripCrowd,
  setTripSos,
  startTrip as apiStartTrip,
  stopTrip as apiStopTrip,
} from "../services/orgApi";

const ALIVE_EVERY_MS = 60_000;   // "still here" when no position went out for this long
const SEARCHING = Object.freeze({ state: GPS.SEARCHING, message: "Searching for GPS…" });

const IDLE = Object.freeze({
  trip: null,
  ride: null,
  loaded: false,
  nav: null,
  gps: SEARCHING,
  link: "idle",
  voiceOn: true,
  setVoiceOn: () => {},
  start: async () => null,
  end: async () => null,
  setSos: async () => null,
  setCrowd: async () => null,
});

const DriverTripContext = createContext(IDLE);

export function DriverTripProvider({ children }) {
  const { user, isAuthenticated, isFullyOnboarded } = useAuth();
  const userId = isAuthenticated && isFullyOnboarded ? user?.id ?? null : null;
  const { summary, refresh: refreshOrgs } = useOrgs();

  // ── The trip (DriverTrip from the API: session, route, orgName, …) ──
  const { data: trip, loading, reload, setData: setTrip } = useLoad(
    userId != null ? `driver-trip-${userId}` : null,
    getActiveTrip,
  );
  const session = trip?.session ?? null;
  const sessionId = session?.id ?? null;

  // The newest trip for callbacks that run outside rendering.
  const tripRef = useRef(null);
  useEffect(() => { tripRef.current = trip || null; });

  // The organizations summary knows about a trip this provider does not
  // hold (started on another device), or the other way round (ended
  // elsewhere) → ask the server which is true. Once per disagreement.
  const knownElsewhere = summary.activeTrip?.id ?? null;
  const checkedRef = useRef(null);
  useEffect(() => {
    if (userId == null || loading) return;
    const signature = `${knownElsewhere}|${sessionId}`;
    if (knownElsewhere === sessionId || checkedRef.current === signature) return;
    checkedRef.current = signature;
    reload();
  }, [userId, loading, knownElsewhere, sessionId, reload]);

  // ── Navigation ──
  // The trip as the navigation engine understands it (the shape of a
  // ride). Built from the trip's fixed facts only, so changing the seats
  // or raising an emergency never restarts the tracker.
  const fromName = session?.fromName ?? null;
  const fromLat = session?.fromLat ?? null;
  const fromLng = session?.fromLng ?? null;
  const destinationName = session?.destinationName ?? null;
  const destinationLat = session?.destinationLat ?? null;
  const destinationLng = session?.destinationLng ?? null;
  const plannedDistance = session?.plannedDistanceMeters ?? null;
  const plannedDuration = session?.plannedDurationSeconds ?? null;
  const routeCoordinates = trip?.route?.routeCoordinates ?? null;
  const routeSteps = trip?.route?.routeSteps ?? null;

  const ride = useMemo(() => (sessionId == null ? null : {
    id: `vs-${sessionId}`,
    status: "active",
    fromName,
    fromLat,
    fromLng,
    destinationName,
    destinationLat,
    destinationLng,
    routeCoordinates,
    routeSteps,
    distanceMeters: plannedDistance,
    durationSeconds: plannedDuration,
  }), [
    sessionId, fromName, fromLat, fromLng, destinationName, destinationLat, destinationLng,
    routeCoordinates, routeSteps, plannedDistance, plannedDuration,
  ]);
  const { nav, pushFix } = useNavigation(ride);

  // GPS and connection status, each remembered together with the trip it
  // belongs to (so a new trip never starts out showing the last one's).
  const [gpsOf, setGpsOf] = useState({ sessionId: null, gps: SEARCHING });
  const [linkOf, setLinkOf] = useState({ sessionId: null, link: "idle" });
  const gps = gpsOf.sessionId === sessionId && sessionId != null ? gpsOf.gps : SEARCHING;
  const link = linkOf.sessionId === sessionId && sessionId != null ? linkOf.link : "idle";

  const [voiceOn, setVoiceOn] = usePersistentFlag("ridewise-voice-guidance", true);
  useVoiceGuidance(nav, voiceOn && sessionId != null);
  useWakeLock(sessionId != null);

  // ── The trip was ended somewhere else ──
  const endingRef = useRef(false); // this device is ending it right now
  const endedElsewhere = useCallback((endedId, message) => {
    const current = tripRef.current;
    if (endingRef.current || !current || current.session.id !== endedId) return;
    tripRef.current = null; // a second notice about the same ending is ignored
    clearNavProgress(`vs-${endedId}`);
    toast.info(message && message !== "This trip has ended"
      ? message
      : `Your trip on ${current.session.vehicleCode} has ended.`);
    setTrip(null);
    refreshOrgs();
  }, [setTrip, refreshOrgs]);

  // ── GPS → navigation → server, for as long as the trip runs ──
  useEffect(() => {
    if (sessionId == null) return undefined;
    let lastSentAt = Date.now();

    const stopDriving = driveFleet({
      onTripEnded: (endedId, message) => endedElsewhere(endedId ?? sessionId, message),
      onStatus: (status) => setLinkOf({ sessionId, link: status }),
    });

    const stopWatching = watchLocation(
      (fix) => {
        pushFix(fix);
        lastSentAt = Date.now();
        if (sendFleetPosition(sessionId, fix)) return;
        // Socket down → the same fix over HTTP. A 409 is the server saying
        // the trip is over.
        postTripPosition(sessionId, fix).catch((err) => {
          if (err?.status === 409 || err?.status === 404) endedElsewhere(sessionId, err.message);
        });
      },
      (status) => setGpsOf({ sessionId, gps: status }),
    );

    const alive = setInterval(() => {
      if (Date.now() - lastSentAt < ALIVE_EVERY_MS) return;
      lastSentAt = Date.now();
      sendFleetAlive(sessionId);
    }, 15_000);

    return () => {
      stopWatching();
      stopDriving();
      clearInterval(alive);
    };
  }, [sessionId, pushFix, endedElsewhere]);

  // ── Actions ──
  const start = useCallback(async (request) => {
    const started = await apiStartTrip(request); // throws the server's reason
    endingRef.current = false;
    setTrip(started);
    refreshOrgs();
    return started;
  }, [setTrip, refreshOrgs]);

  const end = useCallback(async () => {
    if (sessionId == null) return null;
    const finish = () => {
      tripRef.current = null;
      clearNavProgress(`vs-${sessionId}`);
      setTrip(null);
      refreshOrgs();
    };
    endingRef.current = true;
    try {
      const ended = await apiStopTrip(sessionId);
      finish();
      return ended;
    } catch (err) {
      // Already over (an admin ended it a moment ago): that is what was wanted.
      if (err?.status === 404 || err?.status === 409) {
        finish();
        return null;
      }
      throw err;
    } finally {
      endingRef.current = false;
    }
  }, [sessionId, setTrip, refreshOrgs]);

  const patchSession = useCallback((updated) => {
    setTrip((current) => (current && updated && current.session.id === updated.id
      ? { ...current, session: updated }
      : current));
    return updated;
  }, [setTrip]);

  const setSos = useCallback(async (active, message) => {
    if (sessionId == null) return null;
    return patchSession(await setTripSos(sessionId, active, message));
  }, [sessionId, patchSession]);

  const setCrowd = useCallback(async (level) => {
    if (sessionId == null) return null;
    return patchSession(await setTripCrowd(sessionId, level));
  }, [sessionId, patchSession]);

  const value = useMemo(() => ({
    trip: trip || null,
    ride,   // the trip in the shape the ride map draws
    loaded: userId != null && !loading,
    nav,
    gps,
    link,
    voiceOn,
    setVoiceOn,
    start,
    end,
    setSos,
    setCrowd,
  }), [trip, ride, userId, loading, nav, gps, link, voiceOn, setVoiceOn, start, end, setSos, setCrowd]);

  return <DriverTripContext.Provider value={value}>{children}</DriverTripContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDriverTrip() {
  return useContext(DriverTripContext);
}
