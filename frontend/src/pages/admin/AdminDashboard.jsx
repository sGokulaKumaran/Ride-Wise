// ============================================================
// 📊 AdminDashboard — Platform overview stats
//
// Shows basic platform statistics:
//   - Total Users
//   - Total Rides
//   - Active Rides
//   - Completed Rides
//   - Solo Rides
//   - Group Rides
// ============================================================
import { useState, useEffect } from "react";
import { getDashboardStats } from "../../services/adminApi";
import { useTheme } from "../hooks/useTheme";
import AdminLayout from "./AdminLayout";

export default function AdminDashboard() {
  const { tc } = useTheme();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = await getDashboardStats();
        if (!cancelled) setStats(data);
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
    { label: "Total Users",     value: stats.totalUsers,     icon: "fa-users",         color: "from-blue-500 to-cyan-500" },
    { label: "Total Rides",     value: stats.totalRides,     icon: "fa-road",          color: "from-orange-500 to-pink-500" },
    { label: "Active Rides",    value: stats.activeRides,    icon: "fa-play-circle",   color: "from-green-500 to-emerald-500" },
    { label: "Completed Rides", value: stats.completedRides, icon: "fa-check-circle",  color: "from-purple-500 to-indigo-500" },
    { label: "Solo Rides",      value: stats.totalSoloRides, icon: "fa-motorcycle",    color: "from-amber-500 to-yellow-500" },
    { label: "Group Rides",     value: stats.totalGroupRides,icon: "fa-users",         color: "from-rose-500 to-red-500" },
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
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center animate-pulse">
                <i className="fa fa-chart-bar text-white" />
              </div>
              <p className={`text-sm ${tc.sub}`}>Loading stats…</p>
            </div>
          </div>
        )}

        {/* ── Error State ── */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
            <i className="fa fa-exclamation-triangle mr-2" />
            {error}
          </div>
        )}

        {/* ── Stats Cards ── */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {statCards.map((card) => (
              <div
                key={card.label}
                className={`rounded-2xl border p-6 transition-all hover:scale-[1.02] ${tc.card}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${tc.sub}`}>{card.label}</p>
                    <p className="text-3xl font-bold mt-2">{card.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white shadow-lg`}>
                    <i className={`fa ${card.icon} text-lg`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Platform Status ── */}
        {stats && (
          <div className={`rounded-2xl border p-6 ${tc.card}`}>
            <h2 className="text-lg font-bold mb-4">
              <i className="fa fa-server mr-2 text-green-500" />
              Platform Status
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <span className={`text-sm ${tc.sub}`}>Backend: Online</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <span className={`text-sm ${tc.sub}`}>Database: Connected</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${stats.activeRides > 0 ? "bg-orange-500 animate-pulse" : "bg-gray-500"}`} />
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
