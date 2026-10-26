// ============================================================
// AdminDashboard — Platform overview stats
//
// Shows basic platform statistics:
//   - Total Users
//   - Total Rides
//   - Active Rides
//   - Completed Rides
//   - Solo Rides
//   - Group Rides
//   - Organizations · Vehicles · Vehicles on a Trip
// ============================================================
import { useState, useEffect } from "react";
import { getDashboardStats } from "../../services/adminApi";
import { peekCache, writeCache } from "../../services/pageCache";
import { useTheme } from "../hooks/useTheme";
import AdminLayout from "./AdminLayout";
import { useAuth } from "../../context/AuthContext";
import Icon from "../components/ui/Icon";

export default function AdminDashboard() {
  const { user } = useAuth();
  // Pass user?.id so the admin panel uses the same saved theme as the app
  const { tc } = useTheme(user?.id);
  const [stats, setStats] = useState(() => peekCache("admin-dashboard") ?? null); // session cache
  const [loading, setLoading] = useState(() => peekCache("admin-dashboard") === undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (peekCache("admin-dashboard") === undefined) setLoading(true); // revisit: keep the cached numbers on screen
        const data = await getDashboardStats();
        if (!cancelled) { setStats(data); writeCache("admin-dashboard", data); }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const statCards = stats ? [
    { label: "Total Users",     value: stats.totalUsers,      icon: "riders" },
    { label: "Total Rides",     value: stats.totalRides,      icon: "ride" },
    { label: "Active Rides",    value: stats.activeRides,     icon: "dot" },
    { label: "Completed Rides", value: stats.completedRides,  icon: "chart" },
    { label: "Solo Rides",      value: stats.totalSoloRides,  icon: "user" },
    { label: "Group Rides",     value: stats.totalGroupRides, icon: "riders" },
    // Organizations and their fleets (absent on a backend that predates them)
    ...(stats.totalOrganizations != null ? [
      { label: "Organizations",       value: stats.totalOrganizations,  icon: "building" },
      { label: "Vehicles",            value: stats.totalVehicles,       icon: "bus" },
      { label: "Vehicles on a Trip",  value: stats.activeVehicleTrips,  icon: "signal" },
      ...(stats.totalFeedback != null ? [
        { label: "Open Feedback",       value: stats.openFeedback ?? 0,   icon: "message" },
        { label: "Total Feedback",      value: stats.totalFeedback,       icon: "help" },
      ] : []),
    ] : []),
  ] : [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className={`text-sm ${tc.sub} mt-1`}>Platform overview and statistics</p>
        </div>

        {/* ── Loading State ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Icon name="spinner" size={22} className="rw-spin" />
            <p className={`text-sm ${tc.sub}`}>Loading stats…</p>
          </div>
        )}

        {/* ── Error State ── */}
        {error && (
          <div className={`flex items-center gap-2 p-4 rounded-xl border text-sm ${tc.dangerSoft}`}>
            <Icon name="alertTriangle" size={16} />
            {error}
          </div>
        )}

        {/* ── Stats Cards ── */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {statCards.map((card) => (
              <div
                key={card.label}
                className={`rounded-xl border p-6 transition-colors ${tc.card}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className={`text-sm font-medium ${tc.sub}`}>{card.label}</p>
                    <p className="text-3xl font-bold mt-2">{card.value}</p>
                  </div>
                  <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${tc.surface2} ${tc.sub}`}>
                    <Icon name={card.icon} size={22} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Platform Status ── */}
        {stats && (
          <div className={`rounded-xl border p-6 ${tc.card}`}>
            <h2 className="flex items-center gap-2 text-lg font-bold mb-4">
              <Icon name="server" size={18} className={tc.sub} />
              Platform Status
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full bg-current ${tc.ok}`} />
                <span className={`text-sm ${tc.sub}`}>Backend: Online</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full bg-current ${tc.ok}`} />
                <span className={`text-sm ${tc.sub}`}>Database: Connected</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full bg-current ${stats.activeRides > 0 ? `${tc.accent} animate-pulse` : tc.sub}`} />
                <span className={`text-sm ${tc.sub}`}>
                  {stats.activeRides > 0 ? `${stats.activeRides} ride(s) in progress` : "No active rides"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
