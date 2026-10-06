// ============================================================
// OrganizationPage — one organization, as the people following it see it
// Route: /organizations/:orgId (protected)
//
// TOP TO BOTTOM
//   who they are (name, kind, verified, contact)
//   what they announced
//   the fleet on a map — live
//   every vehicle with what it is doing right now → tap to track it
//   their saved routes
//
// LIVE
//   The page watches the organization on the fleet socket: positions move
//   the markers as they arrive; a trip starting or ending, an emergency
//   or an announcement reloads the affected list. If the socket is down,
//   the fleet is simply re-read every 15 seconds.
//
// WHO SEES IT
//   A public organization: anyone signed in. A private one: its members,
//   and people who opened it with the code and password. Everybody else
//   gets the server's "this organization is private" and a way to open it.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { useOrgs } from "../../context/OrgContext";
import { useTheme } from "../hooks/useTheme";
import { useDebounced, useFleetWatch, useLoad, useNow } from "../hooks/useFleet";
import Icon from "../components/ui/Icon";
import Button from "../components/ui/Button";
import FleetMapView from "../components/org/FleetMapView";
import {
  AppShell, Badge, ConfirmButton, LoadError, Loading, Notice, OrgAvatar, PageHeader, Section,
} from "../components/org/kit";
import { OrgBadges, VehicleRow } from "../components/org/rows";
import {
  applyPosition, formatDateTime, liveState, orgType, plural, stampVehicles, toMapVehicle,
} from "../components/org/fleetUi";
import { formatDistance, formatDuration } from "../../services/routingApi";
import {
  getAnnouncements,
  getOrganization,
  getRoutes,
  getVehicles,
  leaveOrganization,
  saveOrganization,
  unsaveOrganization,
} from "../../services/orgApi";

// Vehicles that need attention first, then the live ones, then the rest.
const STATE_ORDER = { sos: 0, live: 1, starting: 2, stale: 3, idle: 4, off: 5 };

const LEVEL = {
  INFO: { tone: "neutral", icon: "megaphone" },
  WARNING: { tone: "warn", icon: "alertTriangle" },
  URGENT: { tone: "danger", icon: "alertCircle" },
};

