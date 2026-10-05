// ============================================================
// GroupRidersPanel.jsx — who is riding with me
//
// A small pill on the map (stacked avatars + count) that opens into a
// panel with one tile per rider:
//   • a live dot — green when their position is fresh, grey when not
//   • "Off route" when they have left the shared route
//   • tap a rider to look at them on the map
//
// ADMIN EXTRAS (isAdmin + rideId):
//   • "Add" lists the admin's connections who are not in the ride yet and
//     adds one with POST /api/rides/{rideId}/participants.
//   • After a successful add, onParticipantsChanged() lets the overlay
//     refresh the list so the new rider's marker appears.
//
// PROPS
//   participants          riders with { userId, username, color, lat, lng,
//                         role, locationUnavailable, … }
//   currentUserId         the logged-in rider
//   riderStatus           { userId: { offRoute, distance } }
//   sharing               am I sharing MY live location?
//   onRiderClick(rider)   look at that rider on the map
//   isAdmin / rideId      enable the add-rider section
//   onParticipantsChanged called after a rider was added
//   tc                    theme classes
//   style                 where the pill/panel sits on the map
// ============================================================

import { useState } from "react";
import { getConnectionsFull } from "../../../services/ridersApi";
import { addGroupRideParticipant } from "../../../services/rideApi";
import { formatDistance } from "../../../services/routingApi";
import Icon from "../ui/Icon";
import Button from "../ui/Button";

const initialOf = (rider) =>
  rider.avatarLetter || (rider.username ? rider.username.charAt(0).toUpperCase() : "?");

