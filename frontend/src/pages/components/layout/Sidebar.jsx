// ============================================================
// Sidebar — left navigation (desktop)
//
// ITEMS
//   Home            /home
//   Organizations   /organizations   find, follow and open organizations
//                                    (a badge counts invitations waiting)
//   Riders          /riders
//   Drive           /driver          only for people who can drive for an
//                                    organization — or have a trip running
//   Manage          /org-admin       only for people who run one
//   Admin           /admin           RideWise's own admins
//
// "Drive" and "Manage" are not account types. They appear because of what
// the person is in some organization (see OrgContext), and the same
// person can see both.
//
// BOTTOM
//   AccountMenu → avatar + name; opens My Profile | Settings | Log out.
// ============================================================

import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useOrgs } from "../../../context/OrgContext";
import { useDriverTrip } from "../../../context/DriverTripContext";
import AccountMenu from "../account/AccountMenu";
import Icon from "../ui/Icon";

// Module scope on purpose: a component created inside Sidebar would be a
// new type on every render and remount its button each time.
function NavItem({ tc, icon, label, active, onClick, badge = null, live = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center gap-4 rounded-xl px-4 py-3 font-semibold transition-colors ${
        active ? tc.navActive : tc.navIdle
      }`}
    >
      <Icon name={icon} size={20} />
      <span className="flex-1 text-left">{label}</span>
      {live && (
        <span className="relative flex h-2 w-2" title="Trip in progress">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
      )}
      {badge > 0 && (
        <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-black ${tc.chipSelected}`}>
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

export default function Sidebar({ tc }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();
  const { summary } = useOrgs();
  const { trip } = useDriverTrip();

  const canDrive = summary.driving.length > 0 || summary.managed.length > 0 || Boolean(trip);
  const canManage = summary.managed.length > 0;

  return (
    <aside
      className={`fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r p-4 lg:flex ${tc.divider} ${tc.bar}`}
    >
      {/* ── Logo ── */}
      <div onClick={() => navigate("/home")} className="group flex cursor-pointer items-center gap-3 px-4 py-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${tc.button}`}>
          <Icon name="ride" size={20} />
        </div>
        <span className="text-xl font-black tracking-tight">
          Ride<span className="opacity-50">Wise</span>
        </span>
      </div>

      {/* ── Navigation ── */}
      <nav className="mt-8 flex-1 space-y-2 overflow-y-auto">
        <NavItem tc={tc} icon="home" label="Home" active={pathname === "/home"} onClick={() => navigate("/home")} />
        <NavItem
          tc={tc}
          icon="building"
          label="Organizations"
          active={pathname.startsWith("/organizations") || pathname === "/create-organization"}
          badge={summary.invitations.length}
          onClick={() => navigate("/organizations")}
        />
        <NavItem tc={tc} icon="riders" label="Riders" active={pathname === "/riders"} onClick={() => navigate("/riders")} />

        {(canDrive || canManage) && <div className={`mx-4 !my-3 h-px ${tc.hairline}`} />}

        {canDrive && (
          <NavItem
            tc={tc}
            icon="steering"
            label="Drive"
            active={pathname.startsWith("/driver")}
            live={Boolean(trip)}
            onClick={() => navigate(trip ? "/driver/session" : "/driver")}
          />
        )}
        {canManage && (
          <NavItem
            tc={tc}
            icon="settings"
            label="Manage"
            active={pathname.startsWith("/org-admin")}
            onClick={() => navigate("/org-admin")}
          />
        )}

        {isAdmin && (
          <>
            <div className={`mx-4 !my-3 h-px ${tc.hairline}`} />
            <NavItem tc={tc} icon="shield" label="Admin" active={pathname.startsWith("/admin")} onClick={() => navigate("/admin")} />
          </>
        )}
      </nav>

      {/* ── Account menu (profile + dropdown) at the very bottom ── */}
      <AccountMenu tc={tc} />
    </aside>
  );
}
