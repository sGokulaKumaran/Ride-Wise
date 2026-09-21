// ============================================================
// 👥 GroupRidersPanel.jsx — Collapsible Group Ride Participants
//
// Small toggle button that expands into a rider avatar row.
// Positioned above the speed/step HUD chips on the right side.
// ============================================================

import { useState } from "react";

export default function GroupRidersPanel({ participants = [], currentUserId, onRiderClick }) {
  const [expanded, setExpanded] = useState(false);

  if (!participants || participants.length === 0) return null;

  // Count excluding self
  const otherCount = participants.filter(p => p.userId !== currentUserId).length;
  const totalCount = participants.length; // +1 for self (if not in participants list)

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
          👥 {totalCount} Riders
        </span>
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
          const isAdmin = p.role === "admin";
          
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
                
                {isAdmin && (
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
      
      <style>{`
        @keyframes grpExpand {
          from { transform: scale(0.9) translateY(10px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
