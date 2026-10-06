// ============================================================
// MobileNav — Bottom navigation (mobile / tablet only)
//
// LAYOUT — one grid of five equal columns, so the ride button is
// ALWAYS dead-centre on every screen width:
//
//   |  Home  |  Orgs  | ( RIDE ) | Riders | Account |
//
//   · The Start-Ride FAB owns the MIDDLE column.
//   · "Orgs" is the way into everything about organizations: following
//     vehicles, driving, managing. Driving and managing are reached from
//     there (and a trip in progress has its own floating pill on every
//     page), so the bar stays at five destinations for everybody —
//     whatever they are in whichever organization.
//     A dot on the tab means an invitation is waiting.
//   · Settings and the platform admin area are reachable through Account
//     (desktop uses the sidebar), so the Account tab stays highlighted
//     there too — the user never loses their place.
//   · The bar keeps room for the phone's home indicator via
//     env(safe-area-inset-bottom) (0px on every other device).
// ============================================================

import { useNavigate, useLocation } from "react-router-dom";
import { useOrgs } from "../../../context/OrgContext";
import Icon from "../ui/Icon";
import Button from "../ui/Button";

// ── NavTab — one bottom-bar destination (icon above label) ───
// Defined at module scope on purpose: a component created INSIDE
// MobileNav would be a brand-new type on every render, and React
// would unmount/remount the button each time (the same trap that is
// documented in Account.jsx's Field component).
function NavTab({ tc, active, icon, label, onClick, dot = false, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-full flex-col items-center justify-center gap-1 transition-colors ${
        active ? tc.navActive : tc.navIdle
      } ${className}`}
    >
      <span className="relative">
        <Icon name={icon} size={20} />
        {dot && (
          <span className={`absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full border-2 bg-current ${tc.accent} ${tc.avatarRing}`} />
        )}
      </span>
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}

export default function MobileNav({ tc, onStartRide }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { summary } = useOrgs();

  // Driving and managing live under "Orgs" on a phone.
  const orgsActive =
    pathname.startsWith("/organizations") || pathname === "/create-organization" ||
    pathname.startsWith("/driver") || pathname.startsWith("/org-admin");
  // Settings and the platform admin area are reached through Account.
  const accountActive = pathname === "/account" || pathname === "/settings" || pathname.startsWith("/admin");

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-30 border-t lg:hidden ${tc.divider} ${tc.bar}`}
      // Sits above the Android gesture bar / iOS home indicator when the
      // browser runs full-screen. env() resolves to 0px everywhere else.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid h-16 grid-cols-5">
        <NavTab tc={tc} active={pathname === "/home"} icon="home" label="Home" onClick={() => navigate("/home")} />

        <NavTab
          tc={tc}
          active={orgsActive}
          icon="building"
          label="Orgs"
          dot={summary.invitations.length > 0}
          onClick={() => navigate("/organizations")}
        />

        {/* ── CENTRE — Start Ride FAB ── */}
        {/* Owns the middle column, so it is perfectly centred. On /home the
            parent opens the modal directly; from any other page we deep-link
            to /home?startRide=1 and Home opens it once. */}
        <div className="relative flex h-full items-center justify-center">
          <Button
            variant="accent"
            size="lg"
            iconOnly
            icon="ride"
            tc={tc}
            title="Start a Ride"
            className="-mt-7 w-12 shrink-0 shadow-lg"
            onClick={() => {
              if (pathname === "/home" && onStartRide) onStartRide();
              else navigate("/home?startRide=1");
            }}
          />
        </div>

        <NavTab tc={tc} active={pathname === "/riders"} icon="riders" label="Riders" onClick={() => navigate("/riders")} />

        <NavTab tc={tc} active={accountActive} icon="user" label="Account" onClick={() => navigate("/account")} />
      </div>
    </nav>
  );
}
