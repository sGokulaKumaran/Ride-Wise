// ============================================================
// AdminUsers — User management page
//
// Features:
//   - Paginated user table (the server does the paging, also for searches)
//   - Search by username/email
//   - View user details (role, enabled status, created date)
//   - Suspend / re-enable user accounts. Suspending asks for a second tap
//     on the same button instead of a browser pop-up.
//   - Does NOT expose passwords or password hashes
// ============================================================
import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { getUsers, updateUserStatus } from "../../services/adminApi";
import { useTheme } from "../hooks/useTheme";
import AdminLayout from "./AdminLayout";
import { useAuth } from "../../context/AuthContext";
import Icon from "../components/ui/Icon";
import Button from "../components/ui/Button";

const SIZE = 15;
const SEARCH_DELAY_MS = 400;   // wait for a pause in typing before asking
const CONFIRM_WINDOW_MS = 4000; // how long "Confirm suspend" stays armed

export default function AdminUsers() {
  const { user } = useAuth();
  // Pass user?.id so the admin panel uses the same saved theme as the app
  const { tc } = useTheme(user?.id);
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  // One object: a new search always starts on the first page.
  const [query, setQuery] = useState({ search: "", page: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // userId being toggled
  const [confirmId, setConfirmId] = useState(null);         // userId waiting for the second tap
  const searchTimer = useRef(null);
  const confirmTimer = useRef(null);
  // The latest query, readable from the debounce timer without a stale closure.
  const queryRef = useRef(query);

  const { search, page } = query;

  useEffect(() => () => {
    clearTimeout(searchTimer.current);
    clearTimeout(confirmTimer.current);
  }, []);

  // Load the page; a slow answer for an older search is ignored.
  useEffect(() => {
    let cancelled = false;
    getUsers(search, page, SIZE)
      .then((data) => {
        if (cancelled) return;
        setUsers(data.users || []);
        setTotalUsers(data.totalUsers || 0);
        setTotalPages(data.totalPages ?? Math.ceil((data.totalUsers || 0) / SIZE));
        setError(null);
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search, page]);

  // Only a real change starts a load (otherwise "Loading…" would never clear).
  const changeQuery = (next) => {
    if (next.search === queryRef.current.search && next.page === queryRef.current.page) return;
    queryRef.current = next;
    setLoading(true);
    setConfirmId(null);
    setQuery(next);
  };

  // Debounced search
  const handleSearchInput = (value) => {
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => changeQuery({ search: value.trim(), page: 0 }),
      SEARCH_DELAY_MS,
    );
  };

  const setPage = (toPage) => changeQuery({ search: queryRef.current.search, page: toPage });

  const handleToggleStatus = async (target) => {
    if (actionLoading) return;

    // Suspending signs the rider out everywhere — ask for a second tap.
    if (target.enabled && confirmId !== target.id) {
      setConfirmId(target.id);
      clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmId(null), CONFIRM_WINDOW_MS);
      return;
    }
    clearTimeout(confirmTimer.current);
    setConfirmId(null);

    try {
      setActionLoading(target.id);
      await updateUserStatus(target.id, !target.enabled);
      setUsers((list) => list.map((u) => (u.id === target.id ? { ...u, enabled: !target.enabled } : u)));
      const name = target.username || target.email;
      toast.success(target.enabled ? `${name} is suspended.` : `${name} can sign in again.`);
    } catch (err) {
      toast.error(err.message || "Couldn't change that account. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        year: "numeric", month: "short", day: "numeric",
      });
    } catch { return dateStr; }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className={`text-sm ${tc.sub} mt-1`}>
              {search
                ? `${totalUsers} user${totalUsers !== 1 ? "s" : ""} matching “${search}”`
                : `${totalUsers} total user${totalUsers !== 1 ? "s" : ""} registered`}
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Icon name="search" size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${tc.sub}`} />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search by username or email…"
              aria-label="Search users by username or email"
              className={`w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm ${tc.input}`}
            />
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className={`flex items-center gap-2 p-4 rounded-xl border text-sm ${tc.dangerSoft}`}>
            <Icon name="alertTriangle" size={16} />
            {error}
          </div>
        )}

        {/* ── Users Table ── */}
        <div className={`rounded-xl border overflow-hidden ${tc.card}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${tc.divider}`}>
                  <th className="text-left px-4 py-3 font-semibold">ID</th>
                  <th className="text-left px-4 py-3 font-semibold">Username</th>
                  <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Email</th>
                  <th className="text-left px-4 py-3 font-semibold">Role</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Joined</th>
                  <th className="text-right px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <div className="inline-flex items-center gap-2">
                        <Icon name="spinner" size={16} className="rw-spin" />
                        <span className={tc.sub}>Loading users…</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={7} className={`text-center py-12 ${tc.sub}`}>
                      <div className="flex flex-col items-center gap-3">
                        <Icon name="list" size={28} />
                        <span>
                          {search ? "No users found matching your search." : "No users registered yet."}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && users.map((u) => {
                  const isAdminAccount = u.role === "ADMIN";
                  const confirming = confirmId === u.id;
                  return (
                    <tr
                      key={u.id}
                      className={`border-b ${tc.divider} transition-colors ${tc.cardHover}`}
                    >
                      <td className={`px-4 py-3 font-mono text-xs ${tc.sub}`}>#{u.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${tc.button}`}>
                            {(u.username?.[0] || u.email?.[0] || "?").toUpperCase()}
                          </span>
                          <span className="font-medium truncate max-w-[120px]">
                            {u.username || <span className={`italic ${tc.sub}`}>Not set</span>}
                          </span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 hidden sm:table-cell truncate max-w-[200px] ${tc.sub}`}>
                        {u.email}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${tc.surface2} ${tc.sub} ${tc.divider}`}>
                          {isAdminAccount && <Icon name="shield" size={14} />}
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          u.enabled ? tc.ok : tc.danger
                        }`}>
                          <span className="w-2 h-2 rounded-full bg-current" />
                          {u.enabled ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td className={`px-4 py-3 hidden md:table-cell text-xs ${tc.sub}`}>
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant={u.enabled ? "danger" : "secondary"}
                          size="sm"
                          icon={u.enabled ? "ban" : "check"}
                          loading={actionLoading === u.id}
                          onClick={() => handleToggleStatus(u)}
                          disabled={isAdminAccount}
                          title={isAdminAccount ? "Admin accounts can't be suspended" : undefined}
                          tc={tc}
                        >
                          {u.enabled ? (confirming ? "Tap again to suspend" : "Suspend") : "Enable"}
                        </Button>
                      </td>
                    </tr>
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
