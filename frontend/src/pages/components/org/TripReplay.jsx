// ============================================================
// TripReplay.jsx — look back at one trip
//
// A dialog with the path the vehicle REALLY took (recorded on the server
// while it drove), the road that was planned (drawn faintly underneath,
// so a detour is visible at a glance), and a slider that moves the
// vehicle along its path — with the time and speed at that point.
//
// Who may open it is decided by the server: the trip's driver, and the
// admins of its organization.
//
// PROPS
//   sessionId   the trip
//   onClose
//   tc
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { useLoad } from "../../hooks/useFleet";
import Button, { IconButton } from "../ui/Button";
import Icon from "../ui/Icon";
import FleetMapView from "./FleetMapView";
import { Badge, Figure, LoadError, Loading, Modal } from "./kit";
import { END_REASON, formatDateTime, parseTime, tripSeconds, tripTitle } from "./fleetUi";
import { parseRouteCoordinates } from "../../../services/navigation";
import { bearingBetween, formatDistance, formatDuration, shortPlaceName } from "../../../services/routingApi";
import { getTripTrack } from "../../../services/orgApi";

const PLAY_STEP_MS = 120; // one recorded point per tick while playing

export default function TripReplay({ sessionId, onClose, tc }) {
  const { data, loading, error, reload } = useLoad(`track-${sessionId}`, () => getTripTrack(sessionId));
  const session = data?.session ?? null;
  const points = useMemo(() => data?.points ?? [], [data]);

  const track = useMemo(() => points.map((point) => [point.lat, point.lng]), [points]);
  const planned = useMemo(
    () => parseRouteCoordinates(data?.route?.routeCoordinates).map((point) => [point.lat, point.lng]),
    [data],
  );

  // ── The slider ──
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const last = Math.max(0, points.length - 1);
  const at = Math.min(index, last);
  const running = playing && at < last; // playing stops by itself at the end

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setIndex((current) => Math.min(last, current + 1)), PLAY_STEP_MS);
    return () => clearInterval(timer);
  }, [running, last]);

  const togglePlay = () => {
    if (running) { setPlaying(false); return; }
    if (at >= last) setIndex(0); // at the end → start over
    setPlaying(true);
  };

  const point = points[at] || null;
  const marker = useMemo(() => {
    if (!point || !session) return [];
    const next = points[Math.min(at + 1, last)];
    const previous = points[Math.max(at - 1, 0)];
    const heading = next && next !== point
      ? bearingBetween(point.lat, point.lng, next.lat, next.lng)
      : previous && previous !== point
        ? bearingBetween(previous.lat, previous.lng, point.lat, point.lng)
        : null;
    return [{ id: "replay", code: session.vehicleCode, type: "BUS", lat: point.lat, lng: point.lng, heading, state: "replay" }];
  }, [point, points, at, last, session]);

  const start = useMemo(() => (
    points.length ? { lat: points[0].lat, lng: points[0].lng, name: shortPlaceName(session?.fromName, "Start") } : null
  ), [points, session]);
  const end = useMemo(() => (
    points.length > 1
      ? { lat: points[last].lat, lng: points[last].lng, name: "Where the trip ended" }
      : null
  ), [points, last]);

  const seconds = tripSeconds(session);
  const pointTime = point ? parseTime(point.at) : null;

  return (
    <Modal tc={tc} wide icon="history" title={session ? `${session.vehicleCode} · ${tripTitle(session)}` : "Trip"} onClose={onClose}>
      {loading ? (
        <Loading label="Loading the trip…" tc={tc} compact />
      ) : !session ? (
        <LoadError error={error} onRetry={reload} tc={tc} />
      ) : (
        <div className="space-y-4">
          <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${tc.sub}`}>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="steering" size={13} />
              {session.driverName}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatDateTime(session.startedAt)}</span>
            {session.status === "ACTIVE" && <Badge tone="ok" tc={tc}>Still running</Badge>}
            {session.status === "CANCELLED" && <Badge tone="warn" tc={tc}>No position was sent</Badge>}
            {session.endReason && session.endReason !== "DRIVER" && (
              <Badge tone="warn" tc={tc}>{END_REASON[session.endReason] || "Ended"}</Badge>
            )}
          </div>

          <div className="flex items-start gap-2">
            <Figure tc={tc} label="Driven" value={formatDistance(session.distanceMeters || 0)} />
            <span className={`mt-1 h-8 w-px shrink-0 ${tc.hairline}`} />
            <Figure tc={tc} label="Time" value={seconds != null ? formatDuration(seconds) : "—"} />
            <span className={`mt-1 h-8 w-px shrink-0 ${tc.hairline}`} />
            <Figure tc={tc} label="Top speed"
              value={session.maxSpeedKmh > 0 ? `${Math.round(session.maxSpeedKmh)} km/h` : "—"} />
            {session.overspeedCount > 0 && (
              <>
                <span className={`mt-1 h-8 w-px shrink-0 ${tc.hairline}`} />
                <Figure tc={tc} label="Over limit" value={`${session.overspeedCount}×`} />
              </>
            )}
          </div>

          {track.length === 0 ? (
            <div className={`rounded-xl border p-4 text-center text-sm ${tc.divider} ${tc.sub}`}>
              No path was recorded for this trip
              {session.status === "COMPLETED" ? " — recorded paths are kept for 90 days." : "."}
            </div>
          ) : (
            <>
              <div className={`relative h-[300px] overflow-hidden rounded-xl border sm:h-[360px] ${tc.divider}`}>
                <FleetMapView
                  compact
                  tc={tc}
                  vehicles={marker}
                  track={track}
                  planned={planned}
                  start={start}
                  destination={end}
                  fitKey={`replay-${sessionId}`}
                />
              </div>

              {points.length > 1 && (
                <div className={`rounded-lg border p-3 ${tc.record}`}>
                  <div className="flex items-center gap-3">
                    <IconButton
                      icon={running ? "pause" : "play"}
                      label={running ? "Pause" : "Play the trip"}
                      variant="primary"
                      tc={tc}
                      onClick={togglePlay}
                    />
                    <input
                      type="range"
                      min={0}
                      max={last}
                      value={at}
                      onChange={(event) => { setPlaying(false); setIndex(Number(event.target.value)); }}
                      aria-label="Position in the trip"
                      className="h-2 min-w-0 flex-1 cursor-pointer accent-[#FF7A1A]"
                    />
                  </div>
                  <p className={`mt-2 flex flex-wrap justify-between gap-x-3 text-xs tabular-nums ${tc.sub}`}>
                    <span>
                      {pointTime != null
                        ? new Date(pointTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })
                        : "—"}
                    </span>
                    <span>{point?.speedKmh != null ? `${Math.round(point.speedKmh)} km/h` : "speed not recorded"}</span>
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end">
            <Button variant="secondary" tc={tc} onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
