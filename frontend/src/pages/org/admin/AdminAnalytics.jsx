// ============================================================
// AdminAnalytics — how the fleet is doing (Statistics tab)
//
//   the last 7, 30 or 90 days
//   trips, distance, driving time, speeding — in total and per day
//   every driver and every vehicle, busiest first
//
// All figures are measured by the server from the positions vehicles
// reported; trips that never sent a position are left out and counted
// separately. A "day" is YOUR day: the browser tells the server its time
// zone, so a trip at 1 a.m. is not counted on the day before.
// ============================================================

import { useState } from "react";
import { useLoad } from "../../hooks/useFleet";
import Icon from "../../components/ui/Icon";
import Button, { Chip } from "../../components/ui/Button";
import { LoadError, Loading, Notice, Section, StatCard } from "../../components/org/kit";
import { formatDistance, formatDuration } from "../../../services/routingApi";
import { getAnalytics } from "../../../services/orgApi";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const km = (metres) => {
  const value = metres / 1000;
  return value >= 100 ? `${Math.round(value)} km` : `${value.toFixed(1)} km`;
};

export default function AdminAnalytics({ orgId, tc, go }) {
  const [days, setDays] = useState(30);
  const [measure, setMeasure] = useState("trips"); // what the chart shows
  const stats = useLoad(`admin-stats-${orgId}-${days}`, () => getAnalytics(orgId, days));
  const data = stats.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Period">
        {RANGES.map((range) => (
          <Chip key={range.days} selected={days === range.days} tc={tc} onClick={() => setDays(range.days)}>
            Last {range.label}
          </Chip>
        ))}
      </div>

      {stats.loading ? (
        <Loading label="Adding it up…" tc={tc} />
      ) : !data ? (
        <LoadError error={stats.error} onRetry={stats.reload} tc={tc} />
      ) : data.trips === 0 ? (
        <Notice icon="chart" title={`No trips in the last ${data.days} days`} tc={tc}>
          Statistics appear as soon as your drivers make trips.
          {data.cancelledTrips > 0 ? ` (${data.cancelledTrips} trips were started but never sent a position.)` : ""}
        </Notice>
      ) : (
        <>
          <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard tc={tc} icon="route" value={data.trips} label="Trips"
              hint={`${(data.trips / data.days).toFixed(1)} a day`} />
            <StatCard tc={tc} icon="road" value={km(data.distanceMeters)} label="Driven"
              hint={`${km(data.distanceMeters / data.trips)} per trip`} />
            <StatCard tc={tc} icon="clock" value={formatDuration(data.drivingSeconds)} label="Driving time"
              hint={`${formatDuration(data.drivingSeconds / data.trips)} per trip`} />
            <StatCard tc={tc} icon="gauge" tone={data.overspeedCount > 0 ? "danger" : null}
              value={data.speedLimitKmh ? data.overspeedCount : "—"}
              label={data.speedLimitKmh ? `Over ${data.speedLimitKmh} km/h` : "Speeding"}
              hint={data.speedLimitKmh ? "times the limit was passed" : "no speed limit set"} />
          </section>

          {!data.speedLimitKmh && (
            <p className={`flex flex-wrap items-center gap-2 rounded-xl border p-3.5 text-xs ${tc.divider} ${tc.sub}`}>
              <Icon name="gauge" size={14} />
              <span className="min-w-0 flex-1">
                Set a speed limit for your vehicles and RideWise counts every time a driver passes it.
              </span>
              <Button variant="secondary" size="sm" tc={tc} onClick={() => go("settings")}>Set a limit</Button>
            </p>
          )}

          {/* ── Per day ── */}
          <Section
            title="Day by day"
            tc={tc}
            action={
              <div className="flex gap-1.5" role="radiogroup" aria-label="What the chart shows">
                <Chip selected={measure === "trips"} tc={tc} onClick={() => setMeasure("trips")}>Trips</Chip>
                <Chip selected={measure === "distance"} tc={tc} onClick={() => setMeasure("distance")}>Distance</Chip>
              </div>
            }
          >
            <DayChart daily={data.daily} measure={measure} tc={tc} />
          </Section>

          {/* ── Drivers ── */}
          <Section title="Drivers" count={data.drivers.length} tc={tc}>
            <Ranking
              tc={tc}
              rows={data.drivers.map((driver) => ({
                key: driver.userId,
                name: driver.name,
                icon: "steering",
                trips: driver.trips,
                distance: driver.distanceMeters,
                seconds: driver.drivingSeconds,
                extra: [
                  driver.maxSpeedKmh > 0 ? `top ${Math.round(driver.maxSpeedKmh)} km/h` : null,
                  data.speedLimitKmh && driver.overspeedCount > 0 ? `${driver.overspeedCount}× over the limit` : null,
                ].filter(Boolean),
                warn: Boolean(data.speedLimitKmh) && driver.overspeedCount > 0,
              }))}
            />
          </Section>

          {/* ── Vehicles ── */}
          <Section title="Vehicles" count={data.vehicles.length} tc={tc}>
            <Ranking
              tc={tc}
              rows={data.vehicles.map((vehicle) => ({
                key: vehicle.vehicleId,
                name: vehicle.vehicleCode,
                icon: "bus",
                trips: vehicle.trips,
                distance: vehicle.distanceMeters,
                seconds: vehicle.drivingSeconds,
                extra: [],
                warn: false,
              }))}
            />
          </Section>

          {data.cancelledTrips > 0 && (
            <p className={`text-xs ${tc.sub}`}>
              Not counted: {data.cancelledTrips} trip{data.cancelledTrips === 1 ? "" : "s"} that were started but never
              sent a position (the phone had no GPS, or the trip was ended straight away).
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Bars, one per day ────────────────────────────────────────
// Plain elements instead of a chart library: a bar's height is its share
// of the busiest day. Each bar says its value on hover and to screen
// readers; long periods show every few dates only.
function DayChart({ daily, measure, tc }) {
  const value = (day) => (measure === "trips" ? day.trips : day.distanceMeters);
  const max = Math.max(1, ...daily.map(value));
  const labelEvery = daily.length <= 7 ? 1 : daily.length <= 30 ? 5 : 15;
  const busiest = daily.reduce((best, day) => (value(day) > value(best) ? day : best), daily[0]);

  const dateOf = (text) => new Date(`${text}T00:00:00`);
  const shortDate = (text) => dateOf(text).toLocaleDateString([], { day: "numeric", month: "short" });
  const say = (day) => (measure === "trips"
    ? `${day.trips} trip${day.trips === 1 ? "" : "s"}`
    : formatDistance(day.distanceMeters));

  return (
    <div className={`rounded-xl border p-4 ${tc.card}`}>
      <div className="flex h-40 items-end gap-[3px]" role="img"
        aria-label={`${measure === "trips" ? "Trips" : "Distance"} per day; the busiest day was ${shortDate(busiest.date)} with ${say(busiest)}`}>
        {daily.map((day) => {
          const share = value(day) / max;
          return (
            <div key={day.date} className="group relative flex h-full min-w-0 flex-1 items-end" title={`${shortDate(day.date)} · ${say(day)}`}>
              <div
                className={`w-full rounded-t-sm transition-[height] duration-300 ${value(day) > 0 ? "bg-[#2F6FED]" : tc.surface2}`}
                style={{ height: value(day) > 0 ? `${Math.max(4, share * 100)}%` : "2px" }}
              />
            </div>
          );
        })}
      </div>
      <div className={`mt-2 flex gap-[3px] text-[10px] tabular-nums ${tc.sub}`}>
        {daily.map((day, index) => (
          <span key={day.date} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
            {index % labelEvery === 0 || index === daily.length - 1 ? dateOf(day.date).getDate() : ""}
          </span>
        ))}
      </div>
      <p className={`mt-3 text-xs ${tc.sub}`}>
        {shortDate(daily[0].date)} – {shortDate(daily[daily.length - 1].date)} · busiest day {shortDate(busiest.date)} ({say(busiest)})
      </p>
    </div>
  );
}

// ── A ranked list with a bar for the share of trips ──────────
function Ranking({ rows, tc }) {
  const most = Math.max(1, ...rows.map((row) => row.trips));
  return (
    <ul className={`overflow-hidden rounded-xl border ${tc.card}`}>
      {rows.map((row, index) => (
        <li key={row.key} className={`px-3.5 py-3 ${index > 0 ? `border-t ${tc.divider}` : ""}`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
              <Icon name={row.icon} size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-semibold">{row.name}</span>
                <span className="shrink-0 text-sm font-bold tabular-nums">
                  {row.trips} <span className={`text-xs font-normal ${tc.sub}`}>trip{row.trips === 1 ? "" : "s"}</span>
                </span>
              </p>
              <div className={`mt-1.5 h-1.5 overflow-hidden rounded-full ${tc.surface2}`}>
                <div className="h-full rounded-full bg-[#2F6FED]" style={{ width: `${(row.trips / most) * 100}%` }} />
              </div>
              <p className={`mt-1.5 flex flex-wrap gap-x-2 text-xs ${tc.sub}`}>
                <span>{km(row.distance)}</span>
                <span aria-hidden="true">·</span>
                <span>{formatDuration(row.seconds)}</span>
                {row.extra.map((text) => (
                  <span key={text} className={row.warn && text.includes("over") ? `font-semibold ${tc.danger}` : ""}>· {text}</span>
                ))}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
