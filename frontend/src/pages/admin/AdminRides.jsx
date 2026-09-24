// ============================================================
// AdminRides — Ride monitoring page
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
import Icon from "../components/ui/Icon";
import Button, { Chip } from "../components/ui/Button";

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

  // Status pills are functional only: tinted surface + hairline border.
  const statusPill = {
    active: `border ${tc.accentSoft}`,
    completed: `border ${tc.divider} ${tc.surface2} ${tc.ok}`,
    cancelled: `border ${tc.dangerSoft}`,
  };
  const statusPillClass = (status) => statusPill[status] || `${tc.surface2} ${tc.sub}`;

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
          <div className="flex flex-wrap items-center gap-2">
            <Chip selected={statusFilter === ""} onClick={() => setStatusFilter("")} tc={tc}>All Statuses</Chip>
            <Chip selected={statusFilter === "active"} onClick={() => setStatusFilter("active")} tc={tc}>Active</Chip>
            <Chip selected={statusFilter === "completed"} onClick={() => setStatusFilter("completed")} tc={tc}>Completed</Chip>
            <Chip selected={statusFilter === "cancelled"} onClick={() => setStatusFilter("cancelled")} tc={tc}>Cancelled</Chip>
            <span className={`w-px h-4 self-center ${tc.surface2}`} />
            <Chip selected={typeFilter === ""} onClick={() => setTypeFilter("")} tc={tc}>All Types</Chip>
            <Chip selected={typeFilter === "solo"} onClick={() => setTypeFilter("solo")} tc={tc}>Solo</Chip>
            <Chip selected={typeFilter === "group"} onClick={() => setTypeFilter("group")} tc={tc}>Group</Chip>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className={`flex items-center gap-2 p-4 rounded-xl border text-sm ${tc.dangerSoft}`}>
            <Icon name="alertTriangle" size={16} />
            {error}
          </div>
        )}

        {/* ── Rides Table ── */}
        <div className={`rounded-xl border overflow-hidden ${tc.card}`}>
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
                        <Icon name="spinner" size={16} className="rw-spin" />
                        <span className={tc.sub}>Loading rides…</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && rides.length === 0 && (
                  <tr>
                    <td colSpan={8} className={`text-center py-12 ${tc.sub}`}>
                      <div className="flex flex-col items-center gap-3">
                        <Icon name="list" size={28} />
                        <span>No rides found with the selected filters.</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && rides.map((ride) => (
                  <>
                    <tr
                      key={ride.id}
                      className={`border-b ${tc.divider} transition-colors ${tc.cardHover}`}
                    >
                      <td className={`px-4 py-3 font-mono text-xs ${tc.sub}`}>#{ride.id}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium truncate max-w-[120px]">
                            {ride.creatorUsername || <span className={`italic ${tc.sub}`}>Unknown</span>}
                          </p>
                          <p className={`text-xs ${tc.sub} truncate max-w-[120px]`}>{ride.creatorEmail}</p>
                        </div>
                      </td>
                      <td className={`px-4 py-3 hidden md:table-cell ${tc.sub}`}>
                        <div className="flex items-center gap-1 text-xs truncate max-w-[200px]">
                          <Icon name="dotFilled" size={12} />
                          <span className="truncate">{ride.fromName || "?"}</span>
                          <Icon name="arrowRight" size={12} className="mx-1" />
                          <Icon name="dotFilled" size={12} />
                          <span className="truncate">{ride.destinationName || "?"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${tc.surface2} ${tc.sub}`}>
                          <Icon name={ride.rideType === "group" ? "riders" : "ride"} size={12} />
                          {ride.rideType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${statusPillClass(ride.status)}`}>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={expandedRide?.id === ride.id ? "chevronUp" : "chevronDown"}
                            loading={expandLoading === ride.id}
                            onClick={() => handleExpand(ride.id)}
                            tc={tc}
                          >
                            {expandedRide?.id === ride.id ? "Close" : "Riders"}
                          </Button>
                        )}
                      </td>
                    </tr>

                    {/* ── Expanded Participant Detail ── */}
                    {expandedRide?.id === ride.id && expandedRide.data?.participants && (
                      <tr key={`${ride.id}-detail`}>
                        <td colSpan={8} className={`px-6 py-4 border-b ${tc.divider}`}>
                          <div className="space-y-2">
                            <p className={`text-xs font-semibold uppercase tracking-wider ${tc.sub}`}>
                              Participants ({expandedRide.data.participants.length})
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {expandedRide.data.participants.map((p) => (
                                <div
                                  key={p.id}
                                  className={`flex items-center gap-3 px-3 py-2 rounded-lg ${tc.surface2}`}
                                >
                                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${tc.button}`}>
                                    {(p.username?.[0] || p.email?.[0] || "?").toUpperCase()}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">
                                      {p.username || p.email}
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
                <Button
                  variant="ghost"
                  size="sm"
                  icon="chevronLeft"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  tc={tc}
                >
                  Prev
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="chevronRight"
                  iconRight
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  tc={tc}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
