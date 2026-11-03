// ============================================================
// AdminRides — Ride monitoring & cleanup page
//
// Features:
//   - Paginated ride table
//   - Filter by status (active/completed/cancelled)
//   - Filter by type (solo/group)
//   - View ride details (from → destination, distance, creator)
//   - Expandable group ride participant list
//   - Force-end active rides & delete any ride (two-tap confirmation)
//   - Bulk cleanup of finished (completed / cancelled) rides to free DB space
// ============================================================
import { Fragment, useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import {
  getRides,
  getRideDetail,
  endAdminRide,
  deleteAdminRide,
  cleanupFinishedRides,
} from "../../services/adminApi";
import { peekCache, writeCache, forgetCache } from "../../services/pageCache";
import { useTheme } from "../hooks/useTheme";
import AdminLayout from "./AdminLayout";
import { useAuth } from "../../context/AuthContext";
import Icon from "../components/ui/Icon";
import Button, { Chip } from "../components/ui/Button";

const SIZE = 15;
const CONFIRM_WINDOW_MS = 4000;

export default function AdminRides() {
  const { user } = useAuth();
  // Pass user?.id so the admin panel uses the same saved theme as the app
  const { tc } = useTheme(user?.id);
  const initCache = peekCache("admin-rides---0");
  const [rides, setRides] = useState(() => initCache?.rides || []);
  const [totalRides, setTotalRides] = useState(() => initCache?.totalRides || 0);
  const [totalPages, setTotalPages] = useState(() => initCache?.totalPages || 0);
  // One object: changing a filter always goes back to the first page.
  const [query, setQuery] = useState({ status: "", type: "", page: 0 });
  const [loading, setLoading] = useState(() => initCache === undefined);
  const [error, setError] = useState(null);
  const [expandedRide, setExpandedRide] = useState(null); // { id, data }
  const [expandLoading, setExpandLoading] = useState(null);

  // Per-row action state (2-tap confirm & loading)
  const [confirmAction, setConfirmAction] = useState(null); // e.g. "end-12", "del-12", "clean-30", "clean-0"
  const [busyAction, setBusyAction] = useState(null);
  const confirmTimer = useRef(null);

  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  const armConfirm = (key) => {
    setConfirmAction(key);
    clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmAction(null), CONFIRM_WINDOW_MS);
  };

  const { status: statusFilter, type: typeFilter, page, tick = 0 } = query;
  // Only a real change starts a load (re-selecting the current filter is a no-op).
  const changeQuery = (patch) => {
    const next = { ...query, ...patch };
    if (next.status === query.status && next.type === query.type && next.page === query.page) return;
    const hit = peekCache(`admin-rides-${next.status}-${next.type}-${next.page}`);
    if (hit) {
      setRides(hit.rides);
      setTotalRides(hit.totalRides);
      setTotalPages(hit.totalPages);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setExpandedRide(null);
    setConfirmAction(null);
    setQuery(next);
  };
  const setStatusFilter = (status) => changeQuery({ status, page: 0 });
  const setTypeFilter = (type) => changeQuery({ type, page: 0 });
  const setPage = (toPage) => changeQuery({ page: toPage });

  // Load the page; a slow answer for an older filter is ignored.
  useEffect(() => {
    let cancelled = false;
    getRides(statusFilter, typeFilter, page, SIZE)
      .then((data) => {
        if (cancelled) return;
        const nextRides = data.rides || [];
        const nextTotal = data.totalRides || 0;
        const nextPages = data.totalPages || 0;
        setRides(nextRides);
        writeCache(`admin-rides-${statusFilter}-${typeFilter}-${page}`, {
          rides: nextRides,
          totalRides: nextTotal,
          totalPages: nextPages,
        });
        setTotalRides(nextTotal);
        setTotalPages(nextPages);
        setError(null);
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [statusFilter, typeFilter, page, tick]);

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
      toast.error(err.message || "Couldn't load the ride's riders.");
    } finally {
      setExpandLoading(null);
    }
  };

  const handleEndRide = async (ride) => {
    if (busyAction) return;
    const key = `end-${ride.id}`;
    if (confirmAction !== key) {
      armConfirm(key);
      return;
    }
    clearTimeout(confirmTimer.current);
    setConfirmAction(null);

    try {
      setBusyAction(key);
      await endAdminRide(ride.id);
      setRides((list) =>
        list.map((r) => (r.id === ride.id ? { ...r, status: "completed" } : r))
      );
      forgetCache("admin-rides-");
      forgetCache("admin-dashboard");
      toast.success(`Ride #${ride.id} marked as completed.`);
    } catch (err) {
      toast.error(err.message || "Couldn't end that ride.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteRide = async (ride) => {
    if (busyAction) return;
    const key = `del-${ride.id}`;
    if (confirmAction !== key) {
      armConfirm(key);
      return;
    }
    clearTimeout(confirmTimer.current);
    setConfirmAction(null);

    try {
      setBusyAction(key);
      await deleteAdminRide(ride.id);
      setRides((list) => list.filter((r) => r.id !== ride.id));
      setTotalRides((n) => Math.max(0, n - 1));
      if (expandedRide?.id === ride.id) setExpandedRide(null);
      forgetCache("admin-rides-");
      forgetCache("admin-dashboard");
      toast.success(`Ride #${ride.id} permanently deleted.`);
    } catch (err) {
      toast.error(err.message || "Couldn't delete that ride.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleBulkCleanup = async (olderThanDays) => {
    if (busyAction) return;
    const key = `clean-${olderThanDays}`;
    if (confirmAction !== key) {
      armConfirm(key);
      return;
    }
    clearTimeout(confirmTimer.current);
    setConfirmAction(null);

    try {
      setBusyAction(key);
      const res = await cleanupFinishedRides(olderThanDays);
      const deletedCount = res?.deletedRides ?? 0;
      forgetCache("admin-rides-");
      forgetCache("admin-dashboard");
      setLoading(true);
      setQuery((q) => ({ ...q, page: 0, tick: (q.tick || 0) + 1 }));
      toast.success(
        deletedCount > 0
          ? `Deleted ${deletedCount} finished ride${deletedCount === 1 ? "" : "s"}.`
          : "No matching finished rides to delete."
      );
    } catch (err) {
      toast.error(err.message || "Couldn't clean up finished rides.");
    } finally {
      setBusyAction(null);
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
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Ride Monitoring</h1>
            <p className={`text-sm ${tc.sub} mt-1`}>
              {statusFilter || typeFilter
                ? `${totalRides} ride${totalRides !== 1 ? "s" : ""} match${totalRides === 1 ? "es" : ""} the filters`
                : `${totalRides} total ride${totalRides !== 1 ? "s" : ""}`}
            </p>
          </div>

          {/* Bulk Database Cleanup Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={confirmAction === "clean-30" ? "danger" : "secondary"}
              size="sm"
              icon="trash"
              loading={busyAction === "clean-30"}
              disabled={Boolean(busyAction && busyAction !== "clean-30")}
              onClick={() => handleBulkCleanup(30)}
              tc={tc}
            >
              {confirmAction === "clean-30" ? "Tap again to purge >30d" : "Purge finished >30d"}
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon="trash"
              loading={busyAction === "clean-0"}
              disabled={Boolean(busyAction && busyAction !== "clean-0")}
              onClick={() => handleBulkCleanup(0)}
              tc={tc}
            >
              {confirmAction === "clean-0" ? "Tap again to clear all finished" : "Clear all finished"}
            </Button>
          </div>
        </div>

        {/* ── Filters ── */}
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
                  <th className="text-right px-4 py-3 font-semibold">Actions</th>
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

                {!loading && rides.map((ride) => {
                  const endKey = `end-${ride.id}`;
                  const delKey = `del-${ride.id}`;
                  return (
                    <Fragment key={ride.id}>
                      <tr
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
                          {formatDistance(ride.actualDistanceMeters ?? ride.distanceMeters)}
                        </td>
                        <td className={`px-4 py-3 hidden sm:table-cell text-xs ${tc.sub}`}>
                          {formatDate(ride.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
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
                            {ride.status === "active" && (
                              <Button
                                variant="secondary"
                                size="sm"
                                icon="finish"
                                loading={busyAction === endKey}
                                disabled={Boolean(busyAction && busyAction !== endKey)}
                                onClick={() => handleEndRide(ride)}
                                tc={tc}
                              >
                                {confirmAction === endKey ? "Tap to end" : "End"}
                              </Button>
                            )}
                            <Button
                              variant="danger"
                              size="sm"
                              icon="trash"
                              loading={busyAction === delKey}
                              disabled={Boolean(busyAction && busyAction !== delKey)}
                              onClick={() => handleDeleteRide(ride)}
                              tc={tc}
                            >
                              {confirmAction === delKey ? "Tap again" : "Delete"}
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* ── Expanded Participant Detail ── */}
                      {expandedRide?.id === ride.id && expandedRide.data?.participants && (
                        <tr>
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
                    </Fragment>
                  );
                })}
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
                  onClick={() => setPage(Math.max(0, page - 1))}
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
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
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
