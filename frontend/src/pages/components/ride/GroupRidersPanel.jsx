// ============================================================
// 👥 GroupRidersPanel.jsx — Collapsible Group Ride Participants
//
// Small toggle button that expands into a rider avatar row.
// Positioned above the speed/step HUD chips on the right side.
//
// ADMIN EXTRAS (isAdmin + rideId):
//   • "+ Add" button fetches the admin's connections
//     (getConnectionsFull), excludes riders already active in the
//     ride, and lets the admin add friends WHILE the ride is live
//     via POST /api/rides/{rideId}/participants { adminId, userId }.
//   • After a successful add, onParticipantsChanged() is called so
//     ActiveRideOverlay refreshes the participant list (the new
//     rider's marker then appears on the map).
// ============================================================

import { useState } from "react";
import { getConnectionsFull } from "../../../services/ridersApi";
import { addGroupRideParticipant } from "../../../services/rideApi";
import Icon from "../ui/Icon";
import { useTheme } from "../../hooks/useTheme";

export default function GroupRidersPanel({
  participants = [],
  currentUserId,
  onRiderClick,
  isAdmin = false,          // true → show the "add rider" affordance
  rideId = null,            // needed to POST new participants
  onParticipantsChanged,    // called after a rider is added (parent re-fetches)
  tc: providedTc,
}) {
  const { tc: userTc } = useTheme(currentUserId);
  const tc = providedTc || userTc;
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

  // Count excluding self
  const otherCount = participants.filter(p => p.userId !== currentUserId).length;

  // ── Load admin's friends, excluding riders already in the ride ──
  const loadFriends = async () => {
    setLoadingFriends(true);
    setFriendsError(null);
    try {
      const list = await getConnectionsFull(currentUserId);
      setConnections(list || []);
    } catch (e) {
      setFriendsError(e.message || "Could not load friends");
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
      // POST /api/rides/{rideId}/participants { adminId, userId }
      await addGroupRideParticipant(rideId, currentUserId, friend.id);
      // Remove from the candidate list immediately (they're now active)
      setConnections(prev => prev.filter(f => String(f.id) !== String(friend.id)));
      // Ask the overlay to re-fetch participants so the new rider shows up
      onParticipantsChanged?.();
    } catch (e) {
      setAddError(e.message || "Could not add rider");
    } finally {
      setAddingId(null);
    }
  };

  // Friends who are NOT already active participants (and not self)
  const activeIds = new Set(participants.map(p => String(p.userId)));
  activeIds.add(String(currentUserId));
  const addableFriends = connections.filter(f => !activeIds.has(String(f.id)));

  // ── Collapsed: Small pill button ──
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        title="Show group riders"
        className={tc.mapControl}
        style={{
          position: "absolute",
          bottom: "270px",
          right: "16px",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          borderRadius: "14px",
          padding: "8px 12px",
          cursor: "pointer",
          transition: "all 0.2s",
        }}
      >
        {/* Stacked mini avatars */}
        <div style={{ display: "flex", marginRight: "2px" }}>
          {participants.filter(p => p.userId !== currentUserId).slice(0, 3).map((p, i) => (
            <div
              key={p.userId}
              className={`${tc.divider} border-[1.5px]`}
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: p.color || "#8b5cf6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: i > 0 ? "-6px" : "0",
                fontSize: "10px",
                fontWeight: 800,
                color: "white",
                zIndex: 3 - i,
              }}
            >
              {p.avatarLetter || (p.username ? p.username.charAt(0).toUpperCase() : "?")}
            </div>
          ))}
        </div>
        <span className={tc.accent} style={{ fontWeight: 800, fontSize: "12px" }}>
          {otherCount}
        </span>
        <Icon name="chevronDown" size={10} className="opacity-50" />
      </button>
    );
  }

  // ── Expanded: Avatar row panel ──
  return (
    <div
      className={tc.card}
      style={{
      position: "absolute",
      bottom: "270px",
      right: "16px",
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      borderRadius: "18px",
      padding: "10px 12px",
      animation: "grpExpand 0.2s ease-out both",
      maxWidth: "280px",
    }}>
      {/* Header row with close button */}
      <div
        className={`${tc.divider} flex items-center justify-between`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: "6px",
        }}
      >
        <span className={tc.sub} style={{ fontSize: "11px", fontWeight: 700 }}>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="riders" size={12} /> {participants.length} Riders
          </span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {/* Admin-only: add friends while the ride is live */}
          {canAddRiders && (
            <button
              onClick={toggleAdd}
              title="Add a friend to this ride"
              className={showAdd ? tc.btnAccent : tc.btnSecondary}
              style={{
                borderRadius: "8px",
                padding: "3px 8px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
                fontSize: "10px",
                fontWeight: 800,
              }}
            >
              <Icon name={showAdd ? "close" : "userPlus"} size={11} />
              {showAdd ? "Close" : "Add"}
            </button>
          )}
          <button
            onClick={() => setExpanded(false)}
            className={tc.btnGhost}
            style={{
              borderRadius: "6px",
              width: "22px",
              height: "22px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "10px",
            }}
          >
            <Icon name="chevronUp" size={11} />
          </button>
        </div>
      </div>

      {/* Scrollable avatar row */}
      <div style={{
        display: "flex",
        gap: "8px",
        overflowX: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        paddingBottom: "2px",
      }}>
        {participants.map((p) => {
          const isMe = p.userId === currentUserId;
          const isRiderAdmin = p.role === "admin";
          
          return (
            <div
              key={p.userId}
              onClick={() => onRiderClick && onRiderClick(p)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                width: "44px",
                flexShrink: 0,
              }}
            >
              <div
                className={`border-[1.5px] ${isMe ? "" : tc.divider}`}
                style={{
                  position: "relative",
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                background: p.color || "#4b5563",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                border: isMe ? "2px solid #22c55e" : undefined,
              }}>
                <span style={{
                  color: "white",
                  fontSize: "13px",
                  fontWeight: 800,
                  textShadow: "0 1px 2px rgba(0,0,0,0.3)"
                }}>
                  {p.avatarLetter || (p.username ? p.username.charAt(0).toUpperCase() : "?")}
                </span>
                
                {isRiderAdmin && (
                  <div style={{
                    position: "absolute",
                    top: "-6px",
                    right: "-4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "13px",
                    height: "13px",
                    borderRadius: "50%",
                    background: "#0b0b0c",
                    color: "#f5f5f5",
                  }}>
                    <Icon name="shield" size={9} />
                  </div>
                )}
              </div>
              
              <div
                className={isMe ? tc.ok : tc.sub}
                style={{
                  fontSize: "9px",
                fontWeight: isMe ? 700 : 500,
                marginTop: "4px",
                textAlign: "center",
                width: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {isMe ? "You" : (p.username || "Rider")}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Admin: Add friends while live (orange/purple style) ── */}
      {canAddRiders && showAdd && (
        <div
          className={`${tc.divider} border-t`}
          style={{
          paddingTop: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          maxHeight: "180px",
          overflowY: "auto",
          scrollbarWidth: "none",
        }}>
          <p
            className={tc.accent}
            style={{
              margin: 0, fontSize: "10px", fontWeight: 800,
              textTransform: "uppercase", letterSpacing: "0.5px",
            }}
          >
            Add friends to this ride
          </p>

          {/* Loading state */}
          {loadingFriends && (
            <div className={tc.sub} style={{ fontSize: "11px", padding: "6px 0" }}>
              <Icon name="spinner" size={12} className="mr-1.5 inline-block animate-spin" />
              Loading friends...
            </div>
          )}

          {/* Load error state (with retry) */}
          {!loadingFriends && friendsError && (
            <div className={tc.danger} style={{ fontSize: "11px" }}>
              <Icon name="alertTriangle" size={12} className="mr-1.5 inline-block" />
              {friendsError}
              <button
                onClick={loadFriends}
                className={tc.btnSecondary}
                style={{
                  marginLeft: "8px", borderRadius: "6px",
                  fontSize: "10px", fontWeight: 700,
                  padding: "2px 8px", cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Add error state */}
          {addError && (
            <div className={tc.danger} style={{ fontSize: "11px" }}>
              <Icon name="alertTriangle" size={12} className="mr-1.5 inline-block" />
              {addError}
            </div>
          )}

          {/* Empty state */}
          {!loadingFriends && !friendsError && addableFriends.length === 0 && (
            <p className={tc.sub} style={{ margin: 0, fontSize: "11px" }}>
              All your friends are already riding
            </p>
          )}

          {/* Addable friend rows */}
          {!loadingFriends && addableFriends.map(friend => (
            <div
              key={friend.id}
              className={`${tc.surface2} ${tc.divider} border`}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                borderRadius: "10px", padding: "6px 8px",
              }}
            >
              {/* Avatar */}
              <div style={{
                width: "26px", height: "26px", borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontWeight: 900, fontSize: "11px",
              }}>
                {(friend.username || friend.email || "?")[0].toUpperCase()}
              </div>
              {/* Name */}
              <span
                className={tc.text}
                style={{
                  flex: 1, minWidth: 0, fontSize: "12px", fontWeight: 700,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {friend.username || "Rider"}
              </span>
              {/* Add button */}
              <button
                onClick={() => handleAddFriend(friend)}
                disabled={addingId === friend.id}
                className={addingId === friend.id ? tc.btnSoft : tc.btnAccent}
                style={{
                  borderRadius: "8px",
                  padding: "4px 10px",
                  fontSize: "10px", fontWeight: 800,
                  cursor: addingId === friend.id ? "not-allowed" : "pointer",
                  opacity: addingId === friend.id ? 0.7 : 1,
                  flexShrink: 0,
                }}
              >
                {addingId === friend.id
                  ? <Icon name="spinner" size={11} className="inline-block animate-spin" />
                  : <><Icon name="plus" size={11} className="mr-1 inline-block" />Add</>}
              </button>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes grpExpand {
          from { transform: scale(0.9) translateY(10px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
