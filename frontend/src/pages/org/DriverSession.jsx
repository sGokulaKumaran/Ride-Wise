// ============================================================
// DriverSession — the map of the trip I am driving
// Route: /driver/session (protected)
//
// The same navigation screen a rider gets (RideMap, the next-turn banner,
// spoken directions, the purple way back when off the route) — plus what
// a driver of a shared vehicle needs:
//   • how full the vehicle is, one tap, shown to everyone waiting
//   • an emergency button that alerts the organization's admins at once
//   • End trip, which frees the vehicle for the next driver
//
// This screen only DISPLAYS. The trip itself — GPS, sending positions,
// the navigation state — is run by DriverTripContext for the whole app,
// so leaving this screen (the "minimize" button, or any other page) does
// NOT stop the vehicle from reporting where it is. Only "End trip" does.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { useDriverTrip } from "../../context/DriverTripContext";
import { useTheme } from "../hooks/useTheme";
import { voiceSupported } from "../hooks/useRideAssist";
import RideMap from "../components/ride/RideMap";
import ManeuverBanner from "../components/ride/ManeuverBanner";
import DirectionsPanel from "../components/ride/DirectionsPanel";
import Icon from "../components/ui/Icon";
import Button, { Chip } from "../components/ui/Button";
import { ErrorNote, Figure, Loading, MapChip, Modal, TextArea } from "../components/org/kit";
import { CROWD_LEVELS, tripTitle } from "../components/org/fleetUi";
import { GPS } from "../../services/locationService";
import {
  formatClock, formatDistance, formatDuration, shortPlaceName,
} from "../../services/routingApi";

const GPS_CHIP = {
  [GPS.SEARCHING]:   { icon: "spinner", tone: "neutral", spin: true },
  [GPS.WEAK]:        { icon: "alertTriangle", tone: "warn" },
  [GPS.LOST]:        { icon: "gpsOff", tone: "danger" },
  [GPS.DENIED]:      { icon: "gpsOff", tone: "danger" },
  [GPS.UNSUPPORTED]: { icon: "gpsOff", tone: "danger" },
};

