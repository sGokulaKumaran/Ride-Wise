// ============================================================
// AccountMenu — Profile dropdown at the bottom of the Sidebar
//
// SHOWS:
//   - User's avatar letter + username + email
//   - Dropdown menu with: My Profile, My Rides, Settings, Log Out
//
// BEHAVIOR:
//   - Clicking the section opens/closes the dropdown
//   - Clicking outside closes the dropdown
//   - logout() navigates back to / automatically (via ProtectedRoute)
//
// BACKEND-READY:
//   Uses useAuth() — when you add a backend, the user object here
//   will automatically reflect the real server data.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import Icon from "../ui/Icon";

export default function AccountMenu({ tc }) {
  const navigate = useNavigate();
  const { user, avatarLetter, logout } = useAuth();

  // ── Dropdown open/close state ────────────────────────────────
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // ── Close dropdown when clicking outside it ──────────────────
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Menu items ───────────────────────────────────────────────
  // Settings is ONLY accessible via this dropdown (not in the sidebar nav)
  const menuItems = [
    { icon: "user",     label: "My Profile", action: () => navigate("/account")  },
    { icon: "settings", label: "Settings",   action: () => navigate("/settings") },
  ];

  // ── Handle logout: close menu, then call logout ──────────────
  const handleLogout = () => {
    setOpen(false);
    logout(); // clears auth state → ProtectedRoute redirects to /
  };

  return (
    <div ref={menuRef} className="relative mt-auto">

      {/* ── Dropdown panel (appears above the profile section) ── */}
      {open && (
        <div
          className={`absolute bottom-full mb-2 left-0 right-0 rounded-xl border overflow-hidden z-50 ${tc.card}`}
        >
          {/* User info header inside dropdown */}
          <div className={`px-4 py-3 border-b ${tc.divider}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold text-sm shrink-0 ${tc.button}`}>
                {avatarLetter}
              </div>
              <div className="overflow-hidden">
                <p className="font-bold text-sm truncate">
                  {user?.username ? `@${user.username}` : "Set username →"}
                </p>
                <p className={`text-xs truncate ${tc.sub}`}>{user?.email || ""}</p>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1.5">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => { setOpen(false); item.action(); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left ${tc.cardHover}`}
              >
                <Icon name={item.icon} size={16} className={tc.sub} />
                {item.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className={`border-t ${tc.divider}`} />

          {/* Log out */}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${tc.danger} ${tc.cardHover}`}
          >
            <Icon name="logout" size={16} />
            Log out
          </button>
        </div>
      )}

      {/* ── Profile trigger button (always visible at bottom of sidebar) ── */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${tc.card} ${tc.cardHover}`}
      >
        {/* Avatar circle */}
        <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm shrink-0 ${tc.button}`}>
          {avatarLetter}
        </div>

        {/* Username + email */}
        <div className="flex-1 overflow-hidden text-left">
          <p className="font-bold text-sm truncate">
            {user?.username || "Complete profile"}
          </p>
          <p className={`text-xs truncate ${tc.sub}`}>
            {user?.email || ""}
          </p>
        </div>

        {/* Caret icon — rotates when open */}
        <Icon
          name="chevronUp"
          size={14}
          className={`${tc.sub} transition-transform duration-300 ${
            open ? "" : "rotate-180"
          }`}
        />
      </button>
    </div>
  );
}
