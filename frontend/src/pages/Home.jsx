// ============================================================
// Home.jsx — the rider's dashboard
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import MobileNav from "./components/layout/MobileNav";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import StartRideModal from "./components/shared/StartRideModal";
import { useVoice } from "./components/shared/useVoice";
import { useTheme } from "./hooks/useTheme";
import { pruneNavProgress } from "./hooks/useNavigation";
import Icon from "./components/ui/Icon";
import Button, { IconButton } from "./components/ui/Button";
import ActiveRideOverlay from "./components/ride/ActiveRideOverlay";
import RideHistoryPanel from "./components/ride/RideHistoryPanel";
import HomeOrganizations from "./components/org/HomeOrganizations";
import { getUserRides, endRide, deleteRide, clearFinishedRides, getRide } from "../services/rideApi";
import { peekCache, writeCache } from "../services/pageCache";
import {
  formatDistance,
  formatDuration,
  hasTrackedDistance,
  rideRiddenMeters,
  rideTimeSeconds,
  shortPlaceName,
} from "../services/routingApi";

const TIPS = [
  "Check your tyre pressure before a long ride — correctly inflated tyres grip better and save fuel.",
  "Riding in a group? Agree on fuel and rest stops before you set off.",
  "Carry a small first-aid kit, a torch and a puncture repair kit on longer rides.",
  "Drink water at every stop — dehydration slows your reactions just like tiredness does.",
];

