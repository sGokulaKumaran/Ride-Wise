// ============================================================
// 🏁 StartRideModal — 3-step modal for starting a ride
// Triggered by the "Start a Ride" button on the Home dashboard.
//
// STEPS:
//   1. Where are you starting? (from location / current location)
//   2. Where are you going?    (destination search)
//   3. Ride type               (Public = others can join, Private = solo/invite)
//      → "Let's Ride!" button
//
// BACKEND-READY:
//   The "Let's Ride" button currently just closes the modal and shows a toast.
//   When backend is ready:
//     - POST /api/rides/start with { from, destination, type }
//     - Navigate to the active ride page
// ============================================================

import { useState, useEffect } from "react";

export default function StartRideModal({ open, onClose, tc }) {
  // ── Which step we're on ──────────────────────────────────────
  const [step,        setStep]        = useState(1);
  const TOTAL_STEPS = 3;

  // ── Form values ──────────────────────────────────────────────
  const [from,        setFrom]        = useState("");
  const [destination, setDestination] = useState("");
  const [rideType,    setRideType]    = useState("public"); // "public" | "private"

  // ── UI state ─────────────────────────────────────────────────
  const [useCurrentLoc, setUseCurrentLoc] = useState(false);
  const [done,          setDone]          = useState(false); // shows success state

  // ── Reset when modal closes ──────────────────────────────────
  useEffect(() => {
    if (!open) {
      // Small delay so reset doesn't flash during the close animation
      const t = setTimeout(() => {
        setStep(1);
        setFrom("");
        setDestination("");
        setRideType("public");
        setUseCurrentLoc(false);
        setDone(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ── Close on Escape key ──────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // ── Handle "Use Current Location" ────────────────────────────
  const handleCurrentLocation = () => {
    setUseCurrentLoc(true);
    setFrom("📍 Current Location");
    // TODO: replace with: navigator.geolocation.getCurrentPosition(...)
  };

  // ── Handle "Let's Ride!" ─────────────────────────────────────
  const handleStartRide = () => {
    // TODO: await api.post('/api/rides/start', { from, destination, rideType })
    setDone(true);
    // Auto-close after showing success
    setTimeout(() => onClose(), 2000);
  };

  // ── Step content definitions ──────────────────────────────────
  const stepsContent = [
    {
      icon: "fa-location-dot",
      title: "Where are you starting?",
      content: (
        <div className="space-y-3">
          {/* Current location button */}
          <button
            onClick={handleCurrentLocation}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all hover:scale-[1.01] font-semibold text-sm ${
              useCurrentLoc
                ? "border-orange-500 bg-orange-500/10 text-orange-400"
                : `${tc.card} hover:border-orange-500/50`
            }`}
          >
            <i className={`fa fa-crosshairs ${useCurrentLoc ? "text-orange-400" : tc.sub}`} />
            <span className="flex-1 text-left">
              {useCurrentLoc ? "📍 Using current location" : "Use my current location"}
            </span>
            {useCurrentLoc && <i className="fa fa-check text-green-400" />}
          </button>

          {/* Or type a location */}
          <div className={`flex items-center gap-3 text-xs ${tc.sub}`}>
            <div className={`flex-1 h-px ${tc.divider}`} />
            <span>or type a location</span>
            <div className={`flex-1 h-px ${tc.divider}`} />
          </div>

          <div className="relative">
            <i className={`fa fa-map-marker absolute left-4 top-1/2 -translate-y-1/2 ${tc.sub}`} />
            <input
              type="text"
              value={useCurrentLoc ? "" : from}
              onChange={(e) => { setFrom(e.target.value); setUseCurrentLoc(false); }}
              placeholder="e.g. Chennai Central"
              className={`w-full pl-12 pr-4 py-3.5 rounded-xl border-2 outline-none transition-all duration-200 focus:scale-[1.01] ${tc.input}`}
            />
          </div>
        </div>
      ),
      canNext: useCurrentLoc || from.trim().length > 0,
    },
    {
      icon: "fa-flag-checkered",
      title: "Where are you headed?",
      content: (
        <div className="relative">
          <i className={`fa fa-search absolute left-4 top-1/2 -translate-y-1/2 ${tc.sub}`} />
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. Pondicherry, Ooty, Coorg…"
            autoFocus
            className={`w-full pl-12 pr-4 py-3.5 rounded-xl border-2 outline-none transition-all duration-200 focus:scale-[1.01] ${tc.input}`}
          />
          {/* Quick destination suggestions */}
          <div className="mt-3 flex flex-wrap gap-2">
            {["Pondicherry", "Ooty", "Coorg", "Goa", "Manali"].map((place) => (
              <button
                key={place}
                onClick={() => setDestination(place)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all hover:scale-105 ${
                  destination === place
                    ? "bg-orange-500 text-white border-orange-500"
                    : `${tc.card} hover:border-orange-500/40`
                }`}
              >
                {place}
              </button>
            ))}
          </div>
        </div>
      ),
      canNext: destination.trim().length > 0,
    },
    {
      icon: "fa-users",
      title: "What kind of ride?",
      content: (
        <div className="space-y-3">
          {/* Public ride */}
          <button
            onClick={() => setRideType("public")}
            className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all hover:scale-[1.01] text-left ${
              rideType === "public"
                ? "border-orange-500 bg-orange-500/10"
                : `${tc.card} hover:border-orange-500/40`
            }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              rideType === "public" ? "bg-orange-500 text-white" : `${tc.record}`
            }`}>
              <i className="fa fa-globe text-sm" />
            </div>
            <div>
              <p className="font-bold">Public Ride</p>
              <p className={`text-xs mt-0.5 ${tc.sub}`}>
                Nearby riders can see and join your ride. Great for meeting new people!
              </p>
            </div>
            {rideType === "public" && (
              <i className="fa fa-check-circle text-orange-400 ml-auto shrink-0 mt-1" />
            )}
          </button>

          {/* Private ride */}
          <button
            onClick={() => setRideType("private")}
            className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all hover:scale-[1.01] text-left ${
              rideType === "private"
                ? "border-purple-500 bg-purple-500/10"
                : `${tc.card} hover:border-purple-500/40`
            }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              rideType === "private" ? "bg-purple-500 text-white" : `${tc.record}`
            }`}>
              <i className="fa fa-lock text-sm" />
            </div>
            <div>
              <p className="font-bold">Private Ride</p>
              <p className={`text-xs mt-0.5 ${tc.sub}`}>
                Solo or invite-only. Only people you invite can see your route.
              </p>
            </div>
            {rideType === "private" && (
              <i className="fa fa-check-circle text-purple-400 ml-auto shrink-0 mt-1" />
            )}
          </button>
        </div>
      ),
      canNext: true, // always valid
    },
  ];

  const current = stepsContent[step - 1];

  // ── Don't render at all if not open ─────────────────────────
  if (!open) return null;

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────── */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* ── Modal panel ─────────────────────────────────────── */}
        <div className={`w-full max-w-md rounded-3xl border shadow-2xl shadow-black/60 overflow-hidden ${tc.card}`}>

          {/* ── Header ──────────────────────────────────────── */}
          <div className={`flex items-center justify-between px-6 pt-6 pb-4 border-b ${tc.divider}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
                <i className={`fa ${current.icon} text-white text-sm`} />
              </div>
              <div>
                <p className={`text-xs font-bold tracking-widest ${tc.sub}`}>
                  START A RIDE · STEP {step} OF {TOTAL_STEPS}
                </p>
                <h2 className="font-black text-base">{current.title}</h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 ${tc.record} ${tc.sub}`}
            >
              <i className="fa fa-times text-xs" />
            </button>
          </div>

          {/* ── Progress bar ──────────────────────────────────── */}
          <div className="h-1 bg-white/5">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-pink-500 transition-all duration-500"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>

          {/* ── Step content ──────────────────────────────────── */}
          <div className="p-6">

            {/* Success state */}
            {done ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                  <i className="fa fa-check text-2xl text-green-400" />
                </div>
                <h3 className="text-xl font-black mb-2">Ride started! 🏍️</h3>
                <p className={`text-sm ${tc.sub}`}>
                  {from} → {destination}
                </p>
              </div>
            ) : (
              current.content
            )}
          </div>

          {/* ── Footer: Back + Next/Start ─────────────────────── */}
          {!done && (
            <div className={`flex gap-3 px-6 pb-6`}>
              {/* Back button (not on step 1) */}
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className={`px-5 py-3 rounded-xl font-semibold border transition-all hover:scale-[1.02] ${tc.card}`}
                >
                  <i className="fa fa-arrow-left mr-1" /> Back
                </button>
              )}

              {/* Next or Start */}
              {step < TOTAL_STEPS ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!current.canNext}
                  className="flex-1 py-3 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 bg-gradient-to-r from-orange-500 to-pink-500 text-white"
                >
                  Next <i className="fa fa-arrow-right ml-1" />
                </button>
              ) : (
                <button
                  onClick={handleStartRide}
                  className="flex-1 py-3 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-95 bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg shadow-orange-500/30"
                >
                  <i className="fa fa-motorcycle mr-2" />
                  Let's Ride!
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
