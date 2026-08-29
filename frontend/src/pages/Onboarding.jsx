// ============================================================
// 📋 Onboarding — Profile details page (between signup and home)
// Route: /onboarding
//
// WHO SEES THIS:
//   - New users right after signup (before they can access /home)
//   - Users who logged in but never completed onboarding
//
// STEPS:
//   Step 1: Username (@handle) — required; this is what marks "onboarded"
//   Step 2: Mobile number      — optional but encouraged
//   Step 3: Address / city     — optional but encouraged
//
// FLOW:
//   After step 3 → calls updateProfile() from AuthContext →
//   AuthContext sets isFullyOnboarded=true → navigate("/home")
//
// BACKEND-READY:
//   updateProfile() in AuthContext does the save.
//   When you add a backend, just replace that function's body with an API call.
//   This page doesn't need to change.
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "./hooks/useTheme";

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const { theme, tc } = useTheme(); // use the same theme system as the rest of the app

  // ── Which step we're on (1, 2, or 3) ────────────────────────
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 3;

  // ── Form field values ────────────────────────────────────────
  const [username, setUsername] = useState("");
  const [mobile,   setMobile]   = useState("");
  const [address,  setAddress]  = useState("");

  // ── UI state ─────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // ── Username validation (no spaces, only letters/numbers/_) ──
  const isValidUsername = /^[a-zA-Z0-9_]{3,20}$/.test(username);

  // ── Step metadata: icon, title, subtitle ────────────────────
  const steps = [
    {
      icon: "fa-at",
      title: "Choose your username",
      subtitle: "This is your unique @handle on RideWise. 3–20 chars, letters/numbers/underscore.",
      field: (
        <div>
          <label className={`text-xs font-bold tracking-wider mb-2 block ${tc.sub}`}>
            USERNAME
          </label>
          <div className="relative">
            {/* @ prefix */}
            <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-bold text-orange-400`}>
              @
            </span>
            <input
              type="text"
              id="onboarding-username"
              value={username}
              onChange={(e) => {
                // Strip spaces and limit to 20 chars
                setUsername(e.target.value.replace(/\s/g, "").slice(0, 20));
                setError("");
              }}
              placeholder="your_handle"
              autoFocus
              className={`w-full pl-10 pr-4 py-4 rounded-xl border-2 outline-none transition-all duration-300 focus:scale-[1.01] ${tc.input}`}
            />
            {/* Live validation tick */}
            {username.length >= 3 && (
              <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-sm ${
                isValidUsername ? "text-green-400" : "text-red-400"
              }`}>
                <i className={`fa ${isValidUsername ? "fa-check-circle" : "fa-times-circle"}`} />
              </span>
            )}
          </div>
          {/* Preview */}
          {username && (
            <div className={`mt-3 px-4 py-2.5 rounded-xl border flex items-center gap-3 ${tc.card}`}>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center font-bold text-white text-sm">
                {username.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-sm">@{username}</p>
                <p className={`text-xs ${tc.sub}`}>{user?.email}</p>
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      icon: "fa-mobile-alt",
      title: "What's your mobile number?",
      subtitle: "Used for ride coordination. Other riders can contact you for group rides.",
      field: (
        <div>
          <label className={`text-xs font-bold tracking-wider mb-2 block ${tc.sub}`}>
            MOBILE NUMBER
          </label>
          <div className="relative">
            <i className={`fa fa-phone absolute left-4 top-1/2 -translate-y-1/2 ${tc.sub}`} />
            <input
              type="tel"
              id="onboarding-mobile"
              value={mobile}
              onChange={(e) => { setMobile(e.target.value); setError(""); }}
              placeholder="+91 98765 43210"
              autoFocus
              className={`w-full pl-12 pr-4 py-4 rounded-xl border-2 outline-none transition-all duration-300 focus:scale-[1.01] ${tc.input}`}
            />
          </div>
        </div>
      ),
    },
    {
      icon: "fa-map-marker-alt",
      title: "Where are you based?",
      subtitle: "We'll show you riders and routes near you. City or full address — your choice.",
      field: (
        <div>
          <label className={`text-xs font-bold tracking-wider mb-2 block ${tc.sub}`}>
            CITY / ADDRESS
          </label>
          <div className="relative">
            <i className={`fa fa-location-dot absolute left-4 top-4 ${tc.sub}`} />
            <textarea
              id="onboarding-address"
              value={address}
              onChange={(e) => { setAddress(e.target.value); setError(""); }}
              placeholder="e.g. Chennai, Tamil Nadu"
              rows={3}
              autoFocus
              className={`w-full pl-12 pr-4 py-3.5 rounded-xl border-2 outline-none transition-all duration-300 resize-none focus:scale-[1.01] ${tc.input}`}
            />
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[step - 1]; // zero-indexed

  // ── Handle Next / Finish ─────────────────────────────────────
  const handleNext = async () => {
    setError("");

    // Validate step 1 (username is required)
    if (step === 1) {
      if (!username) { setError("Username is required."); return; }
      if (!isValidUsername) {
        setError("Username must be 3–20 chars: letters, numbers, underscores only.");
        return;
      }
    }

    // Steps 2 and 3 are optional — skip button handles them too

    if (step < TOTAL_STEPS) {
      // Just move to the next step
      setStep(step + 1);
    } else {
      // Step 3: save everything and go to home
      setLoading(true);
      try {
        await updateProfile({ username, mobile, address });
        navigate("/home");
      } catch (err) {
        setError(err.message || "Something went wrong. Please try again.");
        setLoading(false);
      }
    }
  };

  // ── Skip optional steps (2 and 3) ────────────────────────────
  const handleSkip = async () => {
    setError("");
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      // Last step: save whatever we have and proceed
      setLoading(true);
      try {
        await updateProfile({ username, mobile, address });
        navigate("/home");
      } catch (err) {
        setError(err.message || "Something went wrong. Please try again.");
        setLoading(false);
      }
    }
  };

  return (
    <div className={`min-h-screen w-full flex flex-col items-center justify-center px-4 py-12 transition-all duration-500 ${tc.bg} ${tc.text}`}>

      {/* ── Background glow ──────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-br from-orange-500/10 via-transparent to-pink-500/10" />

      <div className="relative z-10 w-full max-w-lg">

        {/* ── Logo ──────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <i className="fa fa-motorcycle text-white text-sm" />
          </div>
          <span className="text-xl font-black">
            Ride<span className="opacity-60">Wise</span>
          </span>
        </div>

        {/* ── Progress indicator ─────────────────────────────── */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-500 flex-1 ${
                s <= step
                  ? "bg-gradient-to-r from-orange-500 to-pink-500"
                  : theme === "light" ? "bg-black/10" : "bg-white/10"
              }`}
            />
          ))}
        </div>
        
        {/* Step count label */}
        <p className={`text-xs font-bold tracking-widest mb-2 ${tc.sub}`}>
          STEP {step} OF {TOTAL_STEPS}
        </p>

        {/* ── Card ──────────────────────────────────────────── */}
        <div className={`rounded-3xl border p-8 md:p-10 backdrop-blur-xl transition-all duration-500 ${tc.card}`}>

          {/* Step icon */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 flex items-center justify-center mb-5">
            <i className={`fa ${currentStep.icon} text-xl text-orange-400`} />
          </div>

          {/* Title + subtitle */}
          <h1 className="text-2xl md:text-3xl font-black mb-2">{currentStep.title}</h1>
          <p className={`text-sm mb-7 leading-relaxed ${tc.sub}`}>{currentStep.subtitle}</p>

          {/* Error message */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
              <i className="fa fa-exclamation-circle shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Dynamic form field for current step */}
          {currentStep.field}

          {/* ── Action buttons ──────────────────────────────── */}
          <div className="flex gap-3 mt-7">

            {/* Skip (step 2 and 3 only — step 1 username is required) */}
            {step > 1 && (
              <button
                onClick={handleSkip}
                disabled={loading}
                className={`flex-1 py-3.5 rounded-xl font-semibold border transition-all hover:scale-[1.02] ${tc.card}`}
              >
                Skip for now
              </button>
            )}

            {/* Next / Finish */}
            <button
              id="onboarding-next-btn"
              onClick={handleNext}
              disabled={loading || (step === 1 && !username)}
              className="flex-1 py-3.5 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg shadow-orange-500/30"
            >
              {loading ? (
                <><i className="fa fa-spinner fa-spin mr-2" />Saving…</>
              ) : step < TOTAL_STEPS ? (
                <>Continue <i className="fa fa-arrow-right ml-1" /></>
              ) : (
                <>Finish setup <i className="fa fa-check ml-1" /></>
              )}
            </button>
          </div>
        </div>

        {/* ── Step dots (visual indicator) ────────────────────── */}
        <div className="flex justify-center gap-2 mt-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                s === step
                  ? "bg-orange-500 scale-125"
                  : s < step
                    ? "bg-orange-500/50"
                    : "bg-white/20"
              }`}
            />
          ))}
        </div>

        <p className={`text-center text-xs mt-4 ${tc.sub}`}>
          You can update all this later from your profile.
        </p>
      </div>
    </div>
  );
}
