// ============================================================
// MobileNav — Bottom navigation (mobile / tablet only)
//
// LAYOUT — one grid of five equal columns, so the ride button is
// ALWAYS dead-centre on every screen width:
//
//   |  Home   |  Admin  | ( RIDE ) | Riders | Account |
//   | <-- 2 columns for riders (no Admin tab) --> |
//
//   · The Start-Ride FAB owns the MIDDLE column. A flex row of 3–5
//     flex-1 items can never guarantee that: the item count changes
//     for admins, so the centre used to drift.
//   · Home spans two columns for riders so the left side stays as
//     wide as the right side and the circle never moves.
//   · Settings is reachable on mobile through Account (desktop uses
//     the sidebar's AccountMenu dropdown), so the Account tab stays
//     highlighted on /settings too — the user never loses their place.
//   · The bar keeps room for the phone's home indicator via
//     env(safe-area-inset-bottom) (0px on every other device).
// ============================================================

import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import Icon from "../ui/Icon";
import Button from "../ui/Button";

// ── NavTab — one bottom-bar destination (icon above label) ───
// Defined at module scope on purpose: a component created INSIDE
// MobileNav would be a brand-new type on every render, and React
// would unmount/remount the button each time (the same trap that is
// documented in Account.jsx's Field component).
function NavTab({ tc, active, icon, label, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center justify-center gap-1 h-full transition-colors ${
        active ? tc.navActive : tc.navIdle
      } ${className}`}
    >
      <Icon name={icon} size={20} />
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}

export default function MobileNav({ tc, onStartRide }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { isAdmin } = useAuth();

  // Settings is only reachable through Account on mobile → keep the
  // Account tab lit for both routes.
  const accountActive =
    location.pathname === "/account" || location.pathname === "/settings";

  return (
    <nav
      className={`lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t ${tc.divider} ${tc.bar}`}
      // Sits above the Android gesture bar / iOS home indicator when the
      // browser runs full-screen. env() resolves to 0px everywhere else.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Five columns: Home(+Admin) · RIDE · Riders · Account */}
      <div className="grid grid-cols-5 h-16">

        {/* ── Column 1 · Home ────────────────────────────────────
            Riders get col-span-2 so the left half of the bar is as wide
            as the right half and the ride circle stays on the centre
            column. Admins keep col-span-1 to make room for the Admin tab. */}
        <NavTab
          tc={tc}
          active={location.pathname === "/home"}
          icon="home"
          label="Home"
          onClick={() => navigate("/home")}
          className={isAdmin ? "col-span-1" : "col-span-2"}
        />

        {/* ── Column 2 · Admin (admins only) ───────────────────── */}
        {isAdmin && (
          <NavTab
            tc={tc}
            active={location.pathname.startsWith("/admin")}
            icon="shield"
            label="Admin"
            onClick={() => navigate("/admin")}
          />
        )}

        {/* ── Column 3 · CENTRE — Start Ride FAB ──────────────── */}
        {/* Owns the middle column, so it is perfectly centred. On /home the
            parent opens the modal directly; from any other page we deep-link
            to /home?startRide=1 and Home opens it once. */}
        <div className="relative flex items-center justify-center h-full">
          <Button
            variant="accent"
            size="lg"
            iconOnly
            icon="ride"
            tc={tc}
            title="Start a Ride"
            className="-mt-7 w-12 shadow-lg shrink-0"
            onClick={() => {
              if (location.pathname === "/home" && onStartRide) onStartRide();
              else navigate("/home?startRide=1");
            }}
          />
        </div>

        {/* ── Column 4 · Riders ─────────────────────────────────── */}
        <NavTab
          tc={tc}
          active={location.pathname === "/riders"}
          icon="riders"
          label="Riders"
          onClick={() => navigate("/riders")}
        />

        {/* ── Column 5 · Account (also holds Settings) ──────────── */}
        <NavTab
          tc={tc}
          active={accountActive}
          icon="user"
          label="Account"
          onClick={() => navigate("/account")}
        />

      </div>
    </nav>
  );
}
