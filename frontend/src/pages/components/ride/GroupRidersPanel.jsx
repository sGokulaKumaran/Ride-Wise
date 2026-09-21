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

export default function GroupRidersPanel({
  participants = [],
  currentUserId,
  onRiderClick,
  isAdmin = false,          // true → show the "add rider" affordance
  rideId = null,            // needed to POST new participants
  onParticipantsChanged,    // called after a rider is added (parent re-fetches)
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
        style={{
          position: "absolute",
          bottom: "270px",
          right: "16px",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "rgba(15,15,26,0.9)",
          backdropFilter: "blur(12px)",
          border: "1.5px solid rgba(139,92,246,0.4)",
          borderRadius: "14px",
          padding: "8px 12px",
          cursor: "pointer",
          color: "white",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          transition: "all 0.2s",
        }}
      >
        {/* Stacked mini avatars */}
        <div style={{ display: "flex", marginRight: "2px" }}>
          {participants.filter(p => p.userId !== currentUserId).slice(0, 3).map((p, i) => (
            <div
              key={p.userId}
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: p.color || "#8b5cf6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1.5px solid rgba(15,15,26,0.9)",
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
        <span style={{ fontWeight: 800, fontSize: "12px", color: "#a78bfa" }}>
          {otherCount}
        </span>
        <i className="fa fa-chevron-down" style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)" }} />
      </button>
    );
  }

  // ── Expanded: Avatar row panel ──
  return (
    <div style={{
      position: "absolute",
      bottom: "270px",
      right: "16px",
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      background: "rgba(15,15,26,0.92)",
      backdropFilter: "blur(16px)",
      border: "1.5px solid rgba(139,92,246,0.3)",
      borderRadius: "18px",
      padding: "10px 12px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      animation: "grpExpand 0.2s ease-out both",
      maxWidth: "280px",
    }}>
      {/* Header row with close button */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: "6px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>
          👥 {participants.length} Riders
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {/* Admin-only: add friends while the ride is live */}
          {canAddRiders && (
            <button
              onClick={toggleAdd}
              title="Add a friend to this ride"
              style={{
                background: showAdd
                  ? "linear-gradient(135deg, #f97316, #ec4899)"
                  : "linear-gradient(135deg, rgba(249,115,22,0.25), rgba(139,92,246,0.25))",
                border: "1px solid rgba(249,115,22,0.5)",
                borderRadius: "8px",
                padding: "3px 8px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
                color: showAdd ? "white" : "#fb923c",
                fontSize: "10px",
                fontWeight: 800,
              }}
            >
              <i className={`fa ${showAdd ? "fa-xmark" : "fa-user-plus"}`} />
              {showAdd ? "Close" : "Add"}
            </button>
          )}
          <button
            onClick={() => setExpanded(false)}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: "6px",
              width: "22px",
              height: "22px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "rgba(255,255,255,0.5)",
              fontSize: "10px",
            }}
          >
            <i className="fa fa-chevron-up" />
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
              <div style={{
                position: "relative",
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                background: p.color || "#4b5563",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                border: isMe ? "2px solid #22c55e" : "1.5px solid rgba(255,255,255,0.6)",
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
                    fontSize: "10px",
                    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))"
                  }}>
                    👑
                  </div>
                )}
              </div>
              
              <div style={{
                color: isMe ? "#22c55e" : "rgba(255,255,255,0.7)",
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
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingTop: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          maxHeight: "180px",
          overflowY: "auto",
          scrollbarWidth: "none",
        }}>
          <p style={{
            margin: 0, fontSize: "10px", fontWeight: 800,
            color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.5px",
          }}>
            Add friends to this ride
          </p>

          {/* Loading state */}
          {loadingFriends && (
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", padding: "6px 0" }}>
              <i className="fa fa-spinner fa-spin" style={{ marginRight: "6px" }} />
              Loading friends...
            </div>
          )}

          {/* Load error state (with retry) */}
          {!loadingFriends && friendsError && (
            <div style={{ fontSize: "11px", color: "#fca5a5" }}>
              <i className="fa fa-triangle-exclamation" style={{ marginRight: "6px" }} />
              {friendsError}
              <button
                onClick={loadFriends}
                style={{
                  marginLeft: "8px", background: "rgba(249,115,22,0.2)",
                  border: "1px solid rgba(249,115,22,0.4)", borderRadius: "6px",
                  color: "#fb923c", fontSize: "10px", fontWeight: 700,
                  padding: "2px 8px", cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Add error state */}
          {addError && (
            <div style={{ fontSize: "11px", color: "#fca5a5" }}>
              <i className="fa fa-triangle-exclamation" style={{ marginRight: "6px" }} />
              {addError}
            </div>
          )}

          {/* Empty state */}
          {!loadingFriends && !friendsError && addableFriends.length === 0 && (
            <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
              All your friends are already riding 🎉
            </p>
          )}

          {/* Addable friend rows */}
          {!loadingFriends && addableFriends.map(friend => (
            <div
              key={friend.id}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                background: "rgba(139,92,246,0.08)",
                border: "1px solid rgba(139,92,246,0.2)",
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
              <span style={{
                flex: 1, minWidth: 0, fontSize: "12px", fontWeight: 700, color: "white",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {friend.username || "Rider"}
              </span>
              {/* Add button */}
              <button
                onClick={() => handleAddFriend(friend)}
                disabled={addingId === friend.id}
                style={{
                  background: addingId === friend.id
                    ? "rgba(255,255,255,0.1)"
                    : "linear-gradient(135deg, #f97316, #ec4899)",
                  border: "none", borderRadius: "8px",
                  padding: "4px 10px",
                  color: "white", fontSize: "10px", fontWeight: 800,
                  cursor: addingId === friend.id ? "not-allowed" : "pointer",
                  opacity: addingId === friend.id ? 0.7 : 1,
                  flexShrink: 0,
                }}
              >
                {addingId === friend.id
                  ? <i className="fa fa-spinner fa-spin" />
                  : <><i className="fa fa-plus" style={{ marginRight: "4px" }} />Add</>}
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
