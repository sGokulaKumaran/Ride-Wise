// ============================================================
// StartRideModal.jsx — Slide-up modal for starting/managing rides
//
// SCREENS (internal state machine):
//   "home"    → two big cards: "New Ride" + "Ride History"
//   "type"    → Solo card (active) + Group card (disabled/future)
//   "setup"   → RideSetupFlow (3-step wizard)
//
// This modal does NOT handle the active map.
// When a ride is created here, it calls onRideCreated(ride)
// so Home.jsx can mount the full-screen ActiveRideOverlay.
//
// PROPS:
//   open            — boolean, controls visibility
//   onClose         — called when modal is dismissed
//   tc              — theme classes from useTheme()
//   onRideCreated   — callback(ride) when user starts a new ride
//   onOpenHistory   — callback() to open history panel
// ============================================================

import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import RideSetupFlow from "../ride/RideSetupFlow";
import { getConnectionsFull } from "../../../services/ridersApi";
import Button, { IconButton } from "../ui/Button";
import Icon from "../ui/Icon";

// Internal screen names
const SCREEN = {
  HOME:    "home",
  TYPE:    "type",
  RIDERS:  "riders",
  SETUP:   "setup",
};

export default function StartRideModal({ open, onClose, tc, onRideCreated, onOpenHistory }) {
  const { user } = useAuth();

  // Which screen is currently shown inside the modal
  const [screen,   setScreen]   = useState(SCREEN.HOME);
  const [rideType, setRideType] = useState("solo");
  const [friends, setFriends] = useState([]);
  const [selectedRiders, setSelectedRiders] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Reset to home screen whenever the modal is opened fresh
  useEffect(() => {
    if (open) setScreen(SCREEN.HOME);
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Handler: ride successfully created in the setup wizard
  const handleRideCreated = (ride) => {
    onClose();                 // close this modal
    onRideCreated(ride);       // tell Home to open the full-screen map
  };

  // Handler: user clicked "Ride History" — open history panel
  const handleHistory = () => {
    onClose();         // close this modal
    onOpenHistory();   // Home.jsx will open the history panel
  };

  if (!open) return null;

  // ---- Header labels per screen ----
  const headerLabel = {
    [SCREEN.HOME]:  { icon: "ride",   title: "RideWise"          },
    [SCREEN.TYPE]:  { icon: "route",  title: "Choose Ride Type"  },
    [SCREEN.RIDERS]: { icon: "riders", title: "Select Riders" },
    [SCREEN.SETUP]: { icon: "map",    title: rideType === "solo" ? "Solo Ride Setup" : "Group Ride Setup" },
  }[screen];

  return (
    <>
      {/* ── BACKDROP ──────────────────────────────────────────── */}
      <div
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        className={`fixed inset-0 z-[8000] flex items-end justify-center ${tc.overlay}`}
      >
        {/* ── MODAL PANEL ───────────────────────────────────────── */}
        <div
          className={`flex max-h-[90vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-xl border border-b-0 ${tc.card} ${tc.text}`}
          style={{ animation: "slideUp 0.3s cubic-bezier(0.32,0.72,0,1)" }}
        >
          {/* ── DRAG HANDLE ─────────────────────────────────────── */}
          {/* Visual hint that this is a bottom sheet */}
          <div className={`mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full ${tc.isLight ? "bg-black/15" : "bg-white/15"}`} />

          {/* ── HEADER ──────────────────────────────────────────── */}
          <div className={`flex flex-shrink-0 items-center justify-between border-b px-5 py-4 ${tc.divider}`}>
            <div className="flex items-center gap-3">
              {/* Back chevron when on type or setup screens */}
              {screen !== SCREEN.HOME && (
                <IconButton
                  icon="arrowLeft"
                  label="Back"
                  size="sm"
                  onClick={() => {
                    if (screen === SCREEN.SETUP) setScreen(rideType === "group" ? SCREEN.RIDERS : SCREEN.TYPE);
                    else if (screen === SCREEN.RIDERS) setScreen(SCREEN.TYPE);
                    else setScreen(SCREEN.HOME);
                  }}
                  tc={tc}
                />
              )}
              {/* Icon bubble */}
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tc.surface2}`}>
                <Icon name={headerLabel.icon} size={18} />
              </span>
              <span className="text-base font-semibold">{headerLabel.title}</span>
            </div>
            {/* X close button */}
            <IconButton icon="close" label="Close" size="sm" onClick={onClose} tc={tc} />
          </div>

          {/* ── SCROLLABLE CONTENT ────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-5">

            {/* ================================================
                HOME screen — New Ride + History cards
            ================================================ */}
            {screen === SCREEN.HOME && (
              <div className="flex flex-col gap-3">

                {/* NEW RIDE card — the main action of this screen */}
                <Button
                  variant="primary"
                  size="lg"
                  full
                  onClick={() => setScreen(SCREEN.TYPE)}
                  className="!h-auto w-full whitespace-normal py-4 text-left"
                  tc={tc}
                >
                  <span className="flex w-full items-center gap-4 whitespace-normal">
                    <Icon name="ride" size={22} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-base font-semibold">Start a New Ride</span>
                      <span className="text-xs font-normal opacity-70">
                        Plan your route with geocoding + live map
                      </span>
                    </span>
                    <Icon name="arrowRight" size={16} className="opacity-60" />
                  </span>
                </Button>

                {/* RIDE HISTORY card */}
                <Button
                  variant="secondary"
                  size="lg"
                  full
                  onClick={handleHistory}
                  className="!h-auto w-full whitespace-normal py-4 text-left"
                  tc={tc}
                >
                  <span className="flex w-full items-center gap-4 whitespace-normal">
                    <Icon name="history" size={22} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-base font-semibold">Ride History</span>
                      <span className={`text-xs font-normal ${tc.sub}`}>
                        View, reopen or delete past rides
                      </span>
                    </span>
                    <Icon name="arrowRight" size={16} className="opacity-60" />
                  </span>
                </Button>
              </div>
            )}

            {/* ================================================
                TYPE screen — Solo or Group
            ================================================ */}
            {screen === SCREEN.TYPE && (
              <div className="flex flex-col gap-3">
                <p className={`text-xs ${tc.sub}`}>
                  How are you riding today?
                </p>

                {/* SOLO — active */}
                <Button
                  variant={rideType === "solo" ? "soft" : "secondary"}
                  size="lg"
                  full
                  onClick={() => { setRideType("solo"); setScreen(SCREEN.SETUP); }}
                  className="!h-auto w-full whitespace-normal py-4 text-left"
                  tc={tc}
                >
                  <span className="flex w-full items-center gap-4 whitespace-normal">
                    <Icon name="ride" size={22} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-base font-semibold">Solo Ride</span>
                      <span className={`text-xs font-normal ${tc.sub}`}>
                        Just you. Plan your route and hit the road.
                      </span>
                    </span>
                    <Icon name="arrowRight" size={16} className="opacity-60" />
                  </span>
                </Button>
                {/* GROUP — active */}
                <Button
                  variant={rideType === "group" ? "soft" : "secondary"}
                  size="lg"
                  full
                  onClick={() => {
                    setRideType("group");
                    setSelectedRiders([]);
                    setLoadingFriends(true);
                    getConnectionsFull(user?.id).then(list => {
                      setFriends(list || []);
                      setLoadingFriends(false);
                    }).catch(() => { setFriends([]); setLoadingFriends(false); });
                    setScreen(SCREEN.RIDERS);
                  }}
                  className="!h-auto w-full whitespace-normal py-4 text-left"
                  tc={tc}
                >
                  <span className="flex w-full items-center gap-4 whitespace-normal">
                    <Icon name="riders" size={22} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-base font-semibold">Group Ride</span>
                      <span className={`text-xs font-normal ${tc.sub}`}>
                        Ride with friends. Live map for all members.
                      </span>
                    </span>
                    <Icon name="arrowRight" size={16} className="opacity-60" />
                  </span>
                </Button>
              </div>
            )}

            {/* ================================================
                RIDERS screen — Select friends for group ride
            ================================================ */}
            {screen === SCREEN.RIDERS && (
              <div className="flex flex-col gap-3">
                {/* Header text */}
                <p className={`text-xs ${tc.sub}`}>
                  Choose friends to ride with ({selectedRiders.length} selected)
                </p>

                {/* Loading state */}
                {loadingFriends && (
                  <div className={`py-8 text-center ${tc.sub}`}>
                    <Icon name="spinner" size={24} className="rw-spin mb-2" />
                    <p className="text-[13px]">Loading your friends...</p>
                  </div>
                )}

                {/* No friends state */}
                {!loadingFriends && friends.length === 0 && (
                  <div className={`rounded-xl border px-4 py-8 text-center ${tc.card}`}>
                    <div className="mb-3 flex justify-center">
                      <Icon name="riders" size={28} className={tc.sub} />
                    </div>
                    <p className="mb-2 text-[15px] font-semibold">No Friends Yet</p>
                    <p className={`mb-4 text-xs ${tc.sub}`}>
                      Add friends first to create a group ride
                    </p>
                    <Button
                      variant="primary"
                      icon="userPlus"
                      onClick={() => { onClose(); window.location.href = "/riders"; }}
                      tc={tc}
                    >
                      Go to Riders
                    </Button>
                  </div>
                )}

                {/* Friends list with checkboxes */}
                {!loadingFriends && friends.length > 0 && (
                  <>
                    {/* Select all toggle */}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={selectedRiders.length === friends.length ? "checkbox" : "square"}
                      onClick={() => {
                        if (selectedRiders.length === friends.length) setSelectedRiders([]);
                        else setSelectedRiders(friends.map(f => f.id));
                      }}
                      className="self-start"
                      tc={tc}
                    >
                      {selectedRiders.length === friends.length ? "Deselect All" : "Select All"}
                    </Button>

                    {/* Individual friend cards */}
                    <div className="flex max-h-[280px] flex-col gap-1.5 overflow-y-auto">
                      {friends.map(friend => {
                        const isSelected = selectedRiders.includes(friend.id);
                        return (
                          <Button
                            key={friend.id}
                            variant={isSelected ? "soft" : "ghost"}
                            size="lg"
                            full
                            onClick={() => {
                              setSelectedRiders(prev =>
                                isSelected ? prev.filter(id => id !== friend.id) : [...prev, friend.id]
                              );
                            }}
                            className="!h-auto w-full whitespace-normal py-3 text-left"
                            tc={tc}
                          >
                            <span className="flex w-full items-center gap-3 whitespace-normal">
                              {/* Checkbox */}
                              <Icon
                                name={isSelected ? "checkbox" : "square"}
                                size={18}
                                className={isSelected ? "" : tc.sub}
                              />

                              {/* Avatar */}
                              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${tc.surface2}`}>
                                {(friend.username || friend.email || "?")[0].toUpperCase()}
                              </span>

                              {/* Info */}
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-semibold">
                                  {friend.username || "Rider"}
                                </span>
                                <span className={`truncate text-[11px] ${tc.sub}`}>
                                  {friend.email}
                                </span>
                              </span>
                            </span>
                          </Button>
                        );
                      })}
                    </div>

                    {/* Next button */}
                    <Button
                      variant="primary"
                      size="lg"
                      full
                      icon="arrowRight"
                      iconRight
                      onClick={() => setScreen(SCREEN.SETUP)}
                      disabled={selectedRiders.length === 0}
                      tc={tc}
                    >
                      Continue with {selectedRiders.length} Rider{selectedRiders.length !== 1 ? "s" : ""}
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* ================================================
                SETUP screen — 3-step wizard
            ================================================ */}
            {screen === SCREEN.SETUP && (
              <RideSetupFlow
                rideType={rideType}
                userId={user?.id}
                participantIds={rideType === "group" ? selectedRiders : []}
                onRideCreated={handleRideCreated}
                onCancel={() => setScreen(rideType === "group" ? SCREEN.RIDERS : SCREEN.TYPE)}
                tc={tc}
              />
            )}

          </div>
        </div>
      </div>

      {/* Slide-up animation keyframe */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
