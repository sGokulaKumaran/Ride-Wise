// ============================================================
// 🏍️ Riders — Manage rider connections
// Route: /riders (protected)
//
// SAFETY:
//   - Uses `user?.id` everywhere (defensive against missing user)
//   - Properly imports onStartRide prop for MobileNav
//   - Re-fetches when user.id changes
// ============================================================

import { useState, useEffect } from "react";
import { useTheme } from "./hooks/useTheme";
import { useAuth } from "../context/AuthContext";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import MobileNav from "./components/layout/MobileNav";
import {
  searchRiders,
  addRider,
  removeRider,
  getConnectionsFull,
  getNearRiders,
  isConnected,
} from "../services/ridersApi";

export default function Riders() {
  const { theme, setTheme, tc } = useTheme();
  const { user } = useAuth();

  // view: "all" | "add" | "remove" | "near"
  const [view, setView] = useState("all");

  const [connections,   setConnections]   = useState([]);
  const [nearRiders,    setNearRiders]    = useState([]);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [loading,       setLoading] = useState(false);
  const [toast,         setToast]         = useState("");

  const currentUserId = user?.id;

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

  // ── Debounced search (only in "add" view) ──
  useEffect(() => {
    if (view !== "add" || !currentUserId) return;
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchRiders(searchQuery, currentUserId);
        setSearchResults(results);
      } catch (e) {
        console.error("Search failed:", e);
 setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery, view, currentUserId]);

  // ── Actions ──
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleAdd = async (rider) => {
    if (!currentUserId) return;
    const res = await addRider(currentUserId, rider.id);
    if (res.success) {
      showToast(`✅ Added @${rider.username || rider.email.split("@")[0]}`);
      await reloadConnections();
    } else {
      showToast(`⚠️ ${res.error}`);
    }
  };

  const handleRemove = async (rider) => {
    if (!currentUserId) return;
    const res = await removeRider(currentUserId, rider.id);
    if (res.success) {
      showToast(`🗑️ Removed @${rider.username || rider.email.split("@")[0]}`);
      await reloadConnections();
    } else {
      showToast(`⚠️ ${res.error}`);
    }
  };

  // ── Rider card ──
  const RiderCard = ({ rider, showAdd, showRemove, distance }) => {
    const displayName = rider.username || rider.email.split("@")[0];
    const initial = (rider.username || rider.email).charAt(0).toUpperCase();

    return (
      <div
        className={`flex items-center gap-3 p-4 rounded-2xl border transition-all hover:scale-[1.01] hover:shadow-lg ${tc.card} ${tc.cardHover}`}
      >
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center font-black text-white text-lg">
            {initial}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">@{displayName}</p>
          <p className={`text-xs ${tc.sub} truncate`}>{rider.email}</p>
          {rider.address && (
            <p className={`text-xs ${tc.sub} truncate`}>📍 {rider.address}</p>
          )}
          {distance !== undefined && distance !== null && (
            <p className={`text-xs ${tc.sub} truncate`}>
 📏 {distance.toFixed(1)} km away
            </p>
          )}
        </div>

        {showAdd && !isConnected(currentUserId, rider.id) && (
<button
            onClick={() => handleAdd(rider)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold ${tc.button} hover:scale-105 active:scale-95 transition-transform shrink-0`}
          >
            <i className="fa fa-plus mr-1"></i>Add
          </button>
        )}
        {showAdd && isConnected(currentUserId, rider.id) && (
          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30 shrink-0">
            ✓ Added
          </span>
        )}
        {showRemove && (
          <button
            onClick={() => handleRemove(rider)}
            className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 hover:scale-105 active:scale-95 transition-all shrink-0"
          >
            <i className="fa fa-times mr-1"></i>Remove
          </button>
        )}
      </div>
    );
  };

  // ── Empty state ──
  const EmptyState = ({ icon, title, message }) => (
    <div className={`text-center py-10 rounded-xl border ${tc.divider}`}>
      <i className={`fa ${icon} text-4xl mb-2 opacity-30`}></i>
      <p className="text-sm font-bold mb-1">{title}</p>
      <p className={`text-xs ${tc.sub} max-w-xs mx-auto`}>{message}</p>
    </div>
  );

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}>
      <Sidebar tc={tc} />
      <TopBar theme={theme} setTheme={setTheme} tc={tc} />
      <MobileNav tc={tc} onStartRide={() => {}} />

<main className="lg:ml-64 pt-20 px-4 pb-24 lg:pb-8">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-black">🏍️ Riders</h1>
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
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br from-green-400 to-emerald-500 text-white text-xl shadow-lg shadow-green-500/30">
                <i className="fa fa-user-plus"></i>
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
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br from-red-400 to-pink-500 text-white text-xl shadow-lg shadow-red-500/30">
                <i className="fa fa-user-minus"></i>
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
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br from-blue-400 to-purple-500 text-white text-xl shadow-lg shadow-blue-500/30">
                <i className="fa fa-location-dot"></i>
              </div>
              <p className="font-black text-base">Near Riders</p>
              <p className={`text-xs ${tc.sub} mt-1`}>Find riders within 50 km</p>
            </button>
          </div>

          {/* Toast */}
          {toast && (
            <div className={`mb-4 p-3 rounded-xl text-sm font-semibold border backdrop-blur-xl animate-pulse ${tc.card}`}>
              {toast}
            </div>
          )}

          {/* ADD VIEW */}
          {view === "add" && (
            <section className={`rounded-2xl border p-5 mb-6 ${tc.card}`}>
              <h2 className="text-lg font-black mb-3">🔎 Search riders by username</h2>
              <div className="relative mb-4">
                <i className={`fa fa-search absolute left-4 top-1/2 -translate-y-1/2 ${tc.sub}`}></i>
                <input type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type a username or email..."
                  className={`w-full pl-11 pr-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-orange-500/50 ${tc.input}`}
                  autoFocus
                />
                {searching && (
                  <i className="fa fa-spinner fa-spin absolute right-4 top-1/2 -translate-y-1/2 text-orange-400"></i>
                )}
              </div>

              {searchQuery.length === 0 ? (
                <EmptyState
                  icon="fa-search"
                  title="Start typing to search"
                  message="Search for real riders who have signed up to RideWise"
                />
              ) : searching ? (
                <p className={`text-center text-sm ${tc.sub} py-8`}>
                  <i className="fa fa-spinner fa-spin mr-2"></i>Searching…
                </p>
              ) : searchResults.length === 0 ? (
                <EmptyState
                  icon="fa-user-slash"
                  title="No riders found"
                  message={`No signed-up riders match "${searchQuery}"`}
                />
              ) : (
                <div className="space-y-2">
                  {searchResults.map((r) => (
                    <RiderCard key={r.id} rider={r} showAdd />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* REMOVE VIEW */}
          {view === "remove" && (
            <section className={`rounded-2xl border p-5 mb-6 ${tc.card}`}>
              <h2 className="text-lg font-black mb-3">🗑️ Remove from your connections</h2>
              {loading ? (
                <p className={`text-center text-sm ${tc.sub} py-8`}>
                  <i className="fa fa-spinner fa-spin mr-2"></i>Loading…
                </p>
              ) : connections.length === 0 ? (
                <EmptyState
                  icon="fa-users"
                  title="No connections yet"
                  message="Add some riders first using the Add Rider or Near Riders button"
                />
              ) : (
                <div className="space-y-2">
                  {connections.map((r) => (
                    <RiderCard key={r.id} rider={r} showRemove />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* NEAR VIEW */}
          {view === "near" && (
            <section className={`rounded-2xl border p-5 mb-6 ${tc.card}`}>
              <h2 className="text-lg font-black mb-1">📍 Riders near you</h2>
              <p className={`text-xs ${tc.sub} mb-3`}>Within 50 km of your location</p>
              {loading ? (
                <p className={`text-center text-sm ${tc.sub} py-8`}>
                  <i className="fa fa-spinner fa-spin mr-2"></i>Finding riders near you…
                </p>
              ) : nearRiders.length === 0 ? (
                <EmptyState
                  icon="fa-map-marker-alt"
                  title="No nearby riders"
                  message="When other riders sign up with locations near yours, they'll appear here"
                />
              ) : (
                <div className="space-y-2">
                  {nearRiders.map((r) => (
                    <RiderCard key={r.id} rider={r} showAdd distance={r.distance} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ALWAYS-VISIBLE: Your connections */}
          <section className={`rounded-2xl border p-5 ${tc.card}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-black">
                🤝 Your connections
                <span className={`ml-2 text-sm font-normal ${tc.sub}`}>
                  ({connections.length})
                </span>
              </h2>
              <button
                onClick={reloadConnections}
                className={`text-xs font-bold ${tc.sub} hover:underline`}
              >
                <i className="fa fa-refresh mr-1"></i>Refresh
              </button>
            </div>

            {loading ? (
              <p className={`text-center text-sm ${tc.sub} py-8`}>
                <i className="fa fa-spinner fa-spin mr-2"></i>Loading…
              </p>
            ) : connections.length === 0 ? (
              <EmptyState
                icon="fa-users"
                title="No connections yet"
                message="Use Add Rider or Near Riders above to start connecting with real riders"
              />
            ) : (
<div className="space-y-2">
                {connections.map((r) => (
 <RiderCard key={r.id} rider={r} showAdd />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}