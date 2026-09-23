// ============================================================
// 👥 AdminUsers — User management page
//
// Features:
//   - Paginated user table
//   - Search by username/email
//   - View user details (role, enabled status, created date)
//   - Enable/disable user accounts
//   - Does NOT expose passwords or password hashes
// ============================================================
import { useState, useEffect, useCallback } from "react";
import { getUsers, updateUserStatus } from "../../services/adminApi";
import { useTheme } from "../hooks/useTheme";
import AdminLayout from "./AdminLayout";

export default function AdminUsers() {
  const { tc } = useTheme();
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // userId being toggled
  const SIZE = 15;

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUsers(search, page, SIZE);
      setUsers(data.users || []);
      setTotalUsers(data.totalUsers || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleToggleStatus = async (userId, currentEnabled) => {
    if (actionLoading) return;
    const action = currentEnabled ? "suspend" : "enable";
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      setActionLoading(userId);
      await updateUserStatus(userId, !currentEnabled);
      // Refresh the list
      await loadUsers();
    } catch (err) {
      alert("Failed: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(totalUsers / SIZE);

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
              {totalUsers} total user{totalUsers !== 1 ? "s" : ""} registered
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <i className={`fa fa-search absolute left-3 top-1/2 -translate-y-1/2 ${tc.sub} text-sm`} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by username or email…"
              className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm ${tc.input} focus:outline-none focus:ring-2 focus:ring-orange-500/50`}
            />
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
            <i className="fa fa-exclamation-triangle mr-2" />
            {error}
          </div>
        )}

        {/* ── Users Table ── */}
        <div className={`rounded-2xl border overflow-hidden ${tc.card}`}>
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
                        <div className="w-5 h-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
                        <span className={tc.sub}>Loading users…</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={7} className={`text-center py-12 ${tc.sub}`}>
                      {search ? "No users found matching your search." : "No users registered yet."}
                    </td>
                  </tr>
                )}

                {!loading && users.map((u) => (
                  <tr
                    key={u.id}
                    className={`border-b ${tc.divider} transition-colors ${tc.cardHover}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs opacity-60">#{u.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {(u.username?.[0] || u.email?.[0] || "?").toUpperCase()}
                        </div>
                        <span className="font-medium truncate max-w-[120px]">
                          {u.username || <span className="italic opacity-50">Not set</span>}
                        </span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 hidden sm:table-cell truncate max-w-[200px] ${tc.sub}`}>
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                        u.role === "ADMIN"
                          ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white"
                          : `${tc.record} ${tc.text}`
                      }`}>
                        {u.role === "ADMIN" && <i className="fa fa-shield-alt text-[10px]" />}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                        u.enabled ? "text-green-500" : "text-red-400"
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${u.enabled ? "bg-green-500" : "bg-red-400"}`} />
                        {u.enabled ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className={`px-4 py-3 hidden md:table-cell text-xs ${tc.sub}`}>
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleToggleStatus(u.id, u.enabled)}
                        disabled={actionLoading === u.id || u.role === "ADMIN"}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                          u.enabled
                            ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                            : "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                        }`}
                        title={u.role === "ADMIN" ? "Cannot modify admin accounts" : ""}
                      >
                        {actionLoading === u.id ? (
                          <i className="fa fa-spinner fa-spin" />
                        ) : u.enabled ? (
                          <><i className="fa fa-ban mr-1" />Suspend</>
                        ) : (
                          <><i className="fa fa-check mr-1" />Enable</>
                        )}
                      </button>
                    </td>
                  </tr>
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
