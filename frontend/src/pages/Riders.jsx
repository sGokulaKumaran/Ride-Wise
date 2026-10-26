// ============================================================
// Riders — your connections, and how to find more
// Route: /riders (protected)
//
// THREE TABS
//   My riders   everyone you're connected with (remove asks first)
//   Find        search by username or email, add with one tap
//   Near me     riders within 50 km of you
//
// "Near me" needs to know where YOU are. Nothing ever stored that
// before, so the tab was always empty; it now asks for your location
// the first time (and lets you update it). Other riders only ever see a
// distance — never your coordinates.
//
// DEEP LINK
//   /riders?q=<text>  (the top bar's search) opens "Find" with the text.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useTheme } from "./hooks/useTheme";
import { useAuth } from "../context/AuthContext";
import Icon from "./components/ui/Icon";
import Button from "./components/ui/Button";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import MobileNav from "./components/layout/MobileNav";
import { getCurrentLocation } from "../services/locationService";
import { peekCache, writeCache } from "../services/pageCache";
import {
  searchRiders,
  addRider,
  removeRider,
  getConnectionsFull,
  getNearRiders,
} from "../services/ridersApi";

const TABS = [
  { id: "mine",   label: "My riders", icon: "riders" },
  { id: "find",   label: "Find",      icon: "search" },
  { id: "nearby", label: "Near me",   icon: "pin" },
];

const nameOf = (rider) => rider.username || (rider.email || "rider").split("@")[0];

