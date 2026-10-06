// ============================================================
// HomeOrganizations.jsx — organizations on the Home dashboard
//
// The quick way in, right under the greeting:
//   • the trip I am driving (if any) → its map
//   • invitations waiting for my answer
//   • my organizations — the ones with vehicles on the road first — one
//     tap from their live map
//   • for someone with none yet: a single line saying what this is
//
// It reads what OrgContext already knows and adds one small request (the
// organizations on my list), so Home stays as fast as it was.
// ============================================================

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useOrgs } from "../../../context/OrgContext";
import { useDriverTrip } from "../../../context/DriverTripContext";
import { useLoad } from "../../hooks/useFleet";
import Icon from "../ui/Icon";
import Button from "../ui/Button";
import { LiveDot } from "./kit";
import { OrgRow } from "./rows";
import { tripTitle, vehicleType } from "./fleetUi";
import { getSavedOrganizations } from "../../../services/orgApi";

const SHOWN = 3;

export default function HomeOrganizations({ tc, userId }) {
  const navigate = useNavigate();
  const { summary, loaded } = useOrgs();
  const { trip } = useDriverTrip();
  const saved = useLoad(userId != null ? `home-saved-${userId}` : null, getSavedOrganizations);

  // Everything I belong to or follow, once each; live fleets first.
  const orgs = useMemo(() => {
    const seen = new Set();
    const all = [...summary.managed, ...summary.driving, ...(saved.data || [])].filter((org) => {
      if (seen.has(org.id)) return false;
      seen.add(org.id);
      return true;
    });
    return all.sort((a, b) => b.activeTrips - a.activeTrips);
  }, [summary.managed, summary.driving, saved.data]);

  if (!loaded) return null; // nothing to show yet — and nothing to jump when it arrives

  const invitations = summary.invitations.length;
  const empty = orgs.length === 0 && invitations === 0 && !trip;

  // ── Nobody's organization yet: one calm line, not a banner ──
  if (empty) {
    return (
      <section className={`flex items-center gap-3 rounded-xl border p-4 ${tc.card}`} aria-label="Organizations">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
          <Icon name="bus" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Waiting for a college or office bus?</p>
          <p className={`text-xs ${tc.sub}`}>Follow your organization&apos;s vehicles live, with arrival times.</p>
        </div>
        <Button variant="secondary" size="sm" icon="search" tc={tc} onClick={() => navigate("/organizations?tab=find")}>
          Find
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="home-orgs-title">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="home-orgs-title" className="text-sm font-semibold">Organizations</h2>
        <Button variant="ghost" size="sm" icon="arrowRight" iconRight tc={tc} onClick={() => navigate("/organizations")}>
          {orgs.length > SHOWN ? `See all ${orgs.length}` : "Open"}
        </Button>
      </div>

      <div className="space-y-2">
        {/* The trip I am driving */}
        {trip && (
          <button
            type="button"
            onClick={() => navigate("/driver/session")}
            className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left ${tc.okSoft}`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tc.inkTile}`}>
              <Icon name={vehicleType(trip.vehicleType).icon} size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <LiveDot />
                <span className="truncate">You are driving {trip.session.vehicleCode}</span>
              </span>
              <span className="block truncate text-xs opacity-90">{trip.orgName} · {tripTitle(trip.session)}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
              Open map <Icon name="arrowRight" size={13} />
            </span>
          </button>
        )}

        {/* Invitations */}
        {invitations > 0 && (
          <button
            type="button"
            onClick={() => navigate("/organizations")}
            className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left ${tc.accentSoft}`}
          >
            <Icon name="mail" size={20} />
            <span className="min-w-0 flex-1 text-sm font-semibold">
              {invitations === 1
                ? `${summary.invitations[0].orgName} invited you to join`
                : `${invitations} organizations invited you to join`}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
              Answer <Icon name="arrowRight" size={13} />
            </span>
          </button>
        )}

        {orgs.slice(0, SHOWN).map((org) => (
          <OrgRow key={org.id} org={org} tc={tc} onOpen={() => navigate(`/organizations/${org.id}`)} />
        ))}
      </div>
    </section>
  );
}