function greetingFor(hour) {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Load the ride list. Never throws: resolves to { rides, failed }.
async function fetchRides(userId) {
  try {
    const rides = await getUserRides(userId); // newest first
    pruneNavProgress(rides.filter((r) => r.status === "active").map((r) => r.id));
    return { rides, failed: false };
  } catch (err) {
    console.error("[Home] Failed to load rides:", err);
    return { rides: null, failed: true };
  }
}

export default function Home() {
  const { user } = useAuth();
  return <HomeScreen key={user?.id ?? "signed-out"} user={user} />;
}

function HomeScreen({ user }) {
  const userId = user?.id;
  const { theme, setTheme, tc } = useTheme(userId);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Overlays ──
  const [showStart, setShowStart] = useState(() => searchParams.get("startRide") === "1");
  const [showHistory, setShowHistory] = useState(() => searchParams.get("openHistory") === "1");
  const [mapRide, setMapRide] = useState(null); // the ride shown on the full-screen map

  // ── Rides ──
  const ridesKey = `home-rides-${userId}`;
  const [rides, setRides] = useState(() => peekCache(ridesKey) ?? []);
  const [loading, setLoading] = useState(() => peekCache(ridesKey) === undefined);
  const [loadFailed, setLoadFailed] = useState(false);

  const [greeting] = useState(() => greetingFor(new Date().getHours()));
  const [tip] = useState(() => TIPS[new Date().getDate() % TIPS.length]);

  // ── Load the ride list ──
  const applyRides = useCallback((result) => {
    if (result.rides) { setRides(result.rides); writeCache(ridesKey, result.rides); }
    setLoadFailed(result.failed);
    setLoading(false);
  }, [ridesKey]);

  const refreshRides = useCallback(() => {
    if (userId) fetchRides(userId).then(applyRides);
  }, [userId, applyRides]);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    fetchRides(userId).then((result) => { if (!cancelled) applyRides(result); });
    return () => { cancelled = true; };
  }, [userId, applyRides]);

  // ── Open a ride on the map ──
  const openRide = useCallback(async (ride) => {
    if (!ride) return;
    setShowHistory(false);
    setShowStart(false);

    const needsRoute = !ride.routeCoordinates && ride.hasRoute !== false;
    setMapRide(needsRoute ? { ...ride, routePending: true } : ride);
    if (!needsRoute) return;

    let full = null;
    try {
      full = await getRide(ride.id);
    } catch (err) {
      console.warn("[Home] Could not load the ride's route:", err.message);
    }
    setMapRide((current) => {
      if (!current || String(current.id) !== String(ride.id)) return current;
      return { ...current, ...(full || {}), routePending: false };
    });
  }, []);

  // ── Deep links ──
  const openRideId = searchParams.get("openRide");
  const startRideParam = searchParams.get("startRide");
  const openHistoryParam = searchParams.get("openHistory");
  useEffect(() => {
    if (!openRideId && startRideParam !== "1" && openHistoryParam !== "1") return;
    setSearchParams({}, { replace: true });

    if (openRideId) {
      getRide(openRideId)
        .then((ride) => {
          if (ride) setMapRide(ride);
          else toast.info("That ride is no longer available.");
        })
        .catch(() => toast.info("That ride is no longer available."));
    }
  }, [openRideId, startRideParam, openHistoryParam, setSearchParams]);

  useEffect(() => {
    const onOverlay = (e) => {
      if (e.detail === "startRide") setShowStart(true);
      if (e.detail === "openHistory") setShowHistory(true);
    };
    window.addEventListener("ridewise:home-overlay", onOverlay);
    return () => window.removeEventListener("ridewise:home-overlay", onOverlay);
  }, []);

  // ── Voice commands ──
  const commands = useMemo(() => ({
    start:    () => setShowStart(true),
    history:  () => setShowHistory(true),
    riders:   () => navigate("/riders"),
    dark:     () => setTheme("dark"),
    light:    () => setTheme("light"),
    warm:     () => setTheme("warm"),
    midnight: () => setTheme("midnight"),
  }), [setTheme, navigate]);
  const { voiceMode, startVoice, voiceSupported } = useVoice(commands);

  // ── Derived ──
  const liveRides = rides.filter((r) => r.status === "active");
  const pastRides = rides.filter((r) => r.status !== "active");
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = rides.filter((r) => {
      const d = new Date(r.createdAt);
      return !Number.isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const km = rides.reduce((sum, r) => sum + rideRiddenMeters(r), 0) / 1000;
    return [
      { icon: "route",       value: String(rides.length),                             label: "Rides" },
      { icon: "road",        value: km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`, label: "Ridden" },
      { icon: "checkCircle", value: String(rides.filter((r) => r.status === "completed").length), label: "Completed" },
      { icon: "calendar",    value: String(thisMonth),                                label: "This month" },
    ];
  }, [rides]);

  // ── Handlers ──
  const handleRideCreated = (ride) => {
    setMapRide(ride);
    refreshRides();
  };

  const handleEndRide = async ({ distanceTraveled } = {}) => {
    if (!mapRide?.id) return false;
    try {
      await endRide(mapRide.id, distanceTraveled);
      setMapRide(null);
      toast.success("Ride ended — saved to your history.");
      refreshRides();
      return true;
    } catch (err) {
      console.error("[Home] End ride failed:", err);
      toast.error(err.message || "Couldn't end the ride. Please try again.");
      return false;
    }
  };

  const handleRideGone = () => {
    setMapRide(null);
    refreshRides();
  };

  const handleDeleteRide = async (rideId) => {
    try {
      await deleteRide(rideId);
      toast.success("Ride deleted.");
    } catch (err) {
      console.error("[Home] Delete ride failed:", err);
      toast.error(err.message || "Couldn't delete the ride. Please try again.");
    } finally {
      refreshRides();
    }
  };

  const handleClearFinishedRides = async () => {
    if (!userId) return;
    try {
      const res = await clearFinishedRides(userId);
      toast.success(res?.message || "Finished rides cleared.");
    } catch (err) {
      toast.error(err.message || "Couldn't clear finished rides. Please try again.");
    } finally {
      refreshRides();
    }
  };

  const isNewRider = !loading && !loadFailed && rides.length === 0;

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}>
      <Sidebar tc={tc} />
      <TopBar
        theme={theme} setTheme={setTheme} tc={tc}
        voiceMode={voiceMode} startVoice={voiceSupported ? startVoice : undefined}
        userId={userId}
      />
      <MobileNav tc={tc} onStartRide={() => setShowStart(true)} />

      <main className="px-4 pb-28 pt-24 lg:ml-64 lg:pb-12">
        <div className="mx-auto w-full max-w-2xl space-y-8">

          {/* ── Greeting + main action ─────────────────────── */}
          <section>
            <p className={`text-sm ${tc.sub}`}>{greeting},</p>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {user?.username || "Rider"}
            </h1>
            <p className={`mt-1.5 text-sm ${tc.sub}`}>
              {liveRides.length > 0
                ? "You have a ride in progress."
                : "Plan a route, follow turn-by-turn guidance, ride with friends."}
            </p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button
                id="home-start-ride-btn"
                variant="accent"
                size="lg"
                icon="ride"
                tc={tc}
                className="sm:px-8"
                onClick={() => setShowStart(true)}
              >
                Start a ride
              </Button>
              <Button variant="secondary" size="lg" icon="history" tc={tc} onClick={() => setShowHistory(true)}>
                Ride history
              </Button>
              <Button variant="ghost" size="lg" icon="riders" tc={tc} onClick={() => navigate("/riders")}>
                Find riders
              </Button>
            </div>

            {voiceSupported && (
              <p className={`mt-3 flex items-center gap-1.5 text-xs ${tc.sub}`}>
                <Icon name="mic" size={13} />
                Tap the mic in the top bar and say &ldquo;start&rdquo; or &ldquo;history&rdquo;.
              </p>
            )}
          </section>

          {/* ── Continue riding ────────────────────────────── */}
          {liveRides.length > 0 && (
            <section aria-labelledby="live-rides-title">
              <h2 id="live-rides-title" className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                Continue riding
              </h2>
              <div className="space-y-2">
                {liveRides.map((ride) => (
                  <RideRow key={ride.id} ride={ride} live tc={tc} onOpen={() => openRide(ride)} />
                ))}
              </div>
            </section>
          )}

          {/* ── Organizations: follow · drive · manage ─────── */}
          <HomeOrganizations tc={tc} userId={userId} />

          {/* ── Your numbers ───────────────────────────────── */}
          <section aria-label="Your riding numbers" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className={`rounded-xl border p-4 ${tc.card}`}>
                <Icon name={stat.icon} size={18} className={tc.sub} />
                <p className="mt-3 text-xl font-bold tabular-nums">
                  {loading ? <span className={`inline-block h-6 w-12 rounded ${tc.surface2}`} /> : stat.value}
                </p>
                <p className={`mt-0.5 text-xs ${tc.sub}`}>{stat.label}</p>
              </div>
            ))}
          </section>

          {/* ── Could not load ─────────────────────────────── */}
          {loadFailed && (
            <div className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${tc.dangerSoft}`}>
              <Icon name="alertTriangle" size={18} />
              <span className="flex-1">Couldn&apos;t load your rides.</span>
              <Button variant="secondary" size="sm" icon="refresh" tc={tc} onClick={refreshRides}>
                Try again
              </Button>
            </div>
          )}

          {/* ── Recent rides ───────────────────────────────── */}
          {(loading || pastRides.length > 0) && (
            <section aria-labelledby="recent-rides-title">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="recent-rides-title" className="text-sm font-semibold">Recent rides</h2>
                {pastRides.length > 3 && (
                  <Button variant="ghost" size="sm" icon="arrowRight" iconRight tc={tc} onClick={() => setShowHistory(true)}>
                    See all {rides.length}
                  </Button>
                )}
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map((n) => (
                    <div key={n} className={`h-[68px] animate-pulse rounded-xl border ${tc.card}`} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {pastRides.slice(0, 3).map((ride) => (
                    <RideRow
                      key={ride.id}
                      ride={ride}
                      tc={tc}
                      onOpen={() => openRide(ride)}
                      onDelete={() => handleDeleteRide(ride.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── First ride: how it works ───────────────────── */}
          {isNewRider && (
            <section className={`rounded-xl border p-5 ${tc.card}`} aria-labelledby="first-ride-title">
              <h2 id="first-ride-title" className="text-base font-semibold">Your first ride in three steps</h2>
              <ol className="mt-4 space-y-4">
                {[
                  { icon: "pin",      title: "Choose where you're going", text: "Use your current location or search for any place." },
                  { icon: "navigate", title: "Follow the route",          text: "Spoken turn-by-turn directions, with your position live on the map." },
                  { icon: "riders",   title: "Ride together",             text: "Invite your connections to a group ride and see each other on the map." },
                ].map((step, index) => (
                  <li key={step.title} className="flex items-start gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
                      <Icon name={step.icon} size={18} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{index + 1}. {step.title}</span>
                      <span className={`block text-xs ${tc.sub}`}>{step.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* ── Tip of the day ─────────────────────────────── */}
          <section className={`flex items-start gap-3 rounded-xl border p-4 ${tc.card}`}>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
              <Icon name="idea" size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold">Tip of the day</p>
              <p className={`mt-0.5 text-xs leading-relaxed ${tc.sub}`}>{tip}</p>
            </div>
          </section>
        </div>
      </main>

      {/* ── Plan a ride ── */}
      <StartRideModal
        open={showStart}
        onClose={() => setShowStart(false)}
        tc={tc}
        activeRide={liveRides[0] || null}
        onContinueRide={() => openRide(liveRides[0])}
        onRideCreated={handleRideCreated}
        onOpenHistory={() => { setShowStart(false); setShowHistory(true); }}
      />

      {/* ── The map. Keyed by ride, so opening another ride starts clean ── */}
      {mapRide && (
        <ActiveRideOverlay
          key={mapRide.id}
          ride={mapRide}
          onClose={() => setMapRide(null)}
          onEnd={handleEndRide}
          onLeave={handleRideGone}
          onRideEnded={handleRideGone}
        />
      )}

      {/* ── Full history ── */}
      {showHistory && (
        <RideHistoryPanel
          rides={rides}
          currentUserId={userId}
          onOpenRide={openRide}
          onDeleteRide={handleDeleteRide}
          onClearFinishedRides={handleClearFinishedRides}
          onClose={() => setShowHistory(false)}
          tc={tc}
        />
      )}
    </div>
  );
}

// ============================================================
// RideRow — one ride in "Continue riding" / "Recent rides"
// ============================================================
function RideRow({ ride, onOpen, onDelete, tc, live = false }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const from = shortPlaceName(ride.fromName, "Start");
  const to = shortPlaceName(ride.destinationName, "Destination");
  const group = ride.rideType === "group";
  const date = ride.createdAt
    ? new Date(ride.createdAt).toLocaleDateString([], { day: "numeric", month: "short" })
    : "";

  const tracked = hasTrackedDistance(ride);
  const distance = tracked ? Number(ride.actualDistanceMeters) : ride.distanceMeters;
  const seconds = rideTimeSeconds(ride);
  const meta = [
    tracked ? `${formatDistance(distance)} ridden` : distance > 0 ? formatDistance(distance) : null,
    seconds > 0 ? formatDuration(seconds) : null,
    group ? `${ride.participants?.length || 1} riders` : null,
    date || null,
  ].filter(Boolean);

  const handleTrashClick = async (event) => {
    event.stopPropagation();
    if (!onDelete) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${tc.card} ${tc.cardHover}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
          <Icon name={group ? "riders" : "ride"} size={19} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{from} → {to}</span>
          <span className={`block truncate text-xs ${tc.sub}`}>{meta.join(" · ")}</span>
        </span>

        {live ? (
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tc.okSoft}`}>
            Open map
            <Icon name="arrowRight" size={13} />
          </span>
        ) : (
          <span className={`shrink-0 text-xs capitalize ${ride.status === "cancelled" ? tc.danger : tc.sub}`}>
            {ride.status}
          </span>
        )}
      </button>

      {!live && onDelete && (
        confirmDelete ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              tc={tc}
              disabled={deleting}
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
            >
              Keep
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon="trash"
              tc={tc}
              loading={deleting}
              onClick={handleTrashClick}
            >
              Delete
            </Button>
          </div>
        ) : (
          <IconButton
            icon="trash"
            label="Delete ride"
            size="sm"
            tc={tc}
            onClick={handleTrashClick}
          />
        )
      )}
    </div>
  );
}