// ── Empty / waiting states ───────────────────────────────────
function Notice({ icon, title, children, tc, action = null, spin = false }) {
  return (
    <div className={`rounded-xl border px-5 py-10 text-center ${tc.divider}`}>
      <Icon name={icon} size={30} className={`mx-auto mb-3 ${spin ? "rw-spin" : ""} ${tc.sub}`} />
      <p className="text-sm font-semibold">{title}</p>
      {children && <p className={`mx-auto mt-1 max-w-xs text-xs ${tc.sub}`}>{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

// ── One rider ────────────────────────────────────────────────
function RiderRow({ rider, tc, children }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3.5 ${tc.card}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold ${tc.inkTile}`}>
        {nameOf(rider).charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">@{nameOf(rider)}</p>
        <p className={`truncate text-xs ${tc.sub}`}>{rider.email}</p>
        {(rider.address || rider.distance != null) && (
          <p className={`mt-0.5 flex items-center gap-3 truncate text-xs ${tc.sub}`}>
            {rider.distance != null && (
              <span className="inline-flex shrink-0 items-center gap-1">
                <Icon name="navigate" size={12} />
                {rider.distance < 1 ? "Less than 1 km away" : `${rider.distance.toFixed(1)} km away`}
              </span>
            )}
            {rider.address && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <Icon name="pin" size={12} />
                <span className="truncate">{rider.address}</span>
              </span>
            )}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function Riders() {
  const { user, updateProfile } = useAuth();
  const userId = user?.id;
  const { theme, setTheme, tc } = useTheme(userId);
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState("mine");
  const [query, setQuery] = useState("");

  const connectionsKey = `riders-connections-${userId}`; // session cache (services/pageCache.js)
  const [connections, setConnectionsState] = useState(() => peekCache(connectionsKey) ?? []);
  const setConnections = useCallback((list) => {
    setConnectionsState(list);
    writeCache(connectionsKey, list);
  }, [connectionsKey]);
  const [loadingConnections, setLoadingConnections] = useState(() => peekCache(connectionsKey) === undefined);

  const [results, setResults] = useState({ query: "", riders: [] }); // tagged with their query
  const [searching, setSearching] = useState(false);

  const [nearby, setNearby] = useState(null);       // null = not loaded yet
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [locating, setLocating] = useState(false);

  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [busyId, setBusyId] = useState(null);       // rider being added / removed

  // ── /riders?q=… opens "Find" with that text ──
  // (Adjusting state while rendering is React's pattern for "a prop
  // changed" — no effect, no extra render pass.)
  const urlQuery = (searchParams.get("q") || "").trim();
  const [appliedUrlQuery, setAppliedUrlQuery] = useState(null);
  if (urlQuery !== appliedUrlQuery) {
    setAppliedUrlQuery(urlQuery);
    if (urlQuery) {
      setTab("find");
      setQuery(urlQuery);
    }
  }

  // ── Connections ──
  const reloadConnections = useCallback(() => {
    getConnectionsFull()
      .then((list) => setConnections(Array.isArray(list) ? list : []))
      .catch((err) => toast.error(err.message || "Couldn't load your riders."))
      .finally(() => setLoadingConnections(false));
  }, [setConnections]);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    getConnectionsFull()
      .then((list) => { if (!cancelled) setConnections(Array.isArray(list) ? list : []); })
      .catch((err) => { if (!cancelled) toast.error(err.message || "Couldn't load your riders."); })
      .finally(() => { if (!cancelled) setLoadingConnections(false); });
    return () => { cancelled = true; };
  }, [userId, setConnections]);

  const connectedIds = new Set(connections.map((rider) => rider.id));

  // ── Search (debounced; a slow answer never replaces a newer one) ──
  const term = query.trim();
  useEffect(() => {
    if (tab !== "find" || term.length < 2) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      searchRiders(term)
        .then((riders) => { if (!cancelled) setResults({ query: term, riders: riders || [] }); })
        .catch(() => { if (!cancelled) setResults({ query: term, riders: [] }); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [tab, term]);

  const searchSettled = results.query === term;
  const found = searchSettled ? results.riders : [];

  // ── Near me ──
  const hasLocation = Number.isFinite(user?.lat) && Number.isFinite(user?.lng);

  const loadNearby = useCallback(() => {
    setLoadingNearby(true);
    getNearRiders()
      .then((list) => setNearby(Array.isArray(list) ? list : []))
      .catch((err) => {
        setNearby([]);
        if (err?.status !== 409) toast.error(err.message || "Couldn't look for riders nearby.");
      })
      .finally(() => setLoadingNearby(false));
  }, []);

  const openTab = (id) => {
    setTab(id);
    setConfirmRemoveId(null);
    if (id === "nearby" && hasLocation && nearby === null) loadNearby();
  };

  // Ask the device where we are, save it to the profile, then look around.
  const shareLocation = async () => {
    setLocating(true);
    try {
      const here = await getCurrentLocation();
      await updateProfile({ lat: here.lat, lng: here.lng });
      loadNearby();
    } catch (err) {
      toast.error(err.message || "Couldn't get your location.");
    } finally {
      setLocating(false);
    }
  };

  // ── Add / remove ──
  const handleAdd = async (rider) => {
    setBusyId(rider.id);
    try {
      const res = await addRider(rider.id);
      if (res?.success) toast.success(`@${nameOf(rider)} is now one of your riders.`);
      else toast.info(`You're already connected with @${nameOf(rider)}.`);
      reloadConnections();
    } catch (err) {
      toast.error(err.message || "Couldn't add this rider.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (rider) => {
    if (confirmRemoveId !== rider.id) { setConfirmRemoveId(rider.id); return; }
    setBusyId(rider.id);
    try {
      await removeRider(rider.id);
      toast.success(`Removed @${nameOf(rider)}.`);
      setConfirmRemoveId(null);
      reloadConnections();
    } catch (err) {
      toast.error(err.message || "Couldn't remove this rider.");
    } finally {
      setBusyId(null);
    }
  };

  // The right-hand action for a rider you may want to add
  const addAction = (rider) =>
    connectedIds.has(rider.id) ? (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${tc.okSoft}`}>
        <Icon name="check" size={13} />
        Connected
      </span>
    ) : (
      <Button variant="primary" size="sm" icon="userPlus" tc={tc} loading={busyId === rider.id} onClick={() => handleAdd(rider)}>
        Add
      </Button>
    );

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}>
      <Sidebar tc={tc} />
      <TopBar theme={theme} setTheme={setTheme} tc={tc} userId={userId} />
      <MobileNav tc={tc} />

      <main className="px-4 pb-28 pt-24 lg:ml-64 lg:pb-12">
        <div className="mx-auto w-full max-w-2xl">

          {/* Header */}
          <header className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Riders</h1>
            <p className={`mt-1 text-sm ${tc.sub}`}>
              Connect with other riders so you can invite them to group rides.
            </p>
          </header>

          {/* Tabs */}
          <div role="tablist" aria-label="Riders" className={`mb-5 flex gap-1 rounded-full p-1 ${tc.surface2}`}>
            {TABS.map((option) => {
              const selected = tab === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => openTab(option.id)}
                  className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-full border text-sm font-semibold transition-colors ${
                    selected ? tc.button : `border-transparent ${tc.navIdle}`
                  }`}
                >
                  <Icon name={option.icon} size={16} />
                  <span>{option.label}</span>
                  {option.id === "mine" && connections.length > 0 && (
                    <span className="tabular-nums opacity-70">{connections.length}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── MY RIDERS ─────────────────────────────────── */}
          {tab === "mine" && (
            <section className="space-y-2" aria-label="My riders">
              {loadingConnections ? (
                <Notice icon="spinner" spin title="Loading your riders…" tc={tc} />
              ) : connections.length === 0 ? (
                <Notice
                  icon="riders"
                  title="No riders yet"
                  tc={tc}
                  action={
                    <Button variant="primary" icon="search" tc={tc} onClick={() => openTab("find")}>
                      Find riders
                    </Button>
                  }
                >
                  Add the people you ride with, then invite them to a group ride.
                </Notice>
              ) : (
                connections.map((rider) => (
                  <RiderRow key={rider.id} rider={rider} tc={tc}>
                    {confirmRemoveId === rider.id ? (
                      <div className="flex gap-1.5">
                        <Button variant="ghost" size="sm" tc={tc} onClick={() => setConfirmRemoveId(null)}>
                          Keep
                        </Button>
                        <Button variant="danger" size="sm" tc={tc} loading={busyId === rider.id} onClick={() => handleRemove(rider)}>
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="userMinus"
                        iconOnly
                        tc={tc}
                        title={`Remove @${nameOf(rider)}`}
                        onClick={() => handleRemove(rider)}
                      />
                    )}
                  </RiderRow>
                ))
              )}
            </section>
          )}

          {/* ── FIND ──────────────────────────────────────── */}
          {tab === "find" && (
            <section aria-label="Find riders">
              <div className="relative mb-4">
                <Icon name="search" size={17} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${tc.sub}`} />
                <input
                  type="search"
                  aria-label="Search riders by username or email"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Username or email"
                  autoFocus
                  className={`w-full rounded-lg border py-3 pl-10 pr-10 text-sm ${tc.input}`}
                />
                {searching && (
                  <Icon name="spinner" size={16} className={`rw-spin absolute right-3.5 top-1/2 -translate-y-1/2 ${tc.sub}`} />
                )}
              </div>

              {term.length < 2 ? (
                <Notice icon="search" title="Search for a rider" tc={tc}>
                  Type at least two letters of their username or email.
                </Notice>
              ) : !searchSettled ? (
                <Notice icon="spinner" spin title="Searching…" tc={tc} />
              ) : found.length === 0 ? (
                <Notice icon="userOff" title="No riders found" tc={tc}>
                  Nobody on RideWise matches &ldquo;{term}&rdquo;. Check the spelling, or ask them for their username.
                </Notice>
              ) : (
                <div className="space-y-2">
                  {found.map((rider) => (
                    <RiderRow key={rider.id} rider={rider} tc={tc}>{addAction(rider)}</RiderRow>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── NEAR ME ───────────────────────────────────── */}
          {tab === "nearby" && (
            <section aria-label="Riders near me">
              {!hasLocation ? (
                <Notice
                  icon="recenter"
                  title="See riders within 50 km"
                  tc={tc}
                  action={
                    <Button variant="primary" icon="recenter" tc={tc} loading={locating} onClick={shareLocation}>
                      {locating ? "Finding you…" : "Use my location"}
                    </Button>
                  }
                >
                  RideWise needs your location once to look around you. Other riders only see how
                  far away you are — never where you are.
                </Notice>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className={`text-xs ${tc.sub}`}>Within 50 km of your saved location</p>
                    <Button variant="ghost" size="sm" icon="recenter" tc={tc} loading={locating} onClick={shareLocation}>
                      Update my location
                    </Button>
                  </div>
                  {loadingNearby || nearby === null ? (
                    <Notice icon="spinner" spin title="Looking around you…" tc={tc} />
                  ) : nearby.length === 0 ? (
                    <Notice icon="pin" title="No riders nearby yet" tc={tc}>
                      Riders who share their location within 50 km of you will appear here.
                    </Notice>
                  ) : (
                    <div className="space-y-2">
                      {nearby.map((rider) => (
                        <RiderRow key={rider.id} rider={rider} tc={tc}>{addAction(rider)}</RiderRow>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
