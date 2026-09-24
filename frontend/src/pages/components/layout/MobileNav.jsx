// ============================================================
// MobileNav — Ultra-minimal bottom navigation (mobile only)
//
// INTENTIONALLY SIMPLE — only 3 targets:
//   Home    → /home
//   [FAB]   → opens Start Ride modal (center, elevated, accent)
//   Account → /account
//
// The FAB (floating action button) in the center is the most important
// action — starting a ride. It sits slightly above the bar to be prominent.
// ============================================================

import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import Icon from "../ui/Icon";
import Button from "../ui/Button";

export default function MobileNav({ tc, onStartRide }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { isAdmin } = useAuth();

  return (
    <nav
      className={`lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t ${tc.divider} ${tc.bar}`}
    >
      <div className="flex justify-around items-center h-16 px-4">

        {/* ── Left: Home ──────────────────────────────────────── */}
        <button
          onClick={() => navigate("/home")}
          className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
            location.pathname === "/home" ? tc.navActive : tc.navIdle
          }`}
        >
          <Icon name="home" size={20} />
          <span className="text-[10px] font-semibold">Home</span>
        </button>

        {/* ── Admin (only for admin users) ──────────────────── */}
        {isAdmin && (
          <button
            onClick={() => navigate("/admin")}
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
              location.pathname.startsWith("/admin") ? tc.navActive : tc.navIdle
            }`}
          >
            <Icon name="shield" size={20} />
            <span className="text-[10px] font-semibold">Admin</span>
          </button>
        )}

        {/* ── Center: Start Ride FAB ───────────────────────────── */}
        {/* Round accent control — accent is allowed here because it starts
            a ride. On /home the parent opens the modal directly; from any
            other page we deep-link to /home?startRide=1 and Home opens it once */}
        <Button
          variant="accent"
          size="lg"
          iconOnly
          icon="ride"
          tc={tc}
          title="Start a Ride"
          className="-mt-6 shrink-0 w-12"
          onClick={() => {
            if (location.pathname === "/home" && onStartRide) onStartRide();
            else navigate("/home?startRide=1");
          }}
        />

        {/* ── Right: Account ──────────────────────────────────── */}
        <button
          onClick={() => navigate("/account")}
          className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
            location.pathname === "/account" ? tc.navActive : tc.navIdle
          }`}
        >
          <Icon name="user" size={20} />
          <span className="text-[10px] font-semibold">Account</span>
        </button>

      </div>
    </nav>
  );
}
