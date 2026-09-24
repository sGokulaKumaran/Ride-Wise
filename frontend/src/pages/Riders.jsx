// ============================================================
// 🏍️ Riders — Manage rider connections
// Route: /riders (protected)
//
// SAFETY:
//   - Uses `user?.id` everywhere (defensive against missing user)
//   - Properly imports onStartRide prop for MobileNav
//   - Re-fetches when user.id changes
// ============================================================

import { useState, useEffect, useMemo } from "react";
import { useTheme } from "./hooks/useTheme";
import { useAuth } from "../context/AuthContext";
import Icon from "./components/ui/Icon";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import MobileNav from "./components/layout/MobileNav";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  searchRiders,
  addRider,
  removeRider,
  getConnectionsFull,
  getNearRiders,
} from "../services/ridersApi";

// ── Empty state (module scope — stable identity across renders) ──
function EmptyState({ icon, title, message, tc={} }) {
  return (
    <div className={`text-center py-10 rounded-xl border ${tc.divider}`}>
      <Icon name={icon} size={34} className={`mb-2 opacity-40 ${tc.sub || ""}`} />
      <p className="text-sm font-bold mb-1">{title}</p>
      <p className={`text-xs ${tc.sub} max-w-xs mx-auto`}>{message}</p>
    </div>
  );
}

