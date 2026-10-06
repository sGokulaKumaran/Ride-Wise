// ============================================================
// AdminOverview — the organization at a glance (Overview tab)
//
//   an emergency, if there is one — first, in red, one tap to the map
//   today's numbers (refreshed every 30 seconds)
//   what still has to be set up, for a new organization
//   the code people use to find the organization
//   what happened recently
// ============================================================

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useLoad, useNow } from "../../hooks/useFleet";
import Icon from "../../components/ui/Icon";
import Button from "../../components/ui/Button";
import { LoadError, Loading, Notice, Section, StatCard } from "../../components/org/kit";
import { copyText, parseTime, timeAgo } from "../../components/org/fleetUi";
import { formatDistance } from "../../../services/routingApi";
import { getDashboard, getRoutes } from "../../../services/orgApi";

// One icon per kind of activity ("vehicle.add" → the part before the dot).
const ACTIVITY_ICON = {
  org: "building", member: "riders", vehicle: "bus", route: "route", trip: "steering", announcement: "megaphone",
};

export default function AdminOverview({ org, orgId, tc, go }) {
  const location = useLocation();
  const now = useNow(30_000);
  const dashboard = useLoad(`dashboard-${orgId}`, () => getDashboard(orgId));
  const routes = useLoad(`dashboard-routes-${orgId}`, () => getRoutes(orgId));
  const reload = dashboard.reload;

  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) reload(); }, 30_000);
    return () => clearInterval(timer);
  }, [reload]);

  const card = org.card;
  const isPrivate = card.visibility === "PRIVATE";
  const [copied, setCopied] = useState(false);
  const copyCode = async () => {
    if (await copyText(card.orgCode)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.info(`The code is ${card.orgCode}`);
    }
  };

  if (dashboard.loading) return <Loading label="Loading the overview…" tc={tc} />;
  if (!dashboard.data) return <LoadError error={dashboard.error} onRetry={reload} tc={tc} />;

  const data = dashboard.data;
  const steps = [
    { done: data.vehicles > 0, label: "Add your first vehicle", hint: "Give each one a short code, like BUS-01.", tab: "vehicles", icon: "bus" },
    { done: data.drivers > 0 || data.pendingInvites > 0, label: "Invite a driver", hint: "By their RideWise username or email. They accept, then they can start trips.", tab: "people", icon: "steering" },
    { done: (routes.data?.length ?? 0) > 0, label: "Save a route", hint: "With its stops — drivers pick it when they start, passengers see when the bus reaches each stop.", tab: "routes", icon: "route" },
  ];
  const settingUp = steps.some((step) => !step.done);

  return (
    <div className="space-y-8">
      {/* ── Emergency ── */}
      {data.sosActive > 0 && (
        <button
          type="button"
          onClick={() => go("map")}
          className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left ${tc.dangerSoft}`}
        >
          <Icon name="sos" size={24} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">
              {data.sosActive === 1 ? "A driver reported an emergency" : `${data.sosActive} drivers reported an emergency`}
            </span>
            <span className="block text-xs opacity-90">Open the live map to see where and call them.</span>
          </span>
          <Icon name="arrowRight" size={18} />
        </button>
      )}

      {location.state?.justCreated && (
        <div className={`flex items-start gap-3 rounded-xl border p-4 ${tc.okSoft}`}>
          <Icon name="checkCircle" size={20} className="mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">{card.name} is ready.</p>
            <p className="mt-0.5 opacity-90">Three steps below and your first vehicle is live on the map.</p>
          </div>
        </div>
      )}

      {/* ── Today ── */}
      <section aria-label="Today" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard tc={tc} icon="signal" tone={data.vehiclesOnTrip > 0 ? "ok" : null}
          value={data.vehiclesOnTrip} label="On a trip now"
          hint={`${data.vehiclesAvailable} free · ${data.vehiclesOff} off the road`} />
        <StatCard tc={tc} icon="bus" value={data.vehicles} label="Vehicles" hint={`${data.drivers} drivers`} />
        <StatCard tc={tc} icon="route" value={data.tripsToday} label="Trips today"
          hint={data.distanceTodayMeters > 0 ? formatDistance(data.distanceTodayMeters) : "nothing driven yet"} />
        <StatCard tc={tc} icon="bookmark" value={data.followers} label="Following"
          hint={isPrivate ? "people with access" : "have it on their list"} />
      </section>

      {/* ── Getting started ── */}
      {settingUp && (
        <Section title="Set up your organization" tc={tc}>
          <ol className={`overflow-hidden rounded-xl border ${tc.card}`}>
            {steps.map((step, index) => (
              <li key={step.tab} className={index > 0 ? `border-t ${tc.divider}` : ""}>
                <button
                  type="button"
                  onClick={() => go(step.tab)}
                  className={`flex w-full items-center gap-3 p-3.5 text-left transition-colors ${tc.cardHover}`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                    step.done ? tc.okSoft : `${tc.surface2} ${tc.divider}`}`}>
                    <Icon name={step.done ? "check" : step.icon} size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-semibold ${step.done ? "line-through opacity-60" : ""}`}>
                      {index + 1}. {step.label}
                    </span>
                    {!step.done && <span className={`block text-xs ${tc.sub}`}>{step.hint}</span>}
                  </span>
                  {!step.done && <Icon name="chevronRight" size={16} className={tc.sub} />}
                </button>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* ── How people find you ── */}
      <Section title="How people find you" tc={tc}>
        <div className={`flex flex-wrap items-center gap-4 rounded-xl border p-4 ${tc.card}`}>
          <div className="min-w-0 flex-1">
            <p className={`text-xs ${tc.sub}`}>Organization code</p>
            <p className="mt-0.5 font-mono text-2xl font-bold tracking-widest">{card.orgCode}</p>
            <p className={`mt-1.5 text-xs ${tc.sub}`}>
              {isPrivate
                ? "Share this code together with your access password. Without both, nobody outside can see your vehicles."
                : "People find you by name in search — the code is a shortcut that always lands on you."}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="secondary" icon={copied ? "check" : "copy"} tc={tc} onClick={copyCode}>
              {copied ? "Copied" : "Copy code"}
            </Button>
            {isPrivate && (
              <Button variant="ghost" icon="key" tc={tc} onClick={() => go("settings")}>Password</Button>
            )}
          </div>
        </div>
      </Section>

      {/* ── Recent activity ── */}
      <Section
        title="Recent activity"
        tc={tc}
        action={data.pendingInvites > 0 ? (
          <Button variant="ghost" size="sm" icon="mail" tc={tc} onClick={() => go("people")}>
            {data.pendingInvites} invitation{data.pendingInvites === 1 ? "" : "s"} waiting
          </Button>
        ) : null}
      >
        {data.activity.length === 0 ? (
          <Notice icon="activity" title="Nothing has happened yet" tc={tc} compact>
            Vehicles added, drivers invited, trips started and ended all appear here.
          </Notice>
        ) : (
          <ul className={`overflow-hidden rounded-xl border ${tc.card}`}>
            {data.activity.map((entry, index) => (
              <li key={entry.id} className={`flex items-start gap-3 px-3.5 py-2.5 ${index > 0 ? `border-t ${tc.divider}` : ""}`}>
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tc.surface2}`}>
                  <Icon name={ACTIVITY_ICON[String(entry.action).split(".")[0]] || "activity"} size={14} />
                </span>
                <p className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">{entry.actorName}</span>{" "}
                  <span className={tc.sub}>{entry.summary}</span>
                </p>
                <span className={`shrink-0 text-xs tabular-nums ${tc.sub}`}>{timeAgo(parseTime(entry.createdAt), now)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