export default function DriverSession() {
  const { user } = useAuth();
  const { tc } = useTheme(user?.id);
  const navigate = useNavigate();
  const { trip, ride, loaded, nav, gps, link, voiceOn, setVoiceOn, end, setSos, setCrowd } = useDriverTrip();

  const session = trip?.session ?? null;
  const sessionId = session?.id ?? null;
  const stops = trip?.route?.stops ?? null;

  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showSos, setShowSos] = useState(false);
  const [showDirections, setShowDirections] = useState(false);
  const [savingCrowd, setSavingCrowd] = useState(null);
  const [bars, setBars] = useState({ top: 104, bottom: 250 });

  const topRef = useRef(null);
  const bottomRef = useRef(null);
  const ready = sessionId != null;
  useEffect(() => {
    if (!ready) return undefined;
    const measure = () => {
      const top = Math.round(topRef.current?.getBoundingClientRect().height ?? 0);
      const bottom = Math.round(bottomRef.current?.getBoundingClientRect().height ?? 0);
      setBars((previous) => (previous.top === top && previous.bottom === bottom ? previous : { top, bottom }));
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
  }, [ready]);

  if (!loaded) {
    return (
      <div className={`flex min-h-screen items-center justify-center p-4 ${tc.bg} ${tc.text}`}>
        <div className="w-full max-w-sm"><Loading label="Opening your trip…" tc={tc} /></div>
      </div>
    );
  }
  // No trip (it was ended here, by an admin, or automatically) → the driver's page.
  if (!trip || !nav) return <Navigate to="/driver" replace />;

  const destName = shortPlaceName(session.destinationName, "the destination");
  const steps = nav.route?.steps ?? [];
  const offRoute = nav.status === "off-route";
  const arrived = nav.status === "arrived";
  const gpsChip = GPS_CHIP[gps.state];
  const speedKmh =
    Number.isFinite(nav.speed) && !arrived && (gps.state === GPS.OK || gps.state === GPS.WEAK)
      ? Math.round(nav.speed * 3.6)
      : null;
  const limit = trip.speedLimitKmh;
  const tooFast = limit != null && speedKmh != null && speedKmh > limit + 3;
  const percent = Math.round(Math.min(1, Math.max(0, nav.fraction ?? 0)) * 100);
  const leave = () => navigate("/driver");

  const endTrip = async () => {
    if (!confirmEnd && !arrived) { setConfirmEnd(true); return; }
    setEnding(true);
    try {
      const ended = await end();
      toast.success(ended?.distanceMeters > 0
        ? `Trip ended — ${formatDistance(ended.distanceMeters)} driven. ${session.vehicleCode} is free again.`
        : `Trip ended. ${session.vehicleCode} is free again.`);
      // DriverTripContext now has no trip → this screen redirects to /driver.
    } catch (err) {
      toast.error(err.message || "Couldn't end the trip. Please try again.");
      setEnding(false);
      setConfirmEnd(false);
    }
  };

  const chooseCrowd = async (level) => {
    const next = session.crowdLevel === level ? "UNKNOWN" : level; // tap again to clear
    setSavingCrowd(level);
    try {
      await setCrowd(next);
    } catch (err) {
      toast.error(err.message || "Couldn't update the seats.");
    } finally {
      setSavingCrowd(null);
    }
  };

  const clearSos = async () => {
    try {
      await setSos(false);
      toast.info("Emergency cleared.");
    } catch (err) {
      toast.error(err.message || "Couldn't clear the emergency.");
    }
  };

  const mapButton =
    `flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${tc.mapControl}`;

  return (
    <div className={`fixed inset-0 z-[900] ${tc.bg} ${tc.text}`}>
      {/* ── MAP ── */}
      <div className="absolute inset-0">
        <RideMap
          ride={ride}
          nav={nav}
          isLive
          gpsState={gps.state}
          stops={stops}
          padding={bars}
          tc={tc}
          extraControls={
            <>
              {voiceSupported && (
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
                <button type="button" className={mapButton} title="All directions" aria-label="Show all directions"
                  onClick={() => setShowDirections(true)}>
                  <Icon name="list" size={19} />
                </button>
              )}
            </>
          }
        />
      </div>

      {/* ── TOP: the next turn, then anything the driver must know ── */}
      <div
        ref={topRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-[1100] px-3 pb-1"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <div className="mx-auto w-full max-w-xl space-y-2">
          <ManeuverBanner nav={nav} destination={destName} tc={tc} onMinimize={leave} onClose={leave} verb="Drive" />

          {session.sosActive && (
            <MapChip icon="sos" tone="danger" tc={tc}>Emergency raised — your admins were told</MapChip>
          )}
          {gpsChip && (
            <MapChip icon={gpsChip.icon} tone={gpsChip.tone} spin={gpsChip.spin} tc={tc}>{gps.message}</MapChip>
          )}
          {tooFast && (
            <MapChip icon="gauge" tone="warn" tc={tc}>
              Over your organization&apos;s limit of {limit} km/h
            </MapChip>
          )}
          {offRoute && (
            <MapChip icon="maneuverMerge" tone="rejoin" tc={tc}>
              {nav.rejoin
                ? `${nav.joining ? "Not on the route yet" : "Off route"} — follow the purple line${
                  nav.rejoin.distance > 0 ? ` · ${formatDistance(nav.rejoin.distance)}` : ""}`
                : nav.joining ? "Finding the way to the route…" : "Off route — finding the way back…"}
            </MapChip>
          )}
          {link === "disconnected" && (
            <MapChip icon="refresh" tc={tc}>Weak connection — your position is still being sent</MapChip>
          )}
        </div>
      </div>

      {/* ── Speed ── */}
      {speedKmh != null && (
        <div
          className={`absolute left-3 z-[1050] flex h-14 w-14 flex-col items-center justify-center rounded-full border ${
            tooFast ? tc.warnSoft : tc.mapControl}`}
          style={{ bottom: `${bars.bottom + 24}px` }}
          aria-label={`Speed ${speedKmh} kilometres per hour`}
        >
          <span className="text-lg font-bold leading-none tabular-nums">{speedKmh}</span>
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wider opacity-70">km/h</span>
        </div>
      )}

      {/* ── BOTTOM: the numbers, the seats, emergency, end ── */}
      <div
        ref={bottomRef}
        className={`absolute inset-x-0 bottom-0 z-[1100] overflow-hidden rounded-t-xl border border-b-0 ${tc.card}`}
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <div className={`h-1 w-full ${tc.surface2}`} role="progressbar" aria-label="Route completed"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <div className="h-full rounded-r-full bg-[#2F6FED] transition-[width] duration-700 ease-linear"
            style={{ width: `${percent}%` }} />
        </div>

        <div className="mx-auto w-full max-w-xl px-4 pt-3">
          {arrived ? (
            <div className="flex items-center gap-3">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${tc.okSoft}`}>
                <Icon name="finish" size={24} />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-tight">You&apos;ve arrived</p>
                <p className={`truncate text-sm ${tc.sub}`}>{formatDistance(nav.traveled)} driven · {destName}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <Figure strong tc={tc} label="Time left" value={formatDuration(nav.remainingTime)} />
              <span className={`mt-1 h-9 w-px shrink-0 ${tc.hairline}`} />
              <Figure strong tc={tc} label="Distance" value={formatDistance(nav.remainingDistance)} />
              <span className={`mt-1 h-9 w-px shrink-0 ${tc.hairline}`} />
              <Figure strong tc={tc} label="Arrival" value={formatClock(nav.eta)} />
            </div>
          )}

          <p className={`mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-xs ${tc.sub}`}>
            <span className={`font-semibold ${tc.text}`}>{session.vehicleCode}</span>
            <span aria-hidden="true">·</span>
            <span className="max-w-[45vw] truncate">{trip.orgName}</span>
            <span aria-hidden="true">·</span>
            <span className="max-w-[45vw] truncate">{tripTitle(session)}</span>
            {!arrived && (
              <>
                <span aria-hidden="true">·</span>
                <span>Driven {formatDistance(nav.traveled)}</span>
              </>
            )}
          </p>

          {/* Seats — what people waiting want to know */}
          <div className="mt-3 flex items-center gap-2">
            <span className={`flex shrink-0 items-center gap-1.5 text-xs font-semibold ${tc.sub}`}>
              <Icon name="seat" size={14} />
              Seats
            </span>
            <div className="scrollbar-hide flex min-w-0 flex-1 gap-1.5 overflow-x-auto" role="radiogroup" aria-label="How full is the vehicle?">
              {CROWD_LEVELS.map((level) => (
                <Chip
                  key={level.id}
                  selected={session.crowdLevel === level.id}
                  tc={tc}
                  className="shrink-0"
                  disabled={savingCrowd != null}
                  onClick={() => chooseCrowd(level.id)}
                >
                  {level.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Emergency · End trip */}
          <div className="mt-3">
            {confirmEnd ? (
              <>
                <p className={`mb-2 text-center text-xs ${tc.sub}`}>
                  End this trip? {session.vehicleCode} stops being shown as live and is free for the next driver.
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="lg" full tc={tc} disabled={ending} onClick={() => setConfirmEnd(false)}>
                    Keep driving
                  </Button>
                  <Button variant="danger" size="lg" full tc={tc} icon="finish" loading={ending} onClick={endTrip}>
                    {ending ? "Ending…" : "End trip"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex gap-2">
                {session.sosActive ? (
                  <Button variant="danger" size="lg" tc={tc} icon="sos" onClick={clearSos} className="shrink-0">
                    Clear
                  </Button>
                ) : (
                  <Button variant="danger" size="lg" tc={tc} icon="sos" onClick={() => setShowSos(true)} className="shrink-0">
                    SOS
                  </Button>
                )}
                <Button variant={arrived ? "primary" : "secondary"} size="lg" full tc={tc} icon="finish"
                  loading={ending} onClick={endTrip}>
                  {ending ? "Ending…" : "End trip"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showDirections && (
        <DirectionsPanel
          steps={steps}
          activeIndex={nav.stepIndex}
          activeDistance={!offRoute ? nav.stepDistance : null}
          offRoute={offRoute}
          joining={offRoute && nav.joining}
          summary={nav.remainingDistance != null
            ? `${formatDistance(nav.remainingDistance)} · ${formatDuration(nav.remainingTime)} left`
            : ""}
          destName={destName}
          onClose={() => setShowDirections(false)}
          tc={tc}
        />
      )}

      {showSos && (
        <SosModal
          tc={tc}
          vehicleCode={session.vehicleCode}
          onClose={() => setShowSos(false)}
          onRaise={async (message) => {
            await setSos(true, message);
            setShowSos(false);
            toast.warn("Emergency raised. Your organization's admins have been told.");
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// SOS — one deliberate step, an optional few words
// ============================================================
function SosModal({ tc, vehicleCode, onClose, onRaise }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const raise = async () => {
    setBusy(true);
    setError("");
    try {
      await onRaise(message.trim() || undefined);
    } catch (err) {
      setError(err.message || "Couldn't raise the emergency. Call your organization directly.");
      setBusy(false);
    }
  };

  return (
    <Modal
      tc={tc}
      icon="sos"
      title="Report an emergency"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button variant="ghost" tc={tc} disabled={busy} onClick={onClose}>Cancel</Button>
          <Button variant="danger" tc={tc} icon="sos" loading={busy} onClick={raise}>Raise emergency</Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className={`text-sm ${tc.sub}`}>
          Every admin of your organization is notified immediately and {vehicleCode} is marked on their map.
          People following the vehicle see that there is an emergency.
        </p>
        <TextArea
          tc={tc}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="What happened? (optional) — breakdown, accident, medical…"
          maxLength={200}
          rows={2}
          aria-label="What happened?"
        />
        <p className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs ${tc.warnSoft}`}>
          <Icon name="phone" size={14} className="mt-0.5" />
          If anyone is in danger, call the emergency services first. This button does not call them.
        </p>
        <ErrorNote message={error} tc={tc} />
      </div>
    </Modal>
  );
}