// ── Rider card (module scope — stable identity across renders) ──
function RiderCard({ rider, showAdd, showRemove, distance, connected, onAdd, onRemove, tc }) {
  const displayName = rider.username || (rider.email || "rider").split("@")[0];
  const initial = (rider.username || rider.email || "R").charAt(0).toUpperCase();

  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-2xl border transition-all hover:scale-[1.01] hover:shadow-lg ${tc.card} ${tc.cardHover}`}
    >
      <div className="relative shrink-0">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-base ${tc.avatar || "bg-neutral-800 text-neutral-100"}`}>
          {initial}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">@{displayName}</p>
        <p className={`text-xs ${tc.sub} truncate`}>{rider.email}</p>
        {rider.address && (
          <p className={`text-xs ${tc.sub} truncate flex items-center gap-1`}>
            <Icon name="pin" size={12} /> {rider.address}
          </p>
        )}
        {distance !== undefined && distance !== null && (
          <p className={`text-xs ${tc.sub} truncate flex items-center gap-1`}>
            <Icon name="road" size={12} /> {distance.toFixed(1)} km away
          </p>
        )}
      </div>

      {showAdd && !connected && (
        <button
          onClick={() => onAdd(rider)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold ${tc.button} hover:scale-105 active:scale-95 transition-transform shrink-0`}
        >
          <Icon name="plus" size={12} className="mr-1 inline-block" />Add
        </button>
      )}
      {showAdd && connected && (
        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30 shrink-0">
          <Icon name="check" size={12} className="mr-1 inline-block" />Added
        </span>
      )}
      {showRemove && (
        <button
          onClick={() => onRemove(rider)}
          className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 hover:scale-105 active:scale-95 transition-all shrink-0"
        >
          <Icon name="close" size={12} className="mr-1 inline-block" />Remove
        </button>
      )}
    </div>
  );
}

export default function Riders() {
  const { user } = useAuth();
  const { theme, setTheme, tc } = useTheme(user?.id);

  // Deep link: /riders?q=<query> (from TopBar search) → opens the Add
  // Rider view with the query prefilled.
  // States are initialised empty; the effect below owns the sync so the
  // panel always matches the URL — on first mount AND on back/forward
  // navigation (a plain initial-useState value goes stale after mount).
  const [searchParams] = useSearchParams();

  // view: "all" | "add" | "remove" | "near"
  const [view, setView] = useState("all");

  const [connections,   setConnections]   = useState([]);
  const [nearRiders,    setNearRiders]    = useState([]);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [loading,       setLoading] = useState(false);

  // React to ?q= on mount and on every change while on this page
  useEffect(() => {
    const q = (searchParams.get("q") || "").trim();
    setView(q ? "add" : (v) => v); // open Add view for a query; leave untouched when cleared
    setSearchQuery(q);
  }, [searchParams]);

  const currentUserId = user?.id;

  // Derive a Set of connected IDs from the connections list for O(1) lookup.
  // Memoised so the Set keeps a stable identity across renders — inline
  // `new Set(...)` would be a fresh object every render and force every
  // RiderCard using `connectedIds.has(...)` to re-render needlessly.
  const connectedIds = useMemo(
    () => new Set(connections.map((c) => c.id)),
    [connections]
  );

  // ── Reload connections ──
  const reloadConnections = async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const list = await getConnectionsFull(currentUserId);
      setConnections(list);
    } catch (e) {
      console.error("Failed to load connections:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadConnections();
  }, [currentUserId]);

  // ── Reload near riders ──
  const loadNearRiders = async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const list = await getNearRiders(currentUserId);
      setNearRiders(list);
    } catch (e) {
      console.error("Failed to load near riders:", e);
    } finally {
      setLoading(false);
    }
  };

  // Guards against out-of-order responses: an older (slower) request must never overwrite newer results.
  useEffect(() => {
    if (view !== "add" || !currentUserId) return;
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchRiders(searchQuery, currentUserId);
        if (!cancelled) setSearchResults(results);
      } catch (e) {
        console.error("Search failed:", e);
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [searchQuery, view, currentUserId]);

  // ── Actions (toasts via react-toastify, consistent with Home/Account) ──
  const handleAdd = async (rider) => {
    if (!currentUserId) return;
    try {
      const res = await addRider(currentUserId, rider.id);
      if (res.success) {
        toast.success(`Added @${rider.username || (rider.email || "rider").split("@")[0]} to your riders`);
        await reloadConnections();
      } else {
        toast.info("Already in your connections");
      }
    } catch (e) {
      toast.error(e.message || "Failed to add rider");
    }
  };

  const handleRemove = async (rider) => {
    if (!currentUserId) return;
    try {
      const res = await removeRider(currentUserId, rider.id);
      if (res.success) {
        toast.success(`Removed @${rider.username || (rider.email || "rider").split("@")[0]}`);
        await reloadConnections();
      } else {
        toast.info("Not in your connections");
      }
    } catch (e) {
      toast.error(e.message || "Failed to remove rider");
    }
  };

  // ── Rider card + Empty state live at MODULE SCOPE (see below) ──
  // They were previously defined here, inside the component — React saw
  // a brand-new component type on every render and remounted them,
  // resetting state and breaking reconciliation.

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}>
      <Sidebar tc={tc} />
      <TopBar theme={theme} setTheme={setTheme} tc={tc} userId={currentUserId} />
      <MobileNav tc={tc} onStartRide={() => {}} />

<main className="lg:ml-64 pt-20 px-4 pb-24 lg:pb-8">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3">
              <Icon name="riders" size={32} className={tc.sub} />
              Riders
            </h1>
            <p className={`text-sm ${tc.sub} mt-1`}>
              Connect with real riders, manage your network, and find people nearby
            </p>
          </div>

          {/* 3 CTA cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <button
              onClick={() => setView(view === "add" ? "all" : "add")}
              className={`p-5 rounded-2xl border text-left transition-all hover:scale-[1.03] active:scale-95 ${
                view === "add" ? "ring-2 ring-orange-500 " + tc.card : tc.card + " " + tc.cardHover
              }`}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-neutral-900 text-white text-xl">
                <Icon name="userPlus" size={20} className="text-white" />
              </div>
              <p className="font-black text-base">Add Rider</p>
              <p className={`text-xs ${tc.sub} mt-1`}>Search by username</p>
            </button>

            <button
              onClick={() => setView(view === "remove" ? "all" : "remove")}
              className={`p-5 rounded-2xl border text-left transition-all hover:scale-[1.03] active:scale-95 ${
                view === "remove" ? "ring-2 ring-orange-500 " + tc.card : tc.card + " " + tc.cardHover
              }`}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-neutral-900 text-white text-xl">
                <Icon name="userMinus" size={20} className="text-white" />
              </div>
              <p className="font-black text-base">Remove Rider</p>
              <p className={`text-xs ${tc.sub} mt-1`}>Unfollow from your list</p>
            </button>

            <button
              onClick={() => {
                if (view !== "near") {
                  setView("near");
                  loadNearRiders();
                } else {
                  setView("all");
                }
              }}
              className={`p-5 rounded-2xl border text-left transition-all hover:scale-[1.03] active:scale-95 ${
                view === "near" ? "ring-2 ring-orange-500 " + tc.card : tc.card + " " + tc.cardHover
              }`}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-neutral-900 text-white text-xl">
                <Icon name="pin" size={20} className="text-white" />
              </div>
              <p className="font-black text-base">Near Riders</p>
              <p className={`text-xs ${tc.sub} mt-1`}>Find riders within 50 km</p>
            </button>
          </div>


          {/* ADD VIEW */}
          {view === "add" && (
            <section className={`rounded-2xl border p-5 mb-6 ${tc.card}`}>
              <h2 className="text-lg font-black mb-3 flex items-center gap-2">
                <Icon name="search" size={18} className={tc.sub} /> Search riders by username
              </h2>
              <div className="relative mb-4">
                <Icon name="search" size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${tc.sub}`} />
                <input type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type a username or email..."
                  className={`w-full pl-11 pr-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-orange-500/50 ${tc.input}`}
                  autoFocus
                />
                {searching && (
                  <Icon name="spinner" size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin" />
                )}
              </div>

              {searchQuery.length === 0 ? (
                <EmptyState
                  icon="search"
                  title="Start typing to search"
                  message="Search for real riders who have signed up to RideWise"
                  tc={tc}
                />
              ) : searching ? (
                <p className={`text-center text-sm ${tc.sub} py-8`}>
                  <Icon name="spinner" size={14} className="mr-2 inline-block animate-spin" />Searching…
                </p>
              ) : searchResults.length === 0 ? (
                <EmptyState
                  icon="userOff"
                  title="No riders found"
                  message={`No signed-up riders match "${searchQuery}"`}
                  tc={tc}
                />
              ) : (
                <div className="space-y-2">
                  {searchResults.map((r) => (
                    <RiderCard key={r.id} rider={r} showAdd tc={tc} connected={connectedIds.has(r.id)} onAdd={handleAdd} onRemove={handleRemove} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* REMOVE VIEW */}
          {view === "remove" && (
            <section className={`rounded-2xl border p-5 mb-6 ${tc.card}`}>
              <h2 className="text-lg font-black mb-3 flex items-center gap-2">
                <Icon name="trash" size={18} className={tc.sub} /> Remove from your connections
              </h2>
              {loading ? (
                <p className={`text-center text-sm ${tc.sub} py-8`}>
                  <Icon name="spinner" size={14} className="mr-2 inline-block animate-spin" />Loading…
                </p>
              ) : connections.length === 0 ? (
                <EmptyState
                  icon="riders"
                  title="No connections yet"
                  message="Add some riders first using the Add Rider or Near Riders button"
                  tc={tc}
                />
              ) : (
                <div className="space-y-2">
                  {connections.map((r) => (
                    <RiderCard key={r.id} rider={r} showRemove tc={tc} connected={connectedIds.has(r.id)} onAdd={handleAdd} onRemove={handleRemove} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* NEAR VIEW */}
          {view === "near" && (
            <section className={`rounded-2xl border p-5 mb-6 ${tc.card}`}>
              <h2 className="text-lg font-black mb-1 flex items-center gap-2">
                <Icon name="pin" size={18} className={tc.sub} /> Riders near you
              </h2>
              <p className={`text-xs ${tc.sub} mb-3`}>Within 50 km of your location</p>
              {loading ? (
                <p className={`text-center text-sm ${tc.sub} py-8`}>
                  <Icon name="spinner" size={14} className="mr-2 inline-block animate-spin" />Finding riders near you…
                </p>
              ) : nearRiders.length === 0 ? (
                <EmptyState
                  icon="pin"
                  title="No nearby riders"
                  message="When other riders sign up with locations near yours, they'll appear here"
                  tc={tc}
                />
              ) : (
                <div className="space-y-2">
                  {nearRiders.map((r) => (
                    <RiderCard key={r.id} rider={r} showAdd distance={r.distance} tc={tc} connected={connectedIds.has(r.id)} onAdd={handleAdd} onRemove={handleRemove} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ALWAYS-VISIBLE: Your connections */}
          <section className={`rounded-2xl border p-5 ${tc.card}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-black">
                <span className="inline-flex items-center gap-2">
                  <Icon name="riders" size={18} className={tc.sub} /> Your connections
                </span>
                <span className={`ml-2 text-sm font-normal ${tc.sub}`}>
                  ({connections.length})
                </span>
              </h2>
              <button
                onClick={reloadConnections}
                className={`text-xs font-bold ${tc.sub} hover:underline`}
              >
                <Icon name="refresh" size={12} className="mr-1 inline-block" />Refresh
              </button>
            </div>

            {loading ? (
              <p className={`text-center text-sm ${tc.sub} py-8`}>
                <Icon name="spinner" size={14} className="mr-2 inline-block animate-spin" />Loading…
              </p>
            ) : connections.length === 0 ? (
              <EmptyState
                icon="riders"
                title="No connections yet"
                message="Use Add Rider or Near Riders above to start connecting with real riders"
                tc={tc}
              />
            ) : (
<div className="space-y-2">
                {connections.map((r) => (
                  <RiderCard key={r.id} rider={r} showRemove tc={tc} connected={connectedIds.has(r.id)} onAdd={handleAdd} onRemove={handleRemove} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
