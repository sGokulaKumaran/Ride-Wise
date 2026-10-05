// ============================================================
// Onboarding — three short questions between sign-up and the app
// Route: /onboarding
//
// WHO SEES THIS
//   A rider who is logged in but has no username yet (right after sign-up,
//   or an account that never finished this). Anyone else is sent on:
//   not logged in → the login page; already set up → home.
//
// STEPS
//   1. Username   required — this is what completes onboarding
//   2. Mobile     optional
//   3. Where you ride from — optional city / address, and optionally the
//      device's location so "riders near me" can work from day one
//
// Everything is saved in one request at the end.
// ============================================================

import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "./hooks/useTheme";
import Icon from "./components/ui/Icon";
import Button from "./components/ui/Button";
import { getCurrentLocation } from "../services/locationService";

const TOTAL_STEPS = 3;
const USERNAME = /^[a-zA-Z0-9_]{3,20}$/;
const MOBILE = /^[+\d][\d\s\-()]{6,18}$/;

const STEPS = [
  {
    icon: "at",
    title: "Choose your username",
    subtitle: "This is how other riders find and recognise you.",
  },
  {
    icon: "phone",
    title: "Add your mobile number",
    subtitle: "Optional. Handy when you're organising a group ride.",
  },
  {
    icon: "pin",
    title: "Where do you ride from?",
    subtitle: "Optional. Helps riders near you find you.",
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isFullyOnboarded, loading: authLoading, updateProfile } = useAuth();
  const { tc } = useTheme(user?.id);

  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState(null); // { lat, lng } once shared

  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  // ── Who belongs on this page? ──
  if (authLoading) {
    return (
      <div className={`flex min-h-screen w-full items-center justify-center ${tc.bg} ${tc.text}`}>
        <Icon name="spinner" size={22} className={`rw-spin ${tc.sub}`} />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (isFullyOnboarded) return <Navigate to="/home" replace />;

  const current = STEPS[step - 1];
  const usernameValid = USERNAME.test(username);

  const finish = async (values) => {
    setSaving(true);
    setError("");
    try {
      await updateProfile({
        username,
        ...(values.mobile ? { mobile: values.mobile } : {}),
        ...(values.address ? { address: values.address } : {}),
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      });
      navigate("/home", { replace: true });
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  // "Continue" / "Finish"
  const handleNext = (event) => {
    event?.preventDefault();
    setError("");

    if (step === 1) {
      if (!usernameValid) {
        setError("Use 3–20 characters: letters, numbers and underscores.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (mobile.trim() && !MOBILE.test(mobile.trim())) {
        setError("That doesn't look like a phone number. Fix it, or skip this step.");
        return;
      }
      setStep(3);
    } else {
      finish({ mobile: mobile.trim(), address: address.trim() });
    }
  };

  // "Skip" — leaves this step's answer out
  const handleSkip = () => {
    setError("");
    if (step === 2) { setMobile(""); setStep(3); }
    else finish({ mobile: mobile.trim(), address: "" });
  };

  const handleUseLocation = async () => {
    setLocating(true);
    setError("");
    try {
      const here = await getCurrentLocation();
      setCoords({ lat: here.lat, lng: here.lng });
    } catch (err) {
      setError(err.message || "Couldn't get your location. You can add it later from your account.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className={`flex min-h-screen w-full flex-col items-center justify-center px-4 py-12 ${tc.bg} ${tc.text}`}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <span className={`flex h-10 w-10 items-center justify-center rounded-lg border ${tc.button}`}>
            <Icon name="ride" size={20} />
          </span>
          <span className="text-xl font-bold tracking-tight">
            Ride<span className="opacity-50">Wise</span>
          </span>
        </div>

        {/* Progress */}
        <div className="mb-2 flex gap-2" aria-hidden="true">
          {STEPS.map((_, index) => (
            <span key={index} className={`h-1 flex-1 rounded-full ${index < step ? "bg-current" : tc.hairline}`} />
          ))}
        </div>
        <p className={`mb-5 text-xs font-medium ${tc.sub}`}>Step {step} of {TOTAL_STEPS}</p>

        <form onSubmit={handleNext} className={`rounded-xl border p-6 md:p-8 ${tc.card}`} noValidate>
          <span className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${tc.surface2}`}>
            <Icon name={current.icon} size={22} />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">{current.title}</h1>
          <p className={`mb-6 mt-1 text-sm ${tc.sub}`}>{current.subtitle}</p>

          {error && (
            <div role="alert" className={`mb-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${tc.dangerSoft}`}>
              <Icon name="alertCircle" size={16} className="mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Step 1: username ── */}
          {step === 1 && (
            <div>
              <label htmlFor="onboarding-username" className={`mb-1.5 block text-xs font-medium ${tc.sub}`}>
                Username
              </label>
              <div className="relative">
                <span className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold ${tc.sub}`}>@</span>
                <input
                  id="onboarding-username"
                  type="text"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value.replace(/\s/g, "").slice(0, 20));
                    setError("");
                  }}
                  placeholder="your_handle"
                  autoFocus
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  className={`w-full rounded-lg border py-3 pl-9 pr-10 text-sm ${tc.input}`}
                />
                {username.length >= 3 && (
                  <Icon
                    name={usernameValid ? "checkCircle" : "alertCircle"}
                    size={18}
                    className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${usernameValid ? tc.ok : tc.danger}`}
                  />
                )}
              </div>
              <p className={`mt-1.5 text-xs ${tc.sub}`}>3–20 characters: letters, numbers and underscores.</p>
            </div>
          )}

          {/* ── Step 2: mobile ── */}
          {step === 2 && (
            <div>
              <label htmlFor="onboarding-mobile" className={`mb-1.5 block text-xs font-medium ${tc.sub}`}>
                Mobile number
              </label>
              <div className="relative">
                <Icon name="phone" size={16} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${tc.sub}`} />
                <input
                  id="onboarding-mobile"
                  type="tel"
                  value={mobile}
                  onChange={(event) => { setMobile(event.target.value); setError(""); }}
                  placeholder="+91 98765 43210"
                  autoFocus
                  autoComplete="tel"
                  className={`w-full rounded-lg border py-3 pl-10 pr-4 text-sm ${tc.input}`}
                />
              </div>
            </div>
          )}

          {/* ── Step 3: where from ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="onboarding-address" className={`mb-1.5 block text-xs font-medium ${tc.sub}`}>
                  City or address
                </label>
                <div className="relative">
                  <Icon name="city" size={16} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${tc.sub}`} />
                  <input
                    id="onboarding-address"
                    type="text"
                    value={address}
                    onChange={(event) => { setAddress(event.target.value); setError(""); }}
                    placeholder="e.g. Chennai, Tamil Nadu"
                    autoFocus
                    maxLength={255}
                    autoComplete="address-level2"
                    className={`w-full rounded-lg border py-3 pl-10 pr-4 text-sm ${tc.input}`}
                  />
                </div>
              </div>

              <div className={`rounded-lg border p-3.5 ${tc.record}`}>
                <p className="text-sm font-semibold">Find riders near you</p>
                <p className={`mt-0.5 text-xs ${tc.sub}`}>
                  Share your location once. Other riders only see how far away you are — never where you are.
                </p>
                <div className="mt-3">
                  {coords ? (
                    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${tc.ok}`}>
                      <Icon name="checkCircle" size={17} />
                      Location added
                    </span>
                  ) : (
                    <Button type="button" variant="secondary" size="sm" icon="recenter" tc={tc} loading={locating} onClick={handleUseLocation}>
                      {locating ? "Finding you…" : "Use my location"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Actions ── */}
          <div className="mt-7 flex gap-2">
            {step > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                icon="arrowLeft"
                iconOnly
                title="Back"
                tc={tc}
                disabled={saving}
                onClick={() => { setStep(step - 1); setError(""); }}
              />
            )}
            {step > 1 && (
              <Button type="button" variant="secondary" size="lg" tc={tc} disabled={saving} onClick={handleSkip}>
                Skip
              </Button>
            )}
            <Button
              id="onboarding-next-btn"
              type="submit"
              variant="primary"
              size="lg"
              full
              tc={tc}
              icon={step < TOTAL_STEPS ? "arrowRight" : "check"}
              iconRight
              loading={saving}
              disabled={step === 1 && !username}
            >
              {saving ? "Saving…" : step < TOTAL_STEPS ? "Continue" : "Finish"}
            </Button>
          </div>
        </form>

        <p className={`mt-4 text-center text-xs ${tc.sub}`}>
          You can change all of this later from your account.
        </p>
      </div>
    </div>
  );
}
