// ============================================================
// 👥 GroupRidersPanel.jsx — Group Ride Participants Bar
//
// Shows a horizontally scrollable list of riders in the active group.
// Placed at the bottom of the map view.
// ============================================================

import React from "react";

export default function GroupRidersPanel({ participants = [], currentUserId, onRiderClick }) {
  if (!participants || participants.length === 0) return null;

  return (
    <div style={{
      position: "absolute",
      bottom: "110px",
      left: "16px",
      right: "16px",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      gap: "12px",
      background: "rgba(15,15,26,0.85)",
      backdropFilter: "blur(16px)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "20px",
      padding: "10px 14px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      animation: "grpSlideUp 0.3s ease-out both",
    }}>
      {/* ── Left side: Info ── */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingRight: "12px",
        borderRight: "1px solid rgba(255,255,255,0.1)",
        flexShrink: 0,
      }}>
        <div style={{ fontSize: "18px" }}>👥</div>
        <div style={{
          color: "white",
          fontSize: "11px",
          fontWeight: 700,
          marginTop: "4px",
          whiteSpace: "nowrap"
        }}>
          {participants.length} {participants.length === 1 ? "Rider" : "Riders"}
        </div>
      </div>

      {/* ── Right side: Scrollable Avatars ── */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        overflowX: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        paddingBottom: "4px",
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
                width: "52px",
                flexShrink: 0,
              }}
            >
              <div style={{
                position: "relative",
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: p.color || "#4b5563",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                border: isMe ? "2.5px solid #22c55e" : "2px solid rgba(255,255,255,0.8)",
              }}>
                <span style={{
                  color: "white",
                  fontSize: "18px",
                  fontWeight: 800,
                  textShadow: "0 1px 2px rgba(0,0,0,0.3)"
                }}>
                  {p.avatarLetter || (p.username ? p.username.charAt(0).toUpperCase() : "?")}
                </span>
                
                {isAdmin && (
                  <div style={{
                    position: "absolute",
                    top: "-8px",
                    right: "-6px",
                    fontSize: "14px",
                    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))"
                  }}>
                    👑
                  </div>
                )}
              </div>
              
              <div style={{
                color: isMe ? "#22c55e" : "white",
                fontSize: "11px",
                fontWeight: isMe ? 700 : 500,
                marginTop: "6px",
                textAlign: "center",
                width: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {isMe ? "You" : p.username}
              </div>
            </div>
          );
        })}
      </div>
      
      <style>{`
        @keyframes grpSlideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        /* Hide scrollbar for Chrome, Safari and Opera */
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
