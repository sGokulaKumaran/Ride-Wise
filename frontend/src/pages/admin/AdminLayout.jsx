// ============================================================
// 🛡️ AdminLayout — Wrapper layout for all admin pages
//
// Provides a simple tab navigation (Dashboard, Users, Rides)
// and a "Back to RideWise" link. Uses the existing theme system.
// ============================================================
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../hooks/useTheme";

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, avatarLetter } = useAuth();
  // Pass user?.id so the admin panel uses the same saved theme as the app
  const { tc } = useTheme(user?.id);

  const tabs = [
    { path: "/admin",       label: "Dashboard", icon: "fa-tachometer-alt" },
    { path: "/admin/users", label: "Users",     icon: "fa-users" },
    { path: "/admin/rides", label: "Rides",     icon: "fa-road" },
  ];

  const isActive = (path) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  return (
    <div className={`min-h-screen ${tc.bg} ${tc.text}`}>
      {/* ── Top Header ──────────────────────────────────────── */}
      <header className={`sticky top-0 z-50 backdrop-blur-xl border-b ${tc.divider} ${tc.bar}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo + Admin badge */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/admin")}
                className="flex items-center gap-2 group"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 ${tc.button} text-sm`}>
                  <i className="fa fa-shield-alt" />
                </div>
                <span className="text-lg font-bold tracking-tight">
                  Ride<span className="opacity-50">Wise</span>
                </span>
              </button>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white">
                ADMIN
              </span>
            </div>

            {/* Right: Back to app + user info */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/home")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105 ${tc.card} border`}
              >
                <i className="fa fa-arrow-left text-xs" />
                <span className="hidden sm:inline">Back to RideWise</span>
                <span className="sm:hidden">Back</span>
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                  {avatarLetter}
                </div>
                <span className="hidden sm:block text-sm font-medium truncate max-w-[120px]">
                  {user?.username || user?.email}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Tab Navigation ──────────────────────────────────── */}
      <nav className={`border-b ${tc.divider} ${tc.bar} backdrop-blur-xl`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
                  isActive(tab.path)
                    ? "border-orange-500 text-orange-500"
                    : `border-transparent ${tc.sub} hover:text-orange-400 hover:border-orange-400/50`
                }`}
              >
                <i className={`fa ${tab.icon}`} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Page Content ──────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
