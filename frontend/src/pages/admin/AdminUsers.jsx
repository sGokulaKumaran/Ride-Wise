// ============================================================
// AdminUsers — User management page
//
// Features:
//   - Paginated user table (the server does the paging, also for searches)
//   - Search by username/email
//   - View user details (role, enabled status, created date, stats)
//   - Full admin account editor: username, email, password reset,
//     mobile, address, role (USER / ADMIN), enabled status,
//     public profile visibility, and auto-delete ride retention
//   - Suspend / re-enable or permanently delete user accounts with
//     two-tap confirmation instead of browser pop-ups
// ============================================================
import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import {
  getUsers,
  getUserDetail,
  updateUserStatus,
  updateUser,
  deleteUser,
} from "../../services/adminApi";
import { peekCache, writeCache, forgetCache } from "../../services/pageCache";
import { useTheme } from "../hooks/useTheme";
import AdminLayout from "./AdminLayout";
import { useAuth } from "../../context/AuthContext";
import Icon from "../components/ui/Icon";
import Button, { Chip } from "../components/ui/Button";

const SIZE = 15;
const SEARCH_DELAY_MS = 400;   // wait for a pause in typing before asking
const CONFIRM_WINDOW_MS = 4000; // how long 2-tap confirmation stays armed

const AUTO_DELETE_OPTIONS = [
  { days: 0,  label: "Never" },
  { days: 1,  label: "1 day" },
  { days: 7,  label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

export default function AdminUsers() {
  const { user } = useAuth();
  // Pass user?.id so the admin panel uses the same saved theme as the app
  const { tc } = useTheme(user?.id);
  const cachedInit = peekCache("admin-users--0");
  const [users, setUsers] = useState(() => cachedInit?.users || []);
  const [totalUsers, setTotalUsers] = useState(() => cachedInit?.totalUsers || 0);
  const [totalPages, setTotalPages] = useState(() => cachedInit?.totalPages || 0);
  // One object: a new search always starts on the first page.
  const [query, setQuery] = useState({ search: "", page: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(() => cachedInit === undefined);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // userId being toggled
  const [confirmId, setConfirmId] = useState(null);         // userId waiting for second tap to suspend

  // Edit drawer / modal state
  const [editingUser, setEditingUser] = useState(null);
  const [detailStats, setDetailStats] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    username: "",
    email: "",
    password: "",
    mobile: "",
    address: "",
    role: "USER",
    enabled: true,
    profilePublic: true,
    autoDeleteRidesDays: 0,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const searchTimer = useRef(null);
  const confirmTimer = useRef(null);
  const deleteConfirmTimer = useRef(null);
  // The latest query, readable from the debounce timer without a stale closure.
  const queryRef = useRef(query);

  const { search, page } = query;

  useEffect(() => () => {
    clearTimeout(searchTimer.current);
    clearTimeout(confirmTimer.current);
    clearTimeout(deleteConfirmTimer.current);
  }, []);

  // Load the page; a slow answer for an older search is ignored.
  useEffect(() => {
    let cancelled = false;
    getUsers(search, page, SIZE)
      .then((data) => {
        if (cancelled) return;
        const nextUsers = data.users || [];
        const nextTotal = data.totalUsers || 0;
        const nextPages = data.totalPages ?? Math.ceil(nextTotal / SIZE);
        setUsers(nextUsers);
        writeCache(`admin-users-${search}-${page}`, {
          users: nextUsers,
          totalUsers: nextTotal,
          totalPages: nextPages,
        });
        setTotalUsers(nextTotal);
        setTotalPages(nextPages);
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
    const hit = peekCache(`admin-users-${next.search}-${next.page}`);
    if (hit) {
      setUsers(hit.users);
      setTotalUsers(hit.totalUsers);
      setTotalPages(hit.totalPages);
      setLoading(false);
    } else {
      setLoading(true);
    }
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
      setUsers((list) =>
        list.map((u) => (u.id === target.id ? { ...u, enabled: !target.enabled } : u))
      );
      forgetCache("admin-users-");
      const name = target.username || target.email;
      toast.success(target.enabled ? `${name} is suspended.` : `${name} can sign in again.`);
    } catch (err) {
      toast.error(err.message || "Couldn't change that account. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  // Open the full account editor modal and load extended user details
  const openEditModal = async (target) => {
    setEditingUser(target);
    setDetailStats(null);
    setShowPassword(false);
    setConfirmDeleteId(null);
    setEditForm({
      username: target.username || "",
      email: target.email || "",
      password: "",
      mobile: target.mobile || "",
      address: target.address || "",
      role: target.role || "USER",
      enabled: target.enabled !== false,
      profilePublic: target.profilePublic !== false,
      autoDeleteRidesDays: target.autoDeleteRidesDays || 0,
    });

    try {
      setDetailLoading(true);
      const detail = await getUserDetail(target.id);
      setDetailStats(detail);
      setEditForm((prev) => ({
        ...prev,
        username: detail.username ?? prev.username,
        email: detail.email ?? prev.email,
        mobile: detail.mobile ?? prev.mobile,
        address: detail.address ?? prev.address,
        role: detail.role ?? prev.role,
        enabled: detail.enabled !== false,
        profilePublic: detail.profilePublic !== false,
        autoDeleteRidesDays: detail.autoDeleteRidesDays || 0,
      }));
    } catch {
      // Keep the row's initial values if the detail fetch fails
    } finally {
      setDetailLoading(false);
    }
  };

  const closeEditModal = () => {
    if (savingEdit || deletingUser) return;
    setEditingUser(null);
    setDetailStats(null);
    setConfirmDeleteId(null);
    clearTimeout(deleteConfirmTimer.current);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser || savingEdit) return;

    const trimmedEmail = editForm.email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (editForm.password && editForm.password.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }

    const payload = {
      username: editForm.username.trim(),
      email: trimmedEmail,
      mobile: editForm.mobile.trim(),
      address: editForm.address.trim(),
      role: editForm.role,
      enabled: editForm.enabled,
      profilePublic: editForm.profilePublic,
      autoDeleteRidesDays: Number(editForm.autoDeleteRidesDays) || 0,
    };
    if (editForm.password) {
      payload.password = editForm.password;
    }

    try {
      setSavingEdit(true);
      const updated = await updateUser(editingUser.id, payload);
      setUsers((list) =>
        list.map((u) => (u.id === editingUser.id ? { ...u, ...updated } : u))
      );
      forgetCache("admin-users-");
      forgetCache("admin-dashboard");

      // Keep local cached user in sync if admin edited their own profile
      if (editingUser.id === user?.id) {
        try {
          const saved = JSON.parse(localStorage.getItem("ridewise-user") || "null");
          if (saved && saved.id === user.id) {
            localStorage.setItem(
              "ridewise-user",
              JSON.stringify({
                ...saved,
                username: updated.username,
                email: updated.email,
                mobile: updated.mobile,
                address: updated.address,
                autoDeleteRidesDays: updated.autoDeleteRidesDays,
              })
            );
          }
        } catch {
          // ignore storage errors
        }
      }

      toast.success(
        editForm.password
          ? `Updated ${updated.username || updated.email} and reset password.`
          : `Saved changes for ${updated.username || updated.email}.`
      );
      setEditingUser(null);
    } catch (err) {
      toast.error(err.message || "Couldn't update that user account.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!editingUser || deletingUser) return;

    if (confirmDeleteId !== editingUser.id) {
      setConfirmDeleteId(editingUser.id);
      clearTimeout(deleteConfirmTimer.current);
      deleteConfirmTimer.current = setTimeout(() => setConfirmDeleteId(null), CONFIRM_WINDOW_MS);
      return;
    }
    clearTimeout(deleteConfirmTimer.current);
    setConfirmDeleteId(null);

    try {
      setDeletingUser(true);
      const targetName = editingUser.username || editingUser.email;
      await deleteUser(editingUser.id);
      setUsers((list) => list.filter((u) => u.id !== editingUser.id));
      setTotalUsers((n) => Math.max(0, n - 1));
      forgetCache("admin-users-");
      forgetCache("admin-dashboard");
      toast.success(`Permanently deleted ${targetName}.`);
      setEditingUser(null);
    } catch (err) {
      toast.error(err.message || "Couldn't delete that user account.");
    } finally {
      setDeletingUser(false);
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

  const isSelfEdit = editingUser && editingUser.id === user?.id;

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
                  const isSelf = u.id === user?.id;
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
                          <div className="min-w-0">
                            <span className="font-medium truncate block max-w-[140px]">
                              {u.username || <span className={`italic ${tc.sub}`}>Not set</span>}
                            </span>
                            {u.mobile && (
                              <span className={`text-[11px] block truncate max-w-[140px] ${tc.sub}`}>
                                {u.mobile}
                              </span>
                            )}
                          </div>
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
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon="edit"
                            onClick={() => openEditModal(u)}
                            tc={tc}
                          >
                            Edit
                          </Button>
                          <Button
                            variant={u.enabled ? "danger" : "secondary"}
                            size="sm"
                            icon={u.enabled ? "ban" : "check"}
                            loading={actionLoading === u.id}
                            onClick={() => handleToggleStatus(u)}
                            disabled={isSelf}
                            title={isSelf ? "You cannot suspend your own account" : undefined}
                            tc={tc}
                          >
                            {u.enabled ? (confirming ? "Tap again" : "Suspend") : "Enable"}
                          </Button>
                        </div>
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

      {/* ── Edit Account Modal ── */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={closeEditModal}
        >
          <div
            className={`w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${tc.card}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${tc.divider}`}>
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${tc.button}`}>
                  {(editingUser.username?.[0] || editingUser.email?.[0] || "?").toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold truncate">
                      Edit Account #{editingUser.id}
                    </h2>
                    {isSelfEdit && (
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${tc.surface2} ${tc.sub}`}>
                        You
                      </span>
                    )}
                  </div>
                  <p className={`text-xs truncate ${tc.sub}`}>
                    Joined {formatDate(editingUser.createdAt)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                aria-label="Close editor"
                className={`p-2 rounded-lg transition-colors ${tc.cardHover} ${tc.sub}`}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Quick Account Stats */}
            <div className={`grid grid-cols-3 gap-2 px-6 py-3 border-b text-center ${tc.surface2} ${tc.divider}`}>
              <div>
                <p className={`text-[11px] uppercase tracking-wider ${tc.sub}`}>Rides</p>
                <p className="text-sm font-bold mt-0.5">
                  {detailLoading ? "…" : (detailStats?.ridesCount ?? "—")}
                </p>
              </div>
              <div>
                <p className={`text-[11px] uppercase tracking-wider ${tc.sub}`}>Connections</p>
                <p className="text-sm font-bold mt-0.5">
                  {detailLoading ? "…" : (detailStats?.connectionsCount ?? "—")}
                </p>
              </div>
              <div>
                <p className={`text-[11px] uppercase tracking-wider ${tc.sub}`}>Organizations</p>
                <p className="text-sm font-bold mt-0.5">
                  {detailLoading ? "…" : (detailStats?.ownedOrgsCount ?? "—")}
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-5">
              {/* Identity & Credentials */}
              <div className="space-y-3">
                <p className={`text-xs font-semibold uppercase tracking-wider ${tc.sub}`}>
                  Identity & Credentials
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${tc.sub}`}>
                      Username
                    </label>
                    <div className="relative">
                      <Icon name="at" size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${tc.sub}`} />
                      <input
                        type="text"
                        value={editForm.username}
                        onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                        placeholder="Username"
                        className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm ${tc.input}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1 ${tc.sub}`}>
                      Email Address
                    </label>
                    <div className="relative">
                      <Icon name="mail" size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${tc.sub}`} />
                      <input
                        type="email"
                        required
                        value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="user@example.com"
                        className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm ${tc.input}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Password Reset */}
                <div>
                  <label className={`block text-xs font-medium mb-1 ${tc.sub}`}>
                    Reset Password <span className="font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <Icon name="key" size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${tc.sub}`} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={editForm.password}
                      onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Leave blank to keep existing password"
                      autoComplete="new-password"
                      className={`w-full pl-9 pr-10 py-2 rounded-lg border text-sm ${tc.input}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded ${tc.sub}`}
                    >
                      <Icon name={showPassword ? "eyeOff" : "eye"} size={15} />
                    </button>
                  </div>
                  <p className={`text-[11px] mt-1 ${tc.sub}`}>
                    Min 6 characters. Setting a new password clears login lockouts and signs out active sessions.
                  </p>
                </div>
              </div>

              {/* Contact & Location */}
              <div className="space-y-3">
                <p className={`text-xs font-semibold uppercase tracking-wider ${tc.sub}`}>
                  Contact & Profile
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${tc.sub}`}>
                      Mobile Number
                    </label>
                    <div className="relative">
                      <Icon name="phone" size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${tc.sub}`} />
                      <input
                        type="tel"
                        value={editForm.mobile}
                        onChange={(e) => setEditForm((f) => ({ ...f, mobile: e.target.value }))}
                        placeholder="Mobile number"
                        className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm ${tc.input}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1 ${tc.sub}`}>
                      City / Address
                    </label>
                    <div className="relative">
                      <Icon name="city" size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${tc.sub}`} />
                      <input
                        type="text"
                        value={editForm.address}
                        onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                        placeholder="City or address"
                        className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm ${tc.input}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Role, Status & Retention */}
              <div className="space-y-3">
                <p className={`text-xs font-semibold uppercase tracking-wider ${tc.sub}`}>
                  Permissions & Data Retention
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Role */}
                  <div className={`p-3 rounded-xl border ${tc.surface2} ${tc.divider}`}>
                    <p className={`text-xs font-medium mb-2 ${tc.sub}`}>Role</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Chip
                        selected={editForm.role === "USER"}
                        disabled={isSelfEdit}
                        onClick={() => setEditForm((f) => ({ ...f, role: "USER" }))}
                        tc={tc}
                      >
                        USER
                      </Chip>
                      <Chip
                        selected={editForm.role === "ADMIN"}
                        disabled={isSelfEdit}
                        onClick={() => setEditForm((f) => ({ ...f, role: "ADMIN" }))}
                        tc={tc}
                      >
                        ADMIN
                      </Chip>
                    </div>
                  </div>

                  {/* Account Status */}
                  <div className={`p-3 rounded-xl border ${tc.surface2} ${tc.divider}`}>
                    <p className={`text-xs font-medium mb-2 ${tc.sub}`}>Account Status</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Chip
                        selected={editForm.enabled}
                        disabled={isSelfEdit}
                        onClick={() => setEditForm((f) => ({ ...f, enabled: true }))}
                        tc={tc}
                      >
                        Active
                      </Chip>
                      <Chip
                        selected={!editForm.enabled}
                        disabled={isSelfEdit}
                        onClick={() => setEditForm((f) => ({ ...f, enabled: false }))}
                        tc={tc}
                      >
                        Suspended
                      </Chip>
                    </div>
                  </div>

                  {/* Profile Visibility */}
                  <div className={`p-3 rounded-xl border ${tc.surface2} ${tc.divider}`}>
                    <p className={`text-xs font-medium mb-2 ${tc.sub}`}>Profile Privacy</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Chip
                        selected={editForm.profilePublic}
                        onClick={() => setEditForm((f) => ({ ...f, profilePublic: true }))}
                        tc={tc}
                      >
                        Public
                      </Chip>
                      <Chip
                        selected={!editForm.profilePublic}
                        onClick={() => setEditForm((f) => ({ ...f, profilePublic: false }))}
                        tc={tc}
                      >
                        Private
                      </Chip>
                    </div>
                  </div>
                </div>

                {/* Auto-Delete Ride Retention */}
                <div className={`p-3 rounded-xl border ${tc.surface2} ${tc.divider}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium">Auto-delete completed rides</p>
                      <p className={`text-[11px] ${tc.sub}`}>
                        Automatically purge this user&apos;s finished rides older than the selected time
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {AUTO_DELETE_OPTIONS.map((opt) => (
                        <Chip
                          key={opt.days}
                          selected={Number(editForm.autoDeleteRidesDays || 0) === opt.days}
                          onClick={() => setEditForm((f) => ({ ...f, autoDeleteRidesDays: opt.days }))}
                          tc={tc}
                        >
                          {opt.label}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Danger Zone — Delete Account */}
              {!isSelfEdit && (
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border ${tc.dangerSoft}`}>
                  <div>
                    <p className="text-xs font-semibold">Permanently delete account</p>
                    <p className={`text-[11px] opacity-80`}>
                      Deletes this user, their rides, connections, and owned organizations.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    icon="trash"
                    loading={deletingUser}
                    onClick={handleDeleteUser}
                    tc={tc}
                  >
                    {confirmDeleteId === editingUser.id
                      ? "Tap again to delete"
                      : "Delete Account"}
                  </Button>
                </div>
              )}

              {/* Modal Actions */}
              <div className={`flex items-center justify-end gap-2 pt-3 border-t ${tc.divider}`}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={closeEditModal}
                  disabled={savingEdit || deletingUser}
                  tc={tc}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  icon="check"
                  loading={savingEdit}
                  disabled={deletingUser}
                  tc={tc}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