export default function GroupRidersPanel({
  participants = [],
  currentUserId,
  riderStatus = null,
  onRiderClick,
  isAdmin = false,
  rideId = null,
  sharing = false,
  onParticipantsChanged,
  tc,
  style,
}) {
  const [expanded, setExpanded] = useState(false);

  // ── Add-rider (admin, live ride) state ──
  const [showAdd,        setShowAdd]        = useState(false);
  const [connections,    setConnections]    = useState([]);   // raw friends list
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [friendsError,   setFriendsError]   = useState(null); // load error
  const [addingId,       setAddingId]       = useState(null); // friend.id being added
  const [addError,       setAddError]       = useState(null); // add error

  const canAddRiders = Boolean(isAdmin && rideId && currentUserId);

  if (!participants || participants.length === 0) return null;

  const isMe = (rider) => String(rider.userId) === String(currentUserId);
  const others = participants.filter((rider) => !isMe(rider));

  // ── Load the admin's friends ──
  const loadFriends = async () => {
    setLoadingFriends(true);
    setFriendsError(null);
    try {
      const list = await getConnectionsFull(currentUserId);
      setConnections(list || []);
    } catch (e) {
      setFriendsError(e.message || "Could not load your riders");
      setConnections([]);
    } finally {
      setLoadingFriends(false);
    }
  };

  const toggleAdd = () => {
    const next = !showAdd;
    setShowAdd(next);
    setAddError(null);
    if (next) loadFriends(); // fresh fetch each time the section opens
  };

  // ── Add one friend to the live ride ──
  const handleAddFriend = async (friend) => {
    if (!rideId || addingId) return;
    setAddingId(friend.id);
    setAddError(null);
    try {
      await addGroupRideParticipant(rideId, currentUserId, friend.id);
      // Remove from the candidate list immediately (they're now active)
      setConnections((prev) => prev.filter((f) => String(f.id) !== String(friend.id)));
      onParticipantsChanged?.();
    } catch (e) {
      setAddError(e.message || "Could not add this rider");
    } finally {
      setAddingId(null);
    }
  };

  // Friends who are NOT already active participants (and not self)
  const activeIds = new Set(participants.map((rider) => String(rider.userId)));
  activeIds.add(String(currentUserId));
  const addableFriends = connections.filter((friend) => !activeIds.has(String(friend.id)));

  // ── Collapsed: a pill with stacked avatars ──
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        title="Show the riders in this ride"
        aria-label={`Riders in this ride: ${participants.length}`}
        className={`absolute z-[1050] flex h-11 items-center gap-2 rounded-full border pl-2 pr-3 ${tc.mapControl}`}
        style={style}
      >
        <span className="flex">
          {(others.length ? others : participants).slice(0, 3).map((rider, index) => (
            <span
              key={rider.userId}
              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold text-white ${tc.avatarRing}`}
              style={{ background: rider.color || "#8B5CF6", marginLeft: index > 0 ? "-8px" : 0, zIndex: 3 - index }}
            >
              {initialOf(rider)}
            </span>
          ))}
        </span>
        <span className="text-sm font-semibold tabular-nums">{participants.length}</span>
        <Icon name="chevronDown" size={14} className={tc.sub} />
      </button>
    );
  }

  // ── Expanded: one tile per rider ──
  return (
    <div
      className={`absolute z-[1050] flex w-[min(300px,calc(100vw-88px))] flex-col gap-2 rounded-xl border p-3 shadow-lg ${tc.card} ${tc.text}`}
      style={style}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <Icon name="riders" size={16} className={tc.sub} />
          {participants.length} {participants.length === 1 ? "rider" : "riders"}
        </span>
        <div className="flex items-center gap-1">
          {canAddRiders && (
            <Button
              variant={showAdd ? "soft" : "secondary"}
              size="sm"
              icon={showAdd ? "close" : "userPlus"}
              tc={tc}
              onClick={toggleAdd}
              title="Add one of your riders to this ride"
            >
              {showAdd ? "Done" : "Add"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon="chevronUp"
            iconOnly
            tc={tc}
            title="Hide riders"
            onClick={() => setExpanded(false)}
          />
        </div>
      </div>

      {/* Rider tiles */}
      <div className="scrollbar-hide flex gap-1 overflow-x-auto pb-0.5">
        {participants.map((rider) => {
          const me = isMe(rider);
          // "Unavailable" = no fresh live position. For me: I am not sharing.
          const unavailable = me ? !sharing : rider.locationUnavailable;
          const info = riderStatus?.[String(rider.userId)];
          const offRoute = !me && !unavailable && Boolean(info?.offRoute);

          let label = "Live";
          let labelClass = tc.ok;
          if (unavailable) { label = me ? "Not shared" : "No GPS"; labelClass = tc.sub; }
          else if (offRoute) { label = "Off route"; labelClass = tc.warn; }

          return (
            <button
              key={rider.userId}
              type="button"
              onClick={() => onRiderClick?.(rider)}
              disabled={unavailable || me}
              title={
                unavailable
                  ? "No live position"
                  : offRoute
                    ? `${formatDistance(info.distance)} from the route — tap to find them`
                    : me ? "You" : "Tap to find them on the map"
              }
              className={`flex w-[58px] shrink-0 flex-col items-center rounded-lg px-1 py-1.5 transition-colors ${
                unavailable || me ? "cursor-default" : tc.cardHover
              }`}
            >
              <span className="relative">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: rider.color || "#6B7280", opacity: unavailable ? 0.45 : 1 }}
                >
                  {initialOf(rider)}
                </span>
                {/* live dot: green = fresh position, grey = none */}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 ${tc.avatarRing}`}
                  style={{ background: unavailable ? "#9CA3AF" : "#22C55E" }}
                />
                {rider.role === "admin" && (
                  <span
                    className={`absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full ${tc.inkTile}`}
                    title="Ride admin"
                  >
                    <Icon name="shield" size={10} />
                  </span>
                )}
              </span>
              <span className="mt-1.5 w-full truncate text-center text-[11px] font-semibold">
                {me ? "You" : rider.username || "Rider"}
              </span>
              <span className={`text-[10px] font-medium ${labelClass}`}>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Admin: add riders while the ride is live ── */}
      {canAddRiders && showAdd && (
        <div className={`flex max-h-[190px] flex-col gap-1.5 overflow-y-auto border-t pt-2.5 ${tc.divider}`}>
          <p className={`text-[11px] font-semibold uppercase tracking-wider ${tc.sub}`}>
            Add to this ride
          </p>

          {loadingFriends && (
            <p className={`flex items-center gap-2 py-1.5 text-xs ${tc.sub}`}>
              <Icon name="spinner" size={14} className="rw-spin" />
              Loading your riders…
            </p>
          )}

          {!loadingFriends && friendsError && (
            <div className={`flex items-center gap-2 text-xs ${tc.danger}`}>
              <Icon name="alertTriangle" size={14} />
              <span className="flex-1">{friendsError}</span>
              <Button variant="secondary" size="sm" tc={tc} onClick={loadFriends}>Retry</Button>
            </div>
          )}

          {addError && (
            <p className={`flex items-center gap-2 text-xs ${tc.danger}`}>
              <Icon name="alertTriangle" size={14} />
              {addError}
            </p>
          )}

          {!loadingFriends && !friendsError && addableFriends.length === 0 && (
            <p className={`py-1 text-xs ${tc.sub}`}>Everyone you&apos;re connected with is already here.</p>
          )}

          {!loadingFriends && addableFriends.map((friend) => (
            <div
              key={friend.id}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${tc.surface2}`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tc.inkTile}`}>
                {(friend.username || friend.email || "?")[0].toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {friend.username || "Rider"}
              </span>
              <Button
                variant="primary"
                size="sm"
                icon="plus"
                tc={tc}
                loading={addingId === friend.id}
                disabled={Boolean(addingId)}
                onClick={() => handleAddFriend(friend)}
              >
                Add
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
