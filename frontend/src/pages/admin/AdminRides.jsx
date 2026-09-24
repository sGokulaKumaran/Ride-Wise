// ============================================================
// 🛣️ AdminRides — Ride monitoring page
//
// Features:
//   - Paginated ride table
//   - Filter by status (active/completed/cancelled)
//   - Filter by type (solo/group)
//   - View ride details (from → destination, distance, creator)
//   - Expandable group ride participant list
// ============================================================
import { useState, useEffect, useCallback } from "react";
import { getRides, getRideDetail } from "../../services/adminApi";
import { useTheme } from "../hooks/useTheme";
import AdminLayout from "./AdminLayout";
import { useAuth } from "../../context/AuthContext";

export default function AdminRides() {
  const { user } = useAuth();
  // Pass user?.id so the admin panel uses the same saved theme as the app
  const { tc } = useTheme(user?.id);
  const [rides, setRides] = useState([]);
  const [totalRides, setTotalRides] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRide, setExpandedRide] = useState(null); // { id, data }
  const [expandLoading, setExpandLoading] = useState(null);
  const SIZE = 15;

  const loadRides = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getRides(statusFilter, typeFilter, page, SIZE);
      setRides(data.rides || []);
      setTotalRides(data.totalRides || 0);
      setTotalPages(data.totalPages || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, page]);

  useEffect(() => { loadRides(); }, [loadRides]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [statusFilter, typeFilter]);

  const handleExpand = async (rideId) => {
    if (expandedRide?.id === rideId) {
      setExpandedRide(null);
      return;
    }
    try {
      setExpandLoading(rideId);
      const data = await getRideDetail(rideId);
      setExpandedRide({ id: rideId, data });
    } catch (err) {
      alert("Failed to load ride details: " + err.message);
    } finally {
      setExpandLoading(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return dateStr; }
  };

  const formatDistance = (meters) => {
    if (meters == null) return "—";
    return meters >= 1000
      ? `${(meters / 1000).toFixed(1)} km`
      : `${Math.round(meters)} m`;
  };

  const statusColors = {
    active: "text-green-500 bg-green-500/15",
    completed: "text-blue-400 bg-blue-500/15",
    cancelled: "text-red-400 bg-red-500/15",
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Ride Monitoring</h1>
            <p className={`text-sm ${tc.sub} mt-1`}>
              {totalRides} total ride{totalRides !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`px-3 py-2 rounded-xl border text-sm ${tc.input} focus:outline-none focus:ring-2 focus:ring-orange-500/50`}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={`px-3 py-2 rounded-xl border text-sm ${tc.input} focus:outline-none focus:ring-2 focus:ring-orange-500/50`}
            >
              <option value="">All Types</option>
              <option value="solo">Solo</option>
              <option value="group">Group</option>
            </select>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
            <i className="fa fa-exclamation-triangle mr-2" />
            {error}
          </div>
        )}

        {/* ── Rides Table ── */}
        <div className={`rounded-2xl border overflow-hidden ${tc.card}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${tc.divider}`}>
                  <th className="text-left px-4 py-3 font-semibold">ID</th>
                  <th className="text-left px-4 py-3 font-semibold">Creator</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Route</th>
                  <th className="text-left px-4 py-3 font-semibold">Type</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Distance</th>
                  <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Created</th>
                  <th className="text-right px-4 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="text-center py-12">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
                        <span className={tc.sub}>Loading rides…</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && rides.length === 0 && (
                  <tr>
                    <td colSpan={8} className={`text-center py-12 ${tc.sub}`}>
                      No rides found with the selected filters.
                    </td>
                  </tr>
                )}

                {!loading && rides.map((ride) => (
                  <>
                    <tr
                      key={ride.id}
                      className={`border-b ${tc.divider} transition-colors ${tc.cardHover}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs opacity-60">#{ride.id}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium truncate max-w-[120px]">
                            {ride.creatorUsername || <span className="italic opacity-50">Unknown</span>}
                          </p>
                          <p className={`text-xs ${tc.sub} truncate max-w-[120px]`}>{ride.creatorEmail}</p>
                        </div>
                      </td>
                      <td className={`px-4 py-3 hidden md:table-cell ${tc.sub}`}>
                        <div className="flex items-center gap-1 text-xs truncate max-w-[200px]">
                          <span className="text-green-500">●</span>
                          <span className="truncate">{ride.fromName || "?"}</span>
                          <i className="fa fa-arrow-right mx-1 text-[10px] opacity-40" />
                          <span className="text-red-400">●</span>
                          <span className="truncate">{ride.destinationName || "?"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${tc.record}`}>
                          <i className={`fa ${ride.rideType === "group" ? "fa-users" : "fa-motorcycle"} text-[10px]`} />
                          {ride.rideType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[ride.status] || tc.record}`}>
                          {ride.status}
                        </span>
                      </td>
                      <td className={`px-4 py-3 hidden lg:table-cell text-xs ${tc.sub}`}>
                        {formatDistance(ride.actualDistanceMeters || ride.distanceMeters)}
                      </td>
                      <td className={`px-4 py-3 hidden sm:table-cell text-xs ${tc.sub}`}>
                        {formatDate(ride.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {ride.rideType === "group" && (
                          <button
                            onClick={() => handleExpand(ride.id)}
                            disabled={expandLoading === ride.id}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tc.record} ${tc.cardHover}`}
                          >
                            {expandLoading === ride.id ? (
                              <i className="fa fa-spinner fa-spin" />
                            ) : expandedRide?.id === ride.id ? (
                              <><i className="fa fa-chevron-up mr-1" />Close</>
                            ) : (
                              <><i className="fa fa-chevron-down mr-1" />Riders</>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* ── Expanded Participant Detail ── */}
                    {expandedRide?.id === ride.id && expandedRide.data?.participants && (
                      <tr key={`${ride.id}-detail`}>
                        <td colSpan={8} className={`px-6 py-4 border-b ${tc.divider}`}>
                          <div className="space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider opacity-50">
                              Participants ({expandedRide.data.participants.length})
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {expandedRide.data.participants.map((p) => (
                                <div
                                  key={p.id}
                                  className={`flex items-center gap-3 px-3 py-2 rounded-xl ${tc.record}`}
                                >
                                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    {(p.username?.[0] || p.email?.[0] || "?").toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">
                                      {p.username || p.email}
                                      {p.role === "admin" && " 👑"}
                                    </p>
                                    <p className={`text-[11px] ${tc.sub}`}>
                                      {p.status} · {p.role}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className={`flex items-center justify-between px-4 py-3 border-t ${tc.divider}`}>
              <p className={`text-xs ${tc.sub}`}>
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-30 ${tc.record} ${tc.cardHover}`}
                >
                  <i className="fa fa-chevron-left mr-1" />Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-30 ${tc.record} ${tc.cardHover}`}
                >
                  Next<i className="fa fa-chevron-right ml-1" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
