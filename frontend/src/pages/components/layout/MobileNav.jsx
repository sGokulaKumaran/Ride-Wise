// ============================================================
// 📱 MobileNav — Ultra-minimal bottom navigation (mobile only)
//
// INTENTIONALLY SIMPLE — only 3 targets:
//   🏠 Home    → /home
//   🏍️ [FAB]  → opens Start Ride modal (center, elevated, orange)
//   👤 Account → /account
//
// The FAB (floating action button) in the center is the most important
// action — starting a ride. It sits slightly above the bar to be prominent.
// ============================================================

import { useNavigate, useLocation } from "react-router-dom";

export default function MobileNav({ tc, onStartRide }) {
  const navigate  = useNavigate();
  const location  = useLocation();

  return (
    <nav
      className={`lg:hidden fixed bottom-0 left-0 right-0 z-30 backdrop-blur-xl border-t ${tc.divider} ${tc.bar}`}
    >
      <div className="flex justify-around items-center h-16 px-4">

        {/* ── Left: Home ──────────────────────────────────────── */}
        <button
          onClick={() => navigate("/home")}
          className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all hover:scale-110 ${
            location.pathname === "/home" ? "text-orange-400" : tc.text
          }`}
        >
          <i className="fa fa-home text-xl" />
          <span className="text-[10px] font-semibold">Home</span>
        </button>

        {/* ── Center: Start Ride FAB ───────────────────────────── */}
        {/* Elevated, gradient, the hero action on mobile */}
        {/* On /home the parent opens the modal directly; from any other
            page we deep-link to /home?startRide=1 and Home opens it once */}
        <button
          onClick={() => {
            if (location.pathname === "/home" && onStartRide) onStartRide();
            else navigate("/home?startRide=1");
          }}
          className="flex-shrink-0 -mt-6 w-14 h-14 rounded-full text-white transition-all hover:scale-110 active:scale-90 flex flex-col items-center justify-center shadow-2xl"
          style={{
            background: "linear-gradient(135deg, #f97316, #ec4899)",
            boxShadow: "0 8px 32px rgba(249, 115, 22, 0.45)",
          }}
          title="Start a Ride"
        >
          <i className="fa fa-motorcycle text-xl" />
        </button>

        {/* ── Right: Account ──────────────────────────────────── */}
        <button
          onClick={() => navigate("/account")}
          className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all hover:scale-110 ${
            location.pathname === "/account" ? "text-orange-400" : tc.text
          }`}
        >
          <i className="fa fa-user text-xl" />
          <span className="text-[10px] font-semibold">Account</span>
        </button>

      </div>
    </nav>
  );
}
