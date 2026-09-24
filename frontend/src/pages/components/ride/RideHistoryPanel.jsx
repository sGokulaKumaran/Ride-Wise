// ============================================================
// 📋 RideHistoryPanel.jsx — Full ride history side panel
//
// Shows all rides for the logged-in user (newest first).
// Features per card:
//   ✅ From → Destination summary
//   ✅ Distance, duration, date
//   ✅ Status badge (active / completed / cancelled)
//   ✅ "Open Map" button — reopens the full-screen map for that ride
//   ✅ Delete button   — permanently deletes the ride after confirmation
//
// PROPS:
//   rides         — array of ride objects (from backend/localStorage)
//   onOpenRide    — callback(ride) — reopens full-screen map for a ride
//   onDeleteRide  — callback(rideId) — deletes ride + refreshes list
//   onClose       — close the panel
//   tc            — theme classes
// ============================================================

import { useState } from "react";
import RideMap from "./RideMap";
import Icon from "../ui/Icon";
import { formatDistance, formatDuration } from "../../../services/routingApi";

// ---- Status → colour mapping ----
const STATUS_STYLE = {
  active:    { bg: "#22c55e22", border: "#22c55e44", text: "#22c55e" },
  completed: { bg: "#6b728022", border: "#6b728044", text: "#9ca3af" },
  cancelled: { bg: "#ef444422", border: "#ef444444", text: "#ef4444" },
};