export default function OrganizationPage() {
  const { orgId } = useParams();
  const { user } = useAuth();
  const userId = user?.id;
  const { theme, setTheme, tc } = useTheme(userId);
  const navigate = useNavigate();
  const { refresh: refreshOrgs } = useOrgs();
  const now = useNow(5000);

  const org = useLoad(`org-${orgId}`, () => getOrganization(orgId));
  const allowed = Boolean(org.data);

  const fleet = useLoad(allowed ? `fleet-${orgId}` : null, async () => stampVehicles(await getVehicles(orgId)));
  const news = useLoad(allowed ? `news-${orgId}` : null, () => getAnnouncements(orgId));
  const routes = useLoad(allowed ? `routes-${orgId}` : null, () => getRoutes(orgId));

  // ── Live ──
  const reloadFleet = fleet.reload;
  const reloadNews = news.reload;
  const setFleet = fleet.setData;
  const reloadSoon = useDebounced(reloadFleet);

  const watch = useFleetWatch(allowed ? { orgId: Number(orgId) } : null, {
    onEvent: (event) => {
      if (event.type === "position") {
        setFleet((list) => (list || []).map((vehicle) => (
          vehicle.id === event.vehicleId ? applyPosition(vehicle, event) : vehicle
        )));
      } else if (event.type === "announcement") {
        reloadNews();
      } else {
        reloadSoon();
      }
    },
    onSync: reloadFleet,
  });

  // No live line → look again every 15 seconds.
  useEffect(() => {
    if (!allowed || watch.status === "connected") return undefined;
    const timer = setInterval(reloadFleet, 15_000);
    return () => clearInterval(timer);
  }, [allowed, watch.status, reloadFleet]);

  // ── Derived ──
  const vehicles = useMemo(() => {
    const list = [...(fleet.data || [])];
    list.sort((a, b) => (
      STATE_ORDER[liveState(a, now)] - STATE_ORDER[liveState(b, now)] ||
      a.vehicleCode.localeCompare(b.vehicleCode, undefined, { numeric: true })
    ));
    return list;
  }, [fleet.data, now]);
  const mapVehicles = useMemo(
    () => vehicles.map((vehicle) => toMapVehicle(vehicle, now)).filter(Boolean),
    [vehicles, now],
  );
  const liveCount = vehicles.filter((vehicle) => vehicle.trip).length;

  // ── Actions ──
  const [busy, setBusy] = useState(false);
  const detail = org.data;
  const card = detail?.card;
  const isMember = card?.myStatus === "ACTIVE";

  const toggleSaved = async () => {
    setBusy(true);
    try {
      if (card.saved) {
        await unsaveOrganization(orgId);
        toast.info(`${card.name} removed from your list.`);
        if (card.visibility === "PRIVATE" && !isMember) {
          refreshOrgs();
          navigate("/organizations", { replace: true });
          return;
        }
      } else {
        await saveOrganization(orgId);
        toast.success(`${card.name} is on your list — you'll get its announcements.`);
      }
      org.reload();
      refreshOrgs();
    } catch (err) {
      toast.error(err.message || "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    try {
      await leaveOrganization(orgId);
      toast.info(`You left ${card.name}.`);
      refreshOrgs();
      navigate("/organizations", { replace: true });
    } catch (err) {
      toast.error(err.message || "Couldn't leave. Please try again.");
    }
  };

  // ── Not allowed / not found / loading ──
  if (org.loading) {
    return (
      <AppShell tc={tc} theme={theme} setTheme={setTheme} userId={userId}>
        <Loading label="Opening the organization…" tc={tc} />
      </AppShell>
    );
  }
  // Also when access was taken away while the page was open.
  if (!detail || watch.denied || org.error?.status === 403) {
    const isPrivate = Boolean(watch.denied) || org.error?.status === 403;
    return (
      <AppShell tc={tc} theme={theme} setTheme={setTheme} userId={userId}>
        <PageHeader tc={tc} title="Organization" backTo="/organizations" backLabel="Organizations" />
        {isPrivate ? (
          <Notice
            icon="lock"
            title="You can't open this organization"
            tc={tc}
            action={
              <Button variant="primary" icon="key" tc={tc} onClick={() => navigate("/organizations?tab=find")}>
                Open with a code
              </Button>
            }
          >
            {watch.denied || org.error?.message}
          </Notice>
        ) : (
          <LoadError error={org.error} onRetry={org.reload} tc={tc} />
        )}
      </AppShell>
    );
  }

  const type = orgType(card.orgType);
  const suspended = card.status === "SUSPENDED";

  return (
    <AppShell tc={tc} theme={theme} setTheme={setTheme} userId={userId}>
      <PageHeader tc={tc} backTo="/organizations" backLabel="Organizations" />

      {/* ── Who they are ── */}
      <section className={`rounded-xl border p-4 ${tc.card}`}>
        <div className="flex items-start gap-3.5">
          <OrgAvatar name={card.name} size="lg" tc={tc} />
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-bold tracking-tight sm:text-2xl">{card.name}</h1>
            <p className={`mt-0.5 flex items-center gap-1.5 text-xs ${tc.sub}`}>
              <Icon name={type.icon} size={13} />
              {type.label}
              {card.address && <><span aria-hidden="true">·</span><span className="truncate">{card.address}</span></>}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5"><OrgBadges org={card} tc={tc} /></div>
          </div>
        </div>

        {card.description && <p className={`mt-3 text-sm leading-relaxed ${tc.sub}`}>{card.description}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {detail.canManage && (
            <Button variant="primary" size="sm" icon="settings" tc={tc}
              onClick={() => navigate(`/org-admin/${orgId}/dashboard`)}>
              Manage
            </Button>
          )}
          {detail.canDrive && (
            <Button variant={detail.canManage ? "secondary" : "primary"} size="sm" icon="steering" tc={tc}
              onClick={() => navigate(`/driver?org=${orgId}`)}>
              Start a trip
            </Button>
          )}
          {!isMember && (
            <Button
              variant={card.saved ? "secondary" : "primary"}
              size="sm"
              icon={card.saved ? "check" : "bookmark"}
              tc={tc}
              loading={busy}
              onClick={toggleSaved}
              title={card.saved ? "Remove from your list" : "Add to your list and get its announcements"}
            >
              {card.saved ? "On your list" : "Add to my list"}
            </Button>
          )}
          {detail.contactPhone && (
            <Button as="a" href={`tel:${detail.contactPhone.replace(/[^\d+]/g, "")}`} variant="secondary" size="sm"
              icon="phone" tc={tc}>
              {detail.contactPhone}
            </Button>
          )}
          {isMember && !detail.owner && (
            <ConfirmButton label="Leave" confirmLabel="Leave organization" keepLabel="Stay" icon="leave"
              variant="ghost" tc={tc} onConfirm={leave} />
          )}
        </div>
      </section>

      {suspended && (
        <div className={`mt-4 flex items-start gap-2 rounded-xl border p-3.5 text-sm ${tc.dangerSoft}`}>
          <Icon name="ban" size={17} className="mt-0.5" />
          <span>
            RideWise suspended this organization. Nobody can follow its vehicles or start trips until it is restored.
          </span>
        </div>
      )}

      <div className="mt-8 space-y-8">
        {/* ── Announcements ── */}
        {news.data?.length > 0 && (
          <Section title="Announcements" tc={tc}>
            <div className="space-y-2">
              {news.data.slice(0, 4).map((item) => {
                const level = LEVEL[item.level] || LEVEL.INFO;
                return (
                  <article key={item.id} className={`rounded-xl border p-3.5 ${tc.card}`}>
                    <div className="flex items-start gap-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                        level.tone === "neutral" ? `${tc.surface2} ${tc.divider}` : level.tone === "warn" ? tc.warnSoft : tc.dangerSoft
                      }`}>
                        <Icon name={level.icon} size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className={`mt-0.5 whitespace-pre-line break-words text-sm ${tc.sub}`}>{item.message}</p>
                        <p className={`mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] ${tc.sub}`}>
                          <span>{formatDateTime(item.createdAt)}</span>
                          {item.vehicleCode && <Badge tc={tc}>{item.vehicleCode}</Badge>}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </Section>
        )}

        {/* ── The fleet, live ── */}
        <Section
          title="Vehicles"
          count={fleet.data ? fleet.data.length : null}
          tc={tc}
          action={liveCount > 0 ? (
            <Badge tone="ok" icon="signal" tc={tc}>{liveCount} on a trip</Badge>
          ) : null}
        >
          {fleet.loading ? (
            <Loading label="Loading the fleet…" tc={tc} compact />
          ) : fleet.error && !fleet.data ? (
            <LoadError error={fleet.error} onRetry={fleet.reload} tc={tc} />
          ) : vehicles.length === 0 ? (
            <Notice icon="bus" title="No vehicles yet" tc={tc} compact
              action={detail.canManage ? (
                <Button variant="primary" size="sm" icon="plus" tc={tc}
                  onClick={() => navigate(`/org-admin/${orgId}/vehicles`)}>
                  Add a vehicle
                </Button>
              ) : null}>
              {detail.canManage
                ? "Add your vehicles so drivers can take them out and people can follow them."
                : "This organization has not added its vehicles yet."}
            </Notice>
          ) : (
            <>
              {mapVehicles.length > 0 && (
                <div className={`relative mb-3 h-[300px] overflow-hidden rounded-xl border ${tc.divider}`}>
                  <FleetMapView
                    compact
                    tc={tc}
                    vehicles={mapVehicles}
                    fitKey={`org-${orgId}`}
                    onSelect={(vehicleId) => navigate(`/organizations/${orgId}/track/${vehicleId}`)}
                  />
                </div>
              )}
              <div className="space-y-2">
                {vehicles.map((vehicle) => (
                  <VehicleRow
                    key={vehicle.id}
                    vehicle={vehicle}
                    now={now}
                    tc={tc}
                    onOpen={() => navigate(`/organizations/${orgId}/track/${vehicle.id}`)}
                  />
                ))}
              </div>
              {watch.status === "disconnected" && (
                <p className={`mt-2 flex items-center gap-1.5 text-xs ${tc.sub}`}>
                  <Icon name="refresh" size={12} />
                  Live updates are reconnecting — positions refresh every 15 seconds meanwhile.
                </p>
              )}
            </>
          )}
        </Section>

        {/* ── Routes ── */}
        {routes.data?.length > 0 && (
          <Section title="Routes" count={routes.data.length} tc={tc}>
            <div className="space-y-2">
              {routes.data.map((route) => (
                <div key={route.id} className={`flex items-center gap-3 rounded-xl border p-3.5 ${tc.card}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
                    <Icon name="route" size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{route.name}</p>
                    <p className={`truncate text-xs ${tc.sub}`}>
                      {[
                        route.distanceMeters > 0 ? formatDistance(route.distanceMeters) : null,
                        route.durationSeconds > 0 ? formatDuration(route.durationSeconds) : null,
                        route.stops?.length ? plural(route.stops.length, "stop") : null,
                      ].filter(Boolean).join(" · ")}
                    </p>
                    {route.stops?.length > 0 && (
                      <p className={`mt-0.5 truncate text-[11px] ${tc.sub} opacity-80`}>
                        {route.stops.map((stop) => stop.name).join(" → ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </AppShell>
  );
}
