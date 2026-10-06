// ============================================================
// rows.jsx — an organization and a vehicle, as they appear in lists
//
//   OrgRow       name, kind, how many vehicles are live, my role
//   VehicleRow   code, what it is doing right now, seats, emergency
//   OrgBadges    the pills under an organization's name
// ============================================================

import Icon from "../ui/Icon";
import { Badge, LiveDot, OrgAvatar } from "./kit";
import {
  LIVE_STATE,
  ROLE_LABEL,
  crowdLevel,
  isStale,
  kmh,
  liveState,
  orgType,
  parseTime,
  plural,
  timeAgo,
  tripTitle,
  vehicleStatus,
  vehicleType,
} from "./fleetUi";

export function OrgBadges({ org, tc, showRole = true }) {
  return (
    <>
      {org.verified && <Badge tone="ok" icon="checkCircle" tc={tc} title="RideWise confirmed this organization">Verified</Badge>}
      <Badge icon={org.visibility === "PRIVATE" ? "lock" : "globe"} tc={tc}>
        {org.visibility === "PRIVATE" ? "Private" : "Public"}
      </Badge>
      {org.status === "SUSPENDED" && <Badge tone="danger" icon="ban" tc={tc}>Suspended</Badge>}
      {showRole && org.myRole && org.myStatus === "ACTIVE" && (
        <Badge tone="accent" icon={org.myRole === "OWNER" ? "crown" : undefined} tc={tc}>{ROLE_LABEL[org.myRole]}</Badge>
      )}
      {showRole && org.myStatus === "SUSPENDED" && <Badge tone="warn" tc={tc}>You are suspended here</Badge>}
    </>
  );
}

// One organization. `children` is the right-hand action (a button, a chevron).
export function OrgRow({ org, tc, onOpen, children }) {
  const type = orgType(org.orgType);
  const content = (
    <>
      <OrgAvatar name={org.name} tc={tc} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{org.name}</span>
          {org.verified && <Icon name="checkCircle" size={14} className={`shrink-0 ${tc.ok}`} title="Verified" />}
          {org.visibility === "PRIVATE" && <Icon name="lock" size={13} className={`shrink-0 ${tc.sub}`} title="Private" />}
        </span>
        <span className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs ${tc.sub}`}>
          <span>{type.label}</span>
          <span aria-hidden="true">·</span>
          <span>{plural(org.vehicleCount, "vehicle")}</span>
          {org.activeTrips > 0 && (
            <span className={`inline-flex items-center gap-1.5 font-semibold ${tc.ok}`}>
              <LiveDot />
              {org.activeTrips} live
            </span>
          )}
          {org.myRole && org.myStatus === "ACTIVE" && (
            <>
              <span aria-hidden="true">·</span>
              <span>{ROLE_LABEL[org.myRole]}</span>
            </>
          )}
        </span>
      </span>
    </>
  );

  if (!onOpen) {
    return (
      <div className={`flex items-center gap-3 rounded-xl border p-3.5 ${tc.card}`}>
        {content}
        {children && <div className="flex shrink-0 items-center gap-1.5">{children}</div>}
      </div>
    );
  }
  // The whole row opens the organization; actions sit beside it (a button
  // inside a button is not valid, so they are siblings).
  return (
    <div className={`flex items-center gap-2 rounded-xl border pr-3 ${tc.card}`}>
      <button
        type="button"
        onClick={onOpen}
        className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl p-3.5 text-left transition-colors ${tc.cardHover}`}
      >
        {content}
      </button>
      {children ? (
        <div className="flex shrink-0 items-center gap-1.5">{children}</div>
      ) : (
        <Icon name="chevronRight" size={16} className={`shrink-0 ${tc.sub}`} />
      )}
    </div>
  );
}

// What a vehicle is doing right now, in one line.
function vehicleLine(vehicle, state, now) {
  const trip = vehicle.trip;
  if (!trip) {
    if (vehicle.status !== "ACTIVE") return vehicleStatus(vehicle.status).hint;
    const seen = parseTime(vehicle.lastLocationAt);
    return seen != null ? `Not on a trip · last seen ${timeAgo(seen, now)}` : "Not on a trip";
  }
  const parts = [tripTitle(trip)];
  if (state === "starting") {
    parts.push("waiting for GPS");
  } else if (isStale(trip, now)) {
    parts.push(`last seen ${timeAgo(trip.seenAt, now)}`);
  } else {
    const speed = kmh(trip.speed);
    if (speed != null && speed > 2) parts.push(`${speed} km/h`);
  }
  if (trip.driverName) parts.push(trip.driverName);
  return parts.join(" · ");
}

// One vehicle. `now` is a ticking clock (useNow) so "seen 2 min ago" stays true.
export function VehicleRow({ vehicle, now, tc, onOpen, children, showStatus = false }) {
  const state = liveState(vehicle, now);
  const info = LIVE_STATE[state];
  const type = vehicleType(vehicle.vehicleType);
  const crowd = vehicle.trip ? crowdLevel(vehicle.trip.crowdLevel) : null;
  const status = vehicleStatus(vehicle.status);

  const body = (
    <>
      <span
        className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${
          state === "sos" ? tc.dangerSoft : state === "live" ? tc.okSoft : `${tc.surface2} ${tc.divider}`
        }`}
      >
        <Icon name={type.icon} size={21} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-semibold">{vehicle.vehicleCode}</span>
          {vehicle.trip ? (
            <Badge tone={info.tone} tc={tc}>
              {(state === "live" || state === "sos") && <LiveDot tone={info.tone} />}
              {info.label}
            </Badge>
          ) : showStatus || vehicle.status !== "ACTIVE" ? (
            <Badge tone={status.tone} tc={tc}>{status.label}</Badge>
          ) : null}
          {crowd && <Badge tone={crowd.tone} icon="seat" tc={tc}>{crowd.label}</Badge>}
        </span>
        <span className={`mt-0.5 block truncate text-xs ${tc.sub}`}>{vehicleLine(vehicle, state, now)}</span>
      </span>
    </>
  );

  if (!onOpen) {
    return (
      <div className={`flex items-center gap-3 rounded-xl border p-3.5 ${tc.card}`}>
        {body}
        {children && <div className="flex shrink-0 items-center gap-1.5">{children}</div>}
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-2 rounded-xl border pr-3 ${tc.card}`}>
      <button
        type="button"
        onClick={onOpen}
        className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl p-3.5 text-left transition-colors ${tc.cardHover}`}
      >
        {body}
      </button>
      {children ? (
        <div className="flex shrink-0 items-center gap-1.5">{children}</div>
      ) : (
        <Icon name="chevronRight" size={16} className={`shrink-0 ${tc.sub}`} />
      )}
    </div>
  );
}