export default function RideHistoryPanel({ rides, onOpenRide, onDeleteRide, onClose, tc }) {
  // Track which card's map is expanded
  const [expandedId, setExpandedId]   = useState(null);
  // Track which card has a delete confirmation pending
  const [deletingId,  setDeletingId]  = useState(null);
  const [deleting,    setDeleting]    = useState(false); // spinner state

  // Toggle a card's map expansion
  const toggleExpand = (id) => setExpandedId(prev => prev === id ? null : id);

  // First click on delete = show confirmation
  // Second click = actually delete
  const handleDelete = async (rideId) => {
    if (deletingId !== rideId) {
      setDeletingId(rideId); // show confirm state
      return;
    }
    setDeleting(true);
    await onDeleteRide(rideId);
    setDeletingId(null);
    setDeleting(false);
  };

  // Cancel the delete confirmation
  const cancelDelete = (e) => {
    e.stopPropagation(); // don't bubble to card expansion
    setDeletingId(null);
  };

  return (
    <div
      className={tc.overlay}
      style={{
        position:       "fixed",
        inset:          0,
        zIndex:         7000,
        backdropFilter: "blur(8px)",
        display:        "flex",
        justifyContent: "flex-end",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ---- Side panel ---- */}
      <div
        className={`${tc.card} ${tc.text}`}
        style={{
          width:         "100%",
          maxWidth:      "480px",
          height:        "100%",
          display:       "flex",
          flexDirection: "column",
          animation:     "slideRight 0.3s cubic-bezier(0.32,0.72,0,1)",
          boxShadow:     "-20px 0 80px rgba(0,0,0,0.35)",
        }}>
        {/* ---- Header ---- */}
        <div
          className={tc.divider}
          style={{
            display:       "flex",
            alignItems:    "center",
            justifyContent:"space-between",
            padding:       "20px",
            borderBottomWidth: "1px",
            flexShrink:    0,
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className={tc.accentSoft} style={{
              width: "38px", height: "38px", borderRadius: "12px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name="history" size={17} />
            </div>
            <div>
              <p style={{ fontWeight: 900, fontSize: "16px", margin: 0 }}>Ride History</p>
              <p className={tc.sub} style={{ fontSize: "11px", margin: 0 }}>
                {rides.length} ride{rides.length !== 1 ? "s" : ""} total
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={tc.btnGhost}
            style={{
              width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        {/* ---- Ride list (scrollable) ---- */}
        <div style={{ overflowY: "auto", flex: 1, padding: "16px" }}>
          {rides.length === 0 ? (
            // Empty state
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <Icon name="route" size={48} className={`${tc.sub} mx-auto mb-4 opacity-40`} />
              <p className={tc.sub} style={{ fontWeight: 700, margin: "0 0 6px" }}>No rides yet</p>
              <p className={tc.sub} style={{ fontSize: "12px", margin: 0 }}>
                Start your first ride and it will appear here.
              </p>
            </div>
          ) : (
            // Ride cards
            rides.map(ride => {
              const statusStyle = STATUS_STYLE[ride.status] || STATUS_STYLE.completed;
              const isExpanded  = expandedId === String(ride.id);
              const isDeleting  = deletingId === String(ride.id);
              const dateStr     = ride.createdAt
                ? new Date(ride.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                : "";

              return (
                <div
                  key={ride.id}
                  className={`${tc.surface2} ${tc.divider}`}
                  style={{
                   marginBottom:  "12px",
                   borderRadius:  "18px",
                   overflow:      "hidden",
                   transition:    "background-color 0.2s, border-color 0.2s",
                  }}
                >
                  {/* Card header (always visible) */}
                  <div style={{ padding: "14px 16px" }}>
                    {/* From → Destination */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "10px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: "14px", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <i className="fa fa-circle" style={{ color: "#22c55e", fontSize: "7px", marginRight: "6px" }} />
                          {(ride.fromName || "From").split(",")[0]}
                        </p>
                        <p style={{ fontWeight: 700, fontSize: "14px", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <i className="fa fa-circle" style={{ color: "#ef4444", fontSize: "7px", marginRight: "6px" }} />
                          {(ride.destinationName || "Destination").split(",")[0]}
                        </p>
                      </div>
                      {/* Status badge */}
                      <span style={{
                        padding: "3px 10px", borderRadius: "50px",
                        background: statusStyle.bg, border: `1px solid ${statusStyle.border}`,
                        color: statusStyle.text, fontSize: "10px", fontWeight: 700,
                        textTransform: "uppercase", letterSpacing: "0.5px", flexShrink: 0,
                      }}>
                        {ride.status}
                      </span>
                    </div>

                    {/* Meta row: distance · duration · date */}
                    <div className={tc.sub} style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      fontSize: "11px", flexWrap: "wrap",
                    }}>
                      {ride.actualDistanceMeters > 0 && (
                        <>
                          <span title="Distance actually ridden">
                            <i className="fa fa-location-arrow" style={{ marginRight: "4px", color: "#34d399" }} />
                            {formatDistance(ride.actualDistanceMeters)} ridden
                          </span>
                          <span>·</span>
                        </>
                      )}
                      {ride.distanceMeters && (
                        <>
                          <span title="Planned route length"><i className="fa fa-route" style={{ marginRight: "4px", color: "#f97316" }} />{formatDistance(ride.distanceMeters)}</span>
                          <span>·</span>
                        </>
                      )}
                      {ride.durationSeconds && (
                        <>
                          <span><i className="fa fa-clock" style={{ marginRight: "4px" }} />{formatDuration(ride.durationSeconds)}</span>
                          <span>·</span>
                        </>
                      )}
                      {dateStr && <span>{dateStr}</span>}
                    </div>

                    {/* Action buttons row */}
                    <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                      {/* Open Map button */}
                      <button
                        onClick={() => onOpenRide(ride)}
                        className={ride.status === "active" ? tc.btnAccent : tc.btnSoft}
                        style={{
                          flex: 1, padding: "8px 12px",
                          borderRadius: "10px",
                          fontWeight: 700, fontSize: "12px",
                          cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                        }}
                      >
                        <i className={`fa ${ride.status === "active" ? "fa-location-crosshairs" : "fa-map"}`} />
                        {ride.status === "active" ? "Live Map" : "View Route"}
                      </button>

                      {/* Expand/collapse mini map */}
                      {ride.routeCoordinates && (
                        <button
                          onClick={() => toggleExpand(String(ride.id))}
                          className={isExpanded ? tc.accentSoft : tc.btnGhost}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "10px",
                            cursor: "pointer", fontSize: "12px",
                          }}
                          title={isExpanded ? "Collapse map" : "Preview route"}
                        >
                          <i className={`fa fa-chevron-${isExpanded ? "up" : "down"}`} />
                        </button>
                      )}

                      {/* Delete button (with confirmation) */}
                      {isDeleting ? (
                        // Confirmation row
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={cancelDelete}
                            className={tc.btnGhost}
                            style={{
                              padding: "8px 10px", borderRadius: "10px",
                              cursor: "pointer", fontSize: "11px",
                            }}
                          >
                            <i className="fa fa-times" />
                          </button>
                          <button
                            onClick={() => handleDelete(String(ride.id))}
                            disabled={deleting}
                            style={{
                              padding: "8px 10px", borderRadius: "10px",
                              background: "rgba(239,68,68,0.2)",
                              border: "1px solid rgba(239,68,68,0.4)",
                              color: "#ef4444", cursor: deleting ? "not-allowed" : "pointer", fontSize: "11px",
                            }}
                          >
                            <i className={`fa ${deleting ? "fa-spinner fa-spin" : "fa-check"}`} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleDelete(String(ride.id))}
                          title="Delete ride"
                          style={{
                            padding: "8px 12px", borderRadius: "10px",
                            background: "rgba(239,68,68,0.06)",
                            border: "1px solid rgba(239,68,68,0.15)",
                            color: "rgba(239,68,68,0.6)",
                            cursor: "pointer", fontSize: "12px",
                          }}
                        >
                          <i className="fa fa-trash" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable mini map */}
                  {isExpanded && (
                      <div
                        className={tc.divider}
                        style={{ borderTopWidth: "1px", height: "200px" }}
                      >
                      <RideMap ride={ride} isLive={false} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Slide-in animation keyframe */}
      <style>{`
        @keyframes slideRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
