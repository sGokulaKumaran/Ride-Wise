// ============================================================
// OrgAdmin — where an organization is run
// Routes: /org-admin                      choose which one (or go straight in)
//         /org-admin/:orgId/:tab?         one organization
//
// TABS
//   Overview    the numbers of today, emergencies, what happened recently
//   Live map    every vehicle on one map; end a forgotten trip from here
//   Vehicles    the fleet: add, edit, send to repair, retire
//   Routes      saved routes with stops, for drivers to pick
//   People      admins, drivers, viewers; invitations; who holds access
//   Trips       history with replay, export
//   Announce    messages to everyone following the organization
//   Statistics  trips, distance, driving time, speeding — per day/driver/vehicle
//   Settings    details, privacy, speed limit, access password, delete
//
// The organization's id is in the URL because one person can manage
// several organizations — a link to "the dashboard" must say whose.
//
// The server decides who may do what; this screen only hides what would
// be refused anyway. Someone who is not an admin of the organization gets
// a plain explanation instead of nine tabs of errors.
// ============================================================

import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useOrgs } from "../../context/OrgContext";
import { useTheme } from "../hooks/useTheme";
import { useLoad } from "../hooks/useFleet";
import Icon from "../components/ui/Icon";
import Button from "../components/ui/Button";
import { AppShell, LoadError, Loading, Notice, OrgAvatar, PageHeader } from "../components/org/kit";
import { OrgBadges, OrgRow } from "../components/org/rows";
import { getOrganization } from "../../services/orgApi";
import AdminOverview from "./admin/AdminOverview";
import AdminLiveMap from "./admin/AdminLiveMap";
import AdminVehicles from "./admin/AdminVehicles";
import AdminRoutes from "./admin/AdminRoutes";
import AdminPeople from "./admin/AdminPeople";
import AdminTrips from "./admin/AdminTrips";
import AdminAnnouncements from "./admin/AdminAnnouncements";
import AdminAnalytics from "./admin/AdminAnalytics";
import AdminSettings from "./admin/AdminSettings";

const TABS = [
  { id: "dashboard",     label: "Overview",   icon: "gauge",     view: AdminOverview },
  { id: "map",           label: "Live map",   icon: "map",       view: AdminLiveMap },
  { id: "vehicles",      label: "Vehicles",   icon: "bus",       view: AdminVehicles },
  { id: "routes",        label: "Routes",     icon: "route",     view: AdminRoutes },
  { id: "people",        label: "People",     icon: "riders",    view: AdminPeople },
  { id: "trips",         label: "Trips",      icon: "history",   view: AdminTrips },
  { id: "announcements", label: "Announce",   icon: "megaphone", view: AdminAnnouncements },
  { id: "analytics",     label: "Statistics", icon: "chart",     view: AdminAnalytics },
  { id: "settings",      label: "Settings",   icon: "settings",  view: AdminSettings },
];

// ── /org-admin — which organization? ─────────────────────────
export function OrgAdminHome() {
  const { user } = useAuth();
  const userId = user?.id;
  const { theme, setTheme, tc } = useTheme(userId);
  const navigate = useNavigate();
  const { summary, loaded } = useOrgs();

  if (loaded && summary.managed.length === 1) {
    return <Navigate to={`/org-admin/${summary.managed[0].id}/dashboard`} replace />;
  }

  return (
    <AppShell tc={tc} theme={theme} setTheme={setTheme} userId={userId}>
      <PageHeader tc={tc} title="Manage" subtitle="The organizations you run." />
      {!loaded ? (
        <Loading tc={tc} />
      ) : summary.managed.length === 0 ? (
        <Notice
          icon="building"
          title="You don't manage an organization"
          tc={tc}
          action={
            <Button variant="primary" icon="plus" tc={tc} onClick={() => navigate("/create-organization")}>
              Create an organization
            </Button>
          }
        >
          Create one for your college, hospital or company — you become its owner and can add vehicles and drivers.
        </Notice>
      ) : (
        <div className="space-y-2">
          {summary.managed.map((org) => (
            <OrgRow key={org.id} org={org} tc={tc} onOpen={() => navigate(`/org-admin/${org.id}/dashboard`)} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

// ── /org-admin/:orgId/:tab ───────────────────────────────────
export default function OrgAdmin() {
  const { orgId, tab } = useParams();
  const { user } = useAuth();
  const userId = user?.id;
  const { theme, setTheme, tc } = useTheme(userId);
  const navigate = useNavigate();

  const org = useLoad(`admin-org-${orgId}`, () => getOrganization(orgId));
  const detail = org.data;
  const active = TABS.find((item) => item.id === tab) || TABS[0];
  const go = (next) => navigate(`/org-admin/${orgId}/${next}`);

  if (!tab) return <Navigate to={`/org-admin/${orgId}/dashboard`} replace />;

  if (org.loading || !detail || !detail.canManage) {
    return (
      <AppShell tc={tc} theme={theme} setTheme={setTheme} userId={userId}>
        <PageHeader tc={tc} title="Manage" backTo="/organizations" backLabel="Organizations" />
        {org.loading ? (
          <Loading label="Opening the organization…" tc={tc} />
        ) : !detail ? (
          <LoadError error={org.error} onRetry={org.reload} tc={tc} />
        ) : (
          <Notice
            icon="lock"
            title="Only this organization's admins can manage it"
            tc={tc}
            action={
              <Button variant="primary" icon="building" tc={tc} onClick={() => navigate(`/organizations/${orgId}`)}>
                Open {detail.card.name}
              </Button>
            }
          >
            You are not an admin of {detail.card.name}. Its owner can make you one.
          </Notice>
        )}
      </AppShell>
    );
  }

  const View = active.view;
  const card = detail.card;

  return (
    <AppShell tc={tc} theme={theme} setTheme={setTheme} userId={userId} width="max-w-5xl">
      {/* ── Which organization ── */}
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <OrgAvatar name={card.name} tc={tc} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{card.name}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5"><OrgBadges org={card} tc={tc} /></div>
        </div>
        <Button variant="secondary" size="sm" icon="eye" tc={tc} onClick={() => navigate(`/organizations/${orgId}`)}>
          <span className="hidden sm:inline">View its page</span>
          <span className="sm:hidden">View</span>
        </Button>
      </header>

      {card.status === "SUSPENDED" && (
        <div className={`mb-4 flex items-start gap-2 rounded-xl border p-3.5 text-sm ${tc.dangerSoft}`}>
          <Icon name="ban" size={17} className="mt-0.5" />
          <span>
            RideWise suspended this organization. Trips cannot be started and nobody outside can see it until it is
            restored. Contact RideWise support to resolve this.
          </span>
        </div>
      )}

      {/* ── Tabs (only this strip scrolls sideways on a phone) ── */}
      <nav className={`mb-6 border-b ${tc.divider}`} aria-label="Manage organization">
        <div className="scrollbar-hide -mb-px flex gap-1 overflow-x-auto">
          {TABS.map((item) => {
            const selected = item.id === active.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                aria-current={selected ? "page" : undefined}
                className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3 py-3 text-sm font-semibold transition-colors ${
                  selected ? `${tc.navActive} ${tc.text}` : tc.navIdle
                }`}
              >
                <Icon name={item.icon} size={16} />
                {item.label}
                {selected && <span className={`absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-current ${tc.accent}`} />}
              </button>
            );
          })}
        </div>
      </nav>

      <View key={`${orgId}-${active.id}`} org={detail} orgId={Number(orgId)} tc={tc} go={go} reloadOrg={org.reload} />
    </AppShell>
  );
}
