// ============================================================
// 👤 Account — User profile page
// Route: /account (protected — requires login + onboarding)
//
// SECTIONS:
//   1. Cover banner (gradient)
//   2. Avatar + username + join date (overlaps the cover)
//   3. Edit Profile / Save / Cancel buttons
//   4. Stats row: Rides · Followers · Following
//   5. Profile details card (editable: username, mobile, address; read-only: email)
//   6. Account actions: Log out
//
// EDIT MODE:
//   Clicking "Edit Profile" switches text fields to inputs.
//   Clicking "Save" calls updateProfile() from AuthContext.
//   Clicking "Cancel" reverts all local edits.
//
// BACKEND-READY:
//   updateProfile() in AuthContext does the save.
//   When backend is ready, replace that function's body with an API call.
//   This page doesn't need to change.
// ============================================================

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import MobileNav from "./components/layout/MobileNav";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import { useTheme } from "./hooks/useTheme";
import { toast } from "react-toastify";
import { getUserRides } from "../services/rideApi";
import { getConnectionsFull } from "../services/ridersApi";

// ============================================================
// 📝 Field — Reusable editable text field component
// ============================================================
//
// WHY THIS LIVES OUTSIDE Account():
// ─────────────────────────────────
// In the previous version, this component was defined INSIDE the
// Account() function. That meant every time Account() re-rendered
// (which happens on every keystroke, because setUsername etc. are
// called), a BRAND NEW Field function was created. To React, that
// looks like a completely different component type — so React
// unmounts the old <input> and mounts a new one. The browser drops
// focus and resets the cursor position → you can only type ONE
// character at a time.
//
// By moving Field to module scope, it has a stable identity across
// renders. React reconciles it as the SAME component, keeps the
// <input> mounted, and preserves focus + cursor position while// typing. ✅
//
// PROPS:
//   label — uppercase label shown above the field
//   value      — display value when NOT editing
//   editValue  — controlled value of the input/textarea
//   onChange   — stable setter (e.g. setUsername) from the parent
//   editing — whether the input is shown (true) or plain text (false)
//   type       — input type: "text", "tel", "email", etc.
//   multiline  — if true, render a <textarea> instead of <input>
//   tc — theme class object (for colors)
// ============================================================
function Field({ label, value, editValue, onChange, editing, type = "text", multiline = false, tc }) {
  return (
    <div>
      {/* Field label */}
      <label className={`text-xs font-bold tracking-wider mb-1.5 block ${tc.sub}`}>
        {label}
      </label>

      {/* Edit mode → show input / textarea  |  View mode → show plain text */}
      {editing ? (
        multiline ? (
          <textarea
            value={editValue}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className={`w-full px-4 py-3 rounded-xl border-2 outline-none focus:ring-2 focus:ring-orange-500/30 resize-none transition-all ${tc.input}`}
          />
        ) : (
          <input
            type={type}
            value={editValue}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border-2 outline-none focus:ring-2 focus:ring-orange-500/30 transition-all ${tc.input}`}
          />
        )
      ) : (
        <p className="font-semibold">
          {value || <span className={`italic ${tc.sub}`}>Not set</span>}
        </p>
      )}
    </div>
  );
}

export default function Account() {
  const { user, avatarLetter, updateProfile, logout } = useAuth();
  const { theme, setTheme, tc } = useTheme(user?.id);

  // ── Edit mode state ──────────────────────────────────────────
  const [editing, setEditing] = useState(false);

  // Local editable copies of profile fields
  const [username, setUsername] = useState(user?.username || "");
  const [mobile,   setMobile]   = useState(user?.mobile   || "");
  const [address,  setAddress]  = useState(user?.address  || "");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  // ── FIX: Re-sync local state whenever user object updates ────
  // Without this, when AuthContext restores the user from localStorage
  // AFTER this component mounts, our local form fields stay empty
  // and the user can't type anything.
  useEffect(() => {
    setUsername(user?.username || "");
    setMobile(user?.mobile     || "");
    setAddress(user?.address || "");
  }, [user]);

  // ── Live stats: real rides + connections from the backend ──────
  const [rideCount,       setRideCount]       = useState(0);
  const [distanceKm,      setDistanceKm]      = useState("0.0");
  const [connectionCount, setConnectionCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    getUserRides(user.id)
      .then((rides) => {
        const list = Array.isArray(rides) ? rides : [];
        setRideCount(list.length);
        const totalM = list.reduce((s, r) => s + (r.distanceMeters || 0), 0);
        setDistanceKm((totalM / 1000).toFixed(1));
      })
      .catch(() => {});
    getConnectionsFull(user.id)
      .then((list) => setConnectionCount(Array.isArray(list) ? list.length : 0))
      .catch(() => {});
  }, [user?.id]);

  // ── Save changes ─────────────────────────────────────────────
  const handleSave = async () => {
    if (!username.trim()) {
      setError("Username cannot be empty.");
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
      setError("Username must be 3–20 characters — letters, numbers and underscores only.");
      return;
    }
    if (mobile.trim() && !/^[+\d][\d\s\-()]{6,18}$/.test(mobile.trim())) {
      setError("Please enter a valid mobile number.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateProfile({ username: username.trim(), mobile: mobile.trim(), address: address.trim() });
      setEditing(false);
      toast.success("Profile saved");
    } catch (err) {
      setError(err.message || "Failed to save. Please try again.");
      toast.error(err.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Cancel — revert local edits to current user data ─────────
  const handleCancel = () => {
    setUsername(user?.username || "");
    setMobile(user?.mobile || "");
    setAddress(user?.address   || "");
    setError("");
    setEditing(false);
  };

  // ── Mock stats (replace with API data later) ─────────────────
  // Live stats from the backend (rides + connections)
  const stats = [
    { label: "Rides",       value: String(rideCount),       icon: "fa-motorcycle" },
    { label: "Km ridden",   value: distanceKm,              icon: "fa-route"      },
    { label: "Connections", value: String(connectionCount), icon: "fa-users"      },
  ];

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}>
      <Sidebar tc={tc} />
      <TopBar theme={theme} setTheme={setTheme} tc={tc} userId={user?.id} />
      <MobileNav tc={tc} />

      <main className="lg:ml-64 pt-20 px-4 pb-28 lg:pb-8">
        <div className="max-w-3xl mx-auto">

          {/* ── Cover banner ──────────────────────────────────── */}
          <div className="relative h-44 md:h-56 rounded-3xl overflow-hidden mb-16">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600" />
            {/* Decorative pattern overlay */}
            <div className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
          </div>

          {/* ── Avatar + name (overlaps the cover) ────────────── */}
          <div className="px-4 -mt-16 mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              {/* Large avatar circle */}
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-3xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center font-black text-white text-5xl ring-4 ring-black/50 shadow-2xl">
                {avatarLetter}
              </div>

              <div className="md:pb-2">
                <h1 className="text-3xl md:text-4xl font-black">
                  {user?.username || "Rider"}
                </h1>
                <p className={`text-sm ${tc.sub}`}>
                  @{user?.username || "you"} · Member since{" "}
                  {new Date(user?.createdAt || Date.now()).toLocaleDateString("en", {
                    month: "long",
                    year:  "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* Edit / Save / Cancel buttons */}
            <div className="flex gap-2 md:pb-2">
              {!editing ? (
                <button
                  id="edit-profile-btn"
                  onClick={() => setEditing(true)}
                  className={`px-5 py-2.5 rounded-full font-bold transition-all hover:scale-105 ${tc.button}`}
                >
                  <i className="fa fa-pen mr-2" />
                  Edit Profile
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancel}
                    className={`px-5 py-2.5 rounded-full font-bold border transition-all hover:scale-105 ${tc.card}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`px-5 py-2.5 rounded-full font-bold transition-all hover:scale-105 disabled:opacity-50 bg-gradient-to-r from-orange-500 to-pink-500 text-white`}
                  >
                    {saving
                      ? <><i className="fa fa-spinner fa-spin mr-2" />Saving…</>
                      : <><i className="fa fa-check mr-2" />Save</>
                    }
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Error message (edit mode) */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
              <i className="fa fa-exclamation-circle" /> {error}
            </div>
          )}

          {/* ── Stats row ────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {stats.map((s) => (
              <div
                key={s.label}
                className={`rounded-2xl border p-4 text-center transition-all hover:scale-[1.02] ${tc.card}`}
              >
                <i className={`fa ${s.icon} text-xl text-orange-400 mb-1.5 block`} />
                <p className="text-2xl font-black">{s.value}</p>
                <p className={`text-xs ${tc.sub}`}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* ── Profile details card ─────────────────────────── */}
          <div className={`rounded-2xl border p-6 mb-4 ${tc.card}`}>
            <h2 className="text-lg font-black mb-5 flex items-center gap-2">
              <i className="fa fa-id-card text-orange-400" />
              Profile details
            </h2>

            <div className="space-y-5">

              {/* Username (editable) — setUsername is a stable React setter */}
              <Field
                label="USERNAME"
                value={user?.username ? `@${user.username}` : null}
                editValue={username}
                onChange={setUsername}
                editing={editing}
                tc={tc}
              />

              {/* Email (read-only — set at signup, changed via backend later) */}
              <div>
                <label className={`text-xs font-bold tracking-wider mb-1.5 block ${tc.sub}`}>
                  EMAIL <span className="text-orange-400/70 font-normal">(read-only)</span>
                </label>
                <p className="font-semibold">{user?.email || "—"}</p>
              </div>

              {/* Mobile (editable) */}
              <Field
                label="MOBILE"
                value={user?.mobile}
                editValue={mobile}
                onChange={setMobile}
                editing={editing}
                type="tel"
                tc={tc}
              />

              {/* Address (editable, multiline) */}
              <Field
                label="CITY / ADDRESS"
                value={user?.address}
                editValue={address}
                onChange={setAddress}
                editing={editing}
                multiline
                tc={tc}
              />
            </div>
          </div>

          {/* ── Account actions (danger zone) ─────────────────── */}
          <div className={`rounded-2xl border p-6 ${tc.card}`}>
            <h2 className="text-lg font-black mb-1 flex items-center gap-2">
              <i className="fa fa-shield-halved text-orange-400" />
              Account actions
            </h2>
            <p className={`text-xs ${tc.sub} mb-4`}>
              Logging out keeps all your data saved. You can log back in any time.
            </p>
            <button
              onClick={logout}
              className="px-5 py-2.5 rounded-full font-bold bg-red-500/15 text-red-400 border border-red-500/30 transition-all hover:scale-105 hover:bg-red-500/25"
            >
              <i className="fa fa-right-from-bracket mr-2" />
              Log out
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}