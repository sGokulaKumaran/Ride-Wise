// ============================================================
// ActiveRideOverlay.jsx — the full-screen ride map
//
// Two modes, chosen by the ride's status:
//   LIVE     an active ride: GPS tracking, turn-by-turn guidance, group
//            riders, End / Leave
//   SUMMARY  a finished ride opened from history: the route and its numbers
//
// This file ORCHESTRATES; it contains no navigation maths and draws no
// map layers itself:
//
//   locationService      → GPS fixes + GPS status
//   useNavigation        → where the rider is on the route, the next turn,
//                          remaining distance/time, the way back when off
//                          the route, distance ridden
//   useVoiceGuidance     → speaks the instructions
//   useWakeLock          → keeps the screen on
//   RideMap              → draws everything
//   ManeuverBanner       → the next turn (top)
//   RideStatsSheet       → time/distance left + End/Leave (bottom)
//   GroupRidersPanel     → who is riding with me
//   rideSocket / rideApi → live positions of a group ride
//
// PROPS
//   ride          the ride (from Home)
//   onClose       close the map — the ride stays active
//   onEnd         async ({ distanceTraveled }) → true when the ride was ended
//   onLeave       called after this rider left a group ride
//   onRideEnded   called when the ride was ended by someone else (the admin)
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import RideMap from "./RideMap";
import DirectionsPanel from "./DirectionsPanel";
import GroupRidersPanel from "./GroupRidersPanel";
import ManeuverBanner from "./ManeuverBanner";
import RideStatsSheet from "./RideStatsSheet";
import Icon from "../ui/Icon";
import { IconButton } from "../ui/Button";
import { GPS, watchLocation } from "../../../services/locationService";
import {
  formatDistance,
  formatDuration,
  shortPlaceName,
} from "../../../services/routingApi";
import { parseSteps } from "../../../services/navigation";
import {
  updateUserLocation,
  getGroupRideParticipants,
  updateParticipantStatus,
  getLiveRideLocations,
  clearLiveLocation,
  getRideStatus,
} from "../../../services/rideApi";
import {
  connectRideSocket,
  sendRideLocation,
  sendRideStop,
  closeRideSocket,
} from "../../../services/rideSocket";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../hooks/useTheme";
import { useNavigation, clearNavProgress } from "../../hooks/useNavigation";
import { useRiderRejoinLines } from "../../hooks/useRiderRejoinLines";
import {
  usePersistentFlag,
  useVoiceGuidance,
  useWakeLock,
  voiceSupported,
} from "../../hooks/useRideAssist";
import { RIDER_COLORS } from "./mapStyles";

// A rider whose position has not been refreshed within this window is shown
// as "no GPS" instead of a stale marker.
const LOCATION_STALE_MS = 35_000;

// Normalise a server location payload into the shape the map expects.
// receivedAt is CLIENT time, so staleness never depends on server clock skew.
function toLocationEntry(loc) {
  return {
    lat: loc.lat,
    lng: loc.lng,
    accuracy: loc.accuracy ?? null,
    receivedAt: Date.now(),
  };
}

// Rebuild the userId-keyed location map from a full server snapshot.
//
// REPLACE (not merge) on purpose: the backend returns exactly one row per
// rider that is currently sharing, so anyone missing from the list has
// stopped sharing / left and their marker must disappear.
function replaceLocations(list) {
  const next = {};
  (list || []).forEach((loc) => {
    if (loc && loc.userId != null && loc.lat != null && loc.lng != null) {
      next[loc.userId] = toLocationEntry(loc);
    }
  });
  return next;
}

// How each GPS status is presented (GPS.OK shows nothing).
const GPS_CHIP = {
  [GPS.SEARCHING]:   { icon: "spinner", tone: "neutral", spin: true },
  [GPS.WEAK]:        { icon: "alertTriangle", tone: "warn" },
  [GPS.LOST]:        { icon: "gpsOff", tone: "danger" },
  [GPS.DENIED]:      { icon: "gpsOff", tone: "danger" },
  [GPS.UNSUPPORTED]: { icon: "gpsOff", tone: "danger" },
};

// A status line under the turn banner.
function StatusChip({ icon, tone = "neutral", spin = false, tc, children }) {
  const toneClass = {
    neutral: `${tc.card} ${tc.sub}`,
    warn: tc.warnSoft,
    danger: tc.dangerSoft,
    rejoin: tc.rejoinSoft,
  }[tone];
  return (
    <div
      role="status"
      className={`pointer-events-auto mx-auto flex w-fit max-w-full items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm ${toneClass}`}
    >
      <Icon name={icon} size={15} className={spin ? "rw-spin" : ""} />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

export default function ActiveRideOverlay({ ride, onClose, onEnd, onLeave, onRideEnded }) {
  const { user } = useAuth();
  const myId = user?.id;
  const { tc } = useTheme(myId);

  // Completed/cancelled rides open as a summary: no GPS is started.
  const isActiveRide = ride?.status === "active";
  const isGroupRide = ride?.rideType === "group";
  const rideId = ride?.id;

  // ── GPS + navigation ──
  const [gps, setGps] = useState({ state: GPS.SEARCHING, message: "Searching for GPS…" });
  const { nav, pushFix } = useNavigation(ride);

  // ── Hands-free helpers ──
  const [voiceOn, setVoiceOn] = usePersistentFlag("ridewise-voice-guidance", true);
  useVoiceGuidance(nav, voiceOn && isActiveRide);
  useWakeLock(isActiveRide);

  // ── UI state ──
  const [minimized, setMinimized] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showDirections, setShowDirections] = useState(false);
  const [arrivalDismissed, setArrivalDismissed] = useState(false);
  const [miniPosition, setMiniPosition] = useState(null);
  // Measured heights of the top and bottom bars. The map keeps the rider
  // and every control inside the area between them, on any screen size.
  const [bars, setBars] = useState({ top: 104, bottom: 170 });

  // ── Group ride state ──
  const [participants, setParticipants] = useState([]);
  const [participantLocations, setParticipantLocations] = useState({});
  const [shareChoice, setShareChoice] = useState(false);       // a member's opt-in
  const [socketStatus, setSocketStatus] = useState("idle");    // idle|connected|disconnected|error
  const [nowTs, setNowTs] = useState(0);                        // tick that ages out stale pins

  const mapRef = useRef(null);
  const topRef = useRef(null);
  const bottomRef = useRef(null);
  const miniDragRef = useRef({ pointerId: null, offsetX: 0, offsetY: 0, moved: false });
  const endedRef = useRef(false);    // the "ride ended somewhere else" path runs once
  const localEndRef = useRef(false); // this rider is ending / leaving the ride right here
  const knownRidersRef = useRef(null); // userId → name of the riders last seen (null: not loaded yet)

  // ====================================================================
  // ROLES (group rides)
  // Admin = ride creator OR a participant with role "admin".
  //   • Admin            → "End ride"
  //   • Other members    → "Leave ride"
  //   • Solo rides       → the creator sees "End ride"
  // ====================================================================
  const isAdmin = !isGroupRide
    ? true
    : String(ride?.userId) === String(user?.id) ||
      participants.some((p) => String(p.userId) === String(user?.id) && p.role === "admin");
  const action = !isActiveRide ? null : isGroupRide && !isAdmin ? "leave" : "end";

  // The admin's position is always shared with the group (it needs to see
  // where the ride is); other members opt in with the Share button.
  const sharing = isGroupRide && isActiveRide && (isAdmin || shareChoice);
  const sharingRef = useRef(false);
  useEffect(() => { sharingRef.current = sharing; }, [sharing]);

  // ============================================================
  // STOP SHARING — remove my live position from the group
  // Both legs run on purpose and are idempotent on the server:
  //   • the WebSocket message is instant while the socket is up
  //   • the REST call always works, even after the socket is closed
  // ============================================================
  const stopSharingNow = useCallback((id) => {
    if (!id) return;
    sendRideStop(id);
    clearLiveLocation(id);
  }, []);

  // Leaving the map means this rider stopped tracking, so their position
  // must not linger on other riders' maps.
  useEffect(() => {
    if (!isGroupRide || !rideId) return undefined;
    return () => {
      if (sharingRef.current) clearLiveLocation(rideId); // REST only — the socket is closing anyway
    };
  }, [rideId, isGroupRide]);

  // ====================================================================
  // BAR HEIGHTS → padding for the map
  // ====================================================================
  useEffect(() => {
    if (minimized) return undefined;
    const measure = () => {
      const top = Math.round(topRef.current?.getBoundingClientRect().height ?? 0);
      const bottom = Math.round(bottomRef.current?.getBoundingClientRect().height ?? 0);
      setBars((previous) =>
        previous.top === top && previous.bottom === bottom ? previous : { top, bottom });
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (observer) {
      if (topRef.current) observer.observe(topRef.current);
      if (bottomRef.current) observer.observe(bottomRef.current);
    }
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [minimized, isActiveRide]);

  // ====================================================================
  // GPS — started for active rides only, stopped when the map closes.
  //
  // Every rider sees their OWN dot (needed to navigate). The position is
  // SENT to the server only while `sharing` is on, so a member who has
  // not opted in stays invisible to the group.
  // ====================================================================
  useEffect(() => {
    if (!isActiveRide) return undefined;

    const stop = watchLocation(
      (fix) => {
        pushFix(fix);

        if (rideId && sharingRef.current) {
          const sentOverSocket = sendRideLocation(fix, rideId);
          if (!sentOverSocket) updateUserLocation(rideId, fix.lat, fix.lng, fix.accuracy);
        }
      },
      (status) => setGps(status),
    );
    return stop;
  }, [isActiveRide, rideId, pushFix]);

  // ====================================================================
  // THE RIDE ENDED SOMEWHERE ELSE (the admin, or this rider's other device)
  // Members used to keep "navigating" a ride that no longer existed until
  // they reloaded the page.
  //
  // The server tells EVERY watcher, including the rider who tapped
  // "End ride" here. That echo of our own action is ignored — handleAction
  // already finishes the ride on this screen.
  // ====================================================================
  const handleRemoteEnd = useCallback((status, endedBy) => {
    if (endedRef.current || localEndRef.current) return;
    endedRef.current = true;
    clearNavProgress(rideId);
    closeRideSocket();
    const byMe = endedBy != null && String(endedBy) === String(myId);
    toast.info(
      byMe ? "You ended this ride on another device."
        : status === "deleted" || status === "gone" ? "This ride was removed by the ride admin."
        : status === "cancelled" ? "This ride was cancelled by the ride admin."
        : endedBy == null && status === "completed" ? "This ride has ended."
        : "The ride admin ended this ride.",
    );
    onRideEnded?.();
  }, [rideId, myId, onRideEnded]);

  // ====================================================================
  // PARTICIPANTS — initial fetch + live refresh
  // The endpoint returns ACTIVE riders only, so re-fetching drops riders
  // who left and picks up riders the admin adds mid-ride.
  // ====================================================================
  const refreshParticipants = useCallback(() => {
    if (!isGroupRide || !rideId) return;
    getGroupRideParticipants(rideId)
      .then((list) => {
        if (!list) return;

        // Say who joined or left since the last list — riders have their
        // eyes on the road, not on the riders panel. (Nothing is said for
        // the first list, or about this rider themselves.)
        const next = new Map(list.map((p) => [String(p.userId), p.username || "A rider"]));
        const known = knownRidersRef.current;
        // An empty list, or a ride that is ending, is the ride being over —
        // not every rider "leaving" one by one.
        const rideOver = endedRef.current || localEndRef.current || next.size === 0;
        if (known && isActiveRide && !rideOver) {
          const me = String(myId);
          next.forEach((name, id) => {
            if (!known.has(id) && id !== me) toast.info(`${name} joined the ride.`);
          });
          known.forEach((name, id) => {
            if (!next.has(id) && id !== me) toast.info(`${name} left the ride.`);
          });
        }
        knownRidersRef.current = next;

        setParticipants(list);
      })
      .catch(() => {});
  }, [rideId, isGroupRide, isActiveRide, myId]);

  useEffect(() => {
    refreshParticipants();
  }, [refreshParticipants]);

  // While live: refresh the list every 10 s, and check that the ride is
  // still running (the fallback for when the socket's "ride ended" event
  // could not be delivered).
  useEffect(() => {
    if (!isActiveRide || !isGroupRide || !rideId) return undefined;
    const interval = setInterval(() => {
      refreshParticipants();
      getRideStatus(rideId).then((status) => {
        if (status && status !== "active") handleRemoteEnd(status, null);
      });
    }, 10_000);
    return () => clearInterval(interval);
  }, [isActiveRide, isGroupRide, rideId, refreshParticipants, handleRemoteEnd]);

  // ── Member positions: REST snapshot when the map opens … ──
  useEffect(() => {
    if (!isGroupRide || !rideId) return undefined;
    let cancelled = false;
    getLiveRideLocations(rideId).then((list) => {
      // null = the request failed → keep what is already shown
      if (!cancelled && list) setParticipantLocations(replaceLocations(list));
    });
    return () => { cancelled = true; };
  }, [isGroupRide, rideId]);

  // ── … polling while the WebSocket is NOT connected … ──
  useEffect(() => {
    if (!isGroupRide || !isActiveRide || !rideId || socketStatus === "connected") return undefined;
    const interval = setInterval(() => {
      getLiveRideLocations(rideId).then((list) => {
        if (list) setParticipantLocations(replaceLocations(list));
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [isGroupRide, isActiveRide, rideId, socketStatus]);

  // ── … and live updates over the WebSocket. ──
  useEffect(() => {
    if (!isGroupRide || !isActiveRide || !rideId) return undefined;

    connectRideSocket(rideId, {
      onSnapshot: (list) => setParticipantLocations(replaceLocations(list)),
      onLocation: (loc) => {
        if (loc && loc.userId != null && loc.lat != null && loc.lng != null) {
          setParticipantLocations((prev) => ({ ...prev, [loc.userId]: toLocationEntry(loc) }));
        }
      },
      onLocationCleared: (userId) => {
        setParticipantLocations((prev) => {
          if (!(userId in prev)) return prev;
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      },
      onParticipantsChanged: refreshParticipants,
      onRideEnded: handleRemoteEnd,
      onStatus: setSocketStatus,
      onError: (message) => console.warn("[ActiveRideOverlay] location socket:", message),
    });

    return () => closeRideSocket();
  }, [isGroupRide, isActiveRide, rideId, refreshParticipants, handleRemoteEnd]);

  // Re-render every 5 s so a rider whose updates stopped flips to "no GPS"
  // instead of freezing on their last point.
  useEffect(() => {
    if (!isGroupRide || !isActiveRide) return undefined;
    const interval = setInterval(() => setNowTs(Date.now()), 5000);
    return () => clearInterval(interval);
  }, [isGroupRide, isActiveRide]);

  // Only REAL, still-fresh positions become map pins. A rider with no fix —
  // or a stale one — gets no coordinate at all.
  const riders = useMemo(() => {
    if (!isGroupRide) return [];
    return participants.map((p, index) => {
      const loc = participantLocations[p.userId];
      const fresh = Boolean(loc) && (nowTs === 0 || nowTs - loc.receivedAt < LOCATION_STALE_MS);
      return {
        ...p,
        lat: fresh ? loc.lat : null,
        lng: fresh ? loc.lng : null,
        accuracy: fresh ? loc.accuracy : null,
        locationUnavailable: !fresh,
        color: RIDER_COLORS[index % RIDER_COLORS.length],
      };
    });
  }, [isGroupRide, participants, participantLocations, nowTs]);

  const otherRiders = useMemo(
    () => riders.filter((rider) => String(rider.userId) !== String(user?.id)),
    [riders, user?.id],
  );
  const { status: riderStatus, lines: riderLines } = useRiderRejoinLines(
    nav.route, otherRiders, isActiveRide && isGroupRide,
  );

  // ====================================================================
  // ACTIONS
  // ====================================================================

  // A member turns sharing on/off. Turning it off removes the stored
  // position, so the group sees "no GPS" immediately.
  const toggleSharing = () => {
    const next = !shareChoice;
    setShareChoice(next);
    if (!next) stopSharingNow(rideId);
  };

  // End (admin / solo) or Leave (member): first tap asks, second confirms.
  const handleAction = async () => {
    // A solo rider who has arrived is asked once: "End ride" there can only
    // mean one thing. Mid-ride — or when it ends the ride for a whole group —
    // a second tap guards against a slip of the thumb.
    const oneTap = action === "end" && !isGroupRide && nav.status === "arrived";
    if (!confirming && !oneTap) { setConfirming(true); return; }
    setBusy(true);
    // From here on, "the ride ended" news from the server is our own doing.
    localEndRef.current = true;

    if (action === "end") {
      // Home sends the real distance ridden with the "completed" status.
      const ended = await onEnd({ distanceTraveled: nav.traveled });
      if (ended) {
        stopSharingNow(rideId);
        clearNavProgress(rideId);
        return; // Home has closed the map
      }
    } else {
      try {
        await updateParticipantStatus(rideId, user?.id, "left");
        stopSharingNow(rideId);
        closeRideSocket();
        clearNavProgress(rideId);
        if (onLeave) onLeave();
        else onClose?.();
        return;
      } catch (err) {
        toast.error(err.message || "Couldn't leave the ride. Please try again.");
      }
    }
    // Still here → it did not go through; the ride carries on.
    localEndRef.current = false;
    setBusy(false);
    setConfirming(false);
  };

  // ── Minimized pill: tap to reopen, drag to move ──
  const handleMiniPointerDown = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    miniDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleMiniPointerMove = (event) => {
    const drag = miniDragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    // A few pixels of wobble while tapping is not a drag
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
    drag.moved = true;
    setMiniPosition({
      left: Math.min(Math.max(8, event.clientX - drag.offsetX), window.innerWidth - drag.width - 8),
      top: Math.min(Math.max(8, event.clientY - drag.offsetY), window.innerHeight - drag.height - 8),
    });
  };

  const handleMiniPointerUp = (event) => {
    const drag = miniDragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    miniDragRef.current.pointerId = null;
    if (!drag.moved) setMinimized(false);
  };

  // ====================================================================
  // DERIVED DISPLAY VALUES
  // ====================================================================
  const fromName = shortPlaceName(ride?.fromName, "Start");
  const destName = shortPlaceName(ride?.destinationName, "Destination");
  const steps = useMemo(
    () => nav.route?.steps ?? parseSteps(ride?.routeSteps),
    [nav.route, ride?.routeSteps],
  );
  const offRoute = isActiveRide && nav.status === "off-route";
  const arrived = isActiveRide && nav.status === "arrived";
  const sheetMode = !isActiveRide ? "summary" : arrived && !arrivalDismissed ? "arrived" : "live";
  const gpsChip = isActiveRide ? GPS_CHIP[gps.state] : null;
  // Speed is shown only while it is live: not once arrived, and not when
  // the GPS has gone quiet (the last value would just sit there).
  const speedKmh =
    Number.isFinite(nav.speed) && !arrived && (gps.state === GPS.OK || gps.state === GPS.WEAK)
      ? Math.round(nav.speed * 3.6)
      : null;

  // ====================================================================
  // MINIMIZED — a small draggable pill; tracking and voice carry on
  // ====================================================================
  if (minimized) {
    return (
      <div
        role="button"
        tabIndex={0}
        title="Tap to reopen the map · drag to move"
        aria-label="Reopen the ride map"
        className={`fixed z-[999] flex h-12 cursor-grab touch-none select-none items-center gap-2.5 rounded-full border pl-3.5 pr-4 shadow-lg ${tc.mapControl} ${
          miniPosition ? "" : "bottom-[84px] right-4 lg:bottom-6"
        }`}
        style={miniPosition ? { left: `${miniPosition.left}px`, top: `${miniPosition.top}px` } : undefined}
        onPointerDown={handleMiniPointerDown}
        onPointerMove={handleMiniPointerMove}
        onPointerUp={handleMiniPointerUp}
        onPointerCancel={handleMiniPointerUp}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setMinimized(false); }
        }}
      >
        {isActiveRide && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
        )}
        <Icon name="map" size={18} />
        <span className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold">
            {isActiveRide ? `To ${destName}` : "Ride map"}
          </span>
          {isActiveRide && nav.remainingDistance != null && (
            <span className={`text-[11px] ${tc.sub}`}>
              {formatDistance(nav.remainingDistance)} left
            </span>
          )}
        </span>
      </div>
    );
  }

  // ====================================================================
  // FULL SCREEN
  // ====================================================================
  const mapButton =
    `flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${tc.mapControl}`;

  return (
    <div className={`fixed inset-0 z-[999] ${tc.bg} ${tc.text}`}>
      {/* ── MAP ── */}
      <div className="absolute inset-0">
        <RideMap
          ref={mapRef}
          ride={ride}
          nav={isActiveRide ? nav : null}
          isLive={isActiveRide}
          gpsState={gps.state}
          participants={riders}
          currentUserId={user?.id}
          riderLines={riderLines}
          riderStatus={riderStatus}
          padding={bars}
          tc={tc}
          extraControls={
            <>
              {isActiveRide && voiceSupported && (
                <button
                  type="button"
                  className={mapButton}
                  aria-pressed={voiceOn}
                  title={voiceOn ? "Voice guidance is on — tap to mute" : "Voice guidance is off — tap to turn on"}
                  aria-label={voiceOn ? "Mute voice guidance" : "Turn on voice guidance"}
                  onClick={() => setVoiceOn((on) => !on)}
                >
                  <Icon name={voiceOn ? "volume" : "volumeOff"} size={19} className={voiceOn ? "" : tc.sub} />
                </button>
              )}
              {steps.length > 0 && (
                <button
                  type="button"
                  className={mapButton}
                  title="All directions"
                  aria-label="Show all directions"
                  onClick={() => setShowDirections(true)}
                >
                  <Icon name="list" size={19} />
                </button>
              )}
            </>
          }
        />
      </div>

      {/* ── TOP: next turn (live) or ride title (summary) + status ── */}
      <div
        ref={topRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-[1100] px-3 pb-1"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <div className="mx-auto w-full max-w-xl space-y-2">
          {isActiveRide ? (
            <ManeuverBanner
              nav={nav}
              destination={destName}
              tc={tc}
              onMinimize={() => setMinimized(true)}
              onClose={onClose}
            />
          ) : (
            <div className={`pointer-events-auto flex items-center gap-3 rounded-xl border p-3 shadow-sm ${tc.card}`}>
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
                <Icon name="route" size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{fromName} → {destName}</p>
                <p className={`truncate text-xs ${tc.sub}`}>
                  <span className="capitalize">{ride?.status || "completed"}</span> ·{" "}
                  {ride?.rideType === "group" ? "Group ride" : "Solo ride"} ·{" "}
                  {formatDistance(ride?.distanceMeters)} route
                </p>
              </div>
              <IconButton icon="close" label="Close map" size="sm" tc={tc} onClick={onClose} />
            </div>
          )}

          {gpsChip && (
            <StatusChip icon={gpsChip.icon} tone={gpsChip.tone} spin={gpsChip.spin} tc={tc}>
              {gps.message}
            </StatusChip>
          )}

          {/* Away from the route. "Not on your route yet" while the rider has
              not reached it once (a ride that starts in a car park); "Off
              route" after that. */}
          {offRoute && (
            <StatusChip icon="maneuverMerge" tone="rejoin" tc={tc}>
              {nav.rejoin
                ? `${nav.joining ? "Not on your route yet" : "Off route"} — follow the purple line${
                    nav.rejoin.distance > 0
                      ? ` · ${formatDistance(nav.rejoin.distance)} to ${nav.joining ? "go" : "rejoin"}`
                      : ""
                  }`
                : nav.joining ? "Finding the way to your route…" : "Off route — finding the way back…"}
            </StatusChip>
          )}

          {ride?.routePending && (
            <StatusChip icon="spinner" spin tc={tc}>Loading the route…</StatusChip>
          )}

          {isActiveRide && !nav.hasRoute && !ride?.routePending && (
            <StatusChip icon="info" tc={tc}>
              No saved route for this ride — showing the straight-line distance
            </StatusChip>
          )}
        </div>
      </div>

      {/* ── GROUP: riders + my sharing switch (top-left, under the banner) ── */}
      {isGroupRide && riders.length > 0 && (
        <GroupRidersPanel
          participants={riders}
          currentUserId={user?.id}
          riderStatus={riderStatus}
          isAdmin={isAdmin}
          rideId={isActiveRide ? rideId : null}
          sharing={sharing}
          onParticipantsChanged={refreshParticipants}
          tc={tc}
          style={{ top: `${bars.top + 12}px`, left: "12px" }}
          // Look at that rider once — follow mode is released, never re-armed
          onRiderClick={(rider) => mapRef.current?.panTo(rider.lat, rider.lng)}
        />
      )}

      {isGroupRide && isActiveRide && !isAdmin && (
        <button
          type="button"
          onClick={toggleSharing}
          aria-pressed={shareChoice}
          title={shareChoice
            ? "Your live location is visible to the group — tap to stop"
            : "Let the group see where you are"}
          className={`absolute z-[1050] flex h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold ${
            shareChoice ? tc.okSoft : tc.mapControl
          }`}
          style={{ top: `${bars.top + 64}px`, left: "12px" }}
        >
          <Icon name="navigate" size={16} />
          {shareChoice
            ? socketStatus === "connected" ? "Sharing location" : "Sharing · reconnecting…"
            : "Share my location"}
        </button>
      )}

      {/* ── Speed (bottom-left, above the sheet) ── */}
      {isActiveRide && speedKmh != null && (
        <div
          className={`absolute left-3 z-[1050] flex h-14 w-14 flex-col items-center justify-center rounded-full border ${tc.mapControl}`}
          style={{ bottom: `${bars.bottom + 24}px` }}
          aria-label={`Speed ${speedKmh} kilometres per hour`}
        >
          <span className="text-lg font-bold leading-none tabular-nums">{speedKmh}</span>
          <span className={`mt-0.5 text-[9px] font-medium uppercase tracking-wider ${tc.sub}`}>km/h</span>
        </div>
      )}

      {/* ── BOTTOM: numbers + End / Leave ── */}
      <RideStatsSheet
        ref={bottomRef}
        mode={sheetMode}
        nav={nav}
        ride={ride}
        tc={tc}
        action={action}
        confirming={confirming}
        busy={busy}
        onAction={handleAction}
        onCancel={() => setConfirming(false)}
        onClose={onClose}
        onKeepRiding={() => setArrivalDismissed(true)}
        riderCount={isGroupRide && participants.length > 0 ? participants.length : null}
      />

      {/* ── All directions ── */}
      {showDirections && (
        <DirectionsPanel
          steps={steps}
          activeIndex={isActiveRide ? nav.stepIndex : -1}
          activeDistance={isActiveRide && !offRoute ? nav.stepDistance : null}
          offRoute={offRoute}
          joining={offRoute && nav.joining}
          summary={
            isActiveRide && nav.remainingDistance != null
              ? `${formatDistance(nav.remainingDistance)} · ${formatDuration(nav.remainingTime)} left`
              : `${formatDistance(ride?.distanceMeters)} · ${formatDuration(ride?.durationSeconds)}`
          }
          destName={destName}
          onClose={() => setShowDirections(false)}
          tc={tc}
        />
      )}
    </div>
  );
}
