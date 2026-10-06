// ============================================================
// Account — the rider's profile
// Route: /account (protected — requires login + onboarding)
//
// SECTIONS
//   1. Who you are: avatar, name, member since, Edit profile
//   2. Your numbers: rides · km ridden · connections
//   3. Settings (phones only — the desktop sidebar has its own link)
//   4. Profile details: username, mobile, address (editable), email
//   5. Location for "riders near me": share / update / status
//   6. Log out
//
// Saving goes through AuthContext.updateProfile(), which validates on the
// server and returns the server's message when something is wrong
// ("Username is already taken").
// ============================================================

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { useOrgs } from "../context/OrgContext";
import MobileNav from "./components/layout/MobileNav";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import Icon from "./components/ui/Icon";
import Button from "./components/ui/Button";
import { useTheme } from "./hooks/useTheme";
import { getUserRides } from "../services/rideApi";
import { rideRiddenMeters } from "../services/routingApi";
import { getConnectionsFull } from "../services/ridersApi";
import { getCurrentLocation } from "../services/locationService";

// ── One profile field: text when viewing, an input when editing ──
// Defined at module scope on purpose: a component created inside Account()
// would be a new type on every keystroke, and React would remount the
// <input> — dropping focus after each character.
function Field({ icon, label, value, editValue, onChange, editing, type = "text", multiline = false, hint, tc }) {
  const id = `account-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
        <Icon name={icon} size={17} className={tc.sub} />
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className={`block text-xs font-medium ${tc.sub}`}>{label}</label>
        {editing && onChange ? (
          multiline ? (
            <textarea
              id={id}
              value={editValue}
              onChange={(event) => onChange(event.target.value)}
              rows={2}
              maxLength={255}
              className={`mt-1 w-full resize-none rounded-lg border px-3 py-2 text-sm ${tc.input}`}
            />
          ) : (
            <input
              id={id}
              type={type}
              value={editValue}
              onChange={(event) => onChange(event.target.value)}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${tc.input}`}
            />
          )
        ) : (
          <p id={id} className="mt-0.5 break-words text-sm font-medium">
            {value || <span className={tc.sub}>Not set</span>}
          </p>
        )}
        {hint && <p className={`mt-1 text-xs ${tc.sub}`}>{hint}</p>}
      </div>
    </div>
  );
}

// ── One shortcut row (phones: there is no sidebar to reach these from) ──
function Shortcut({ icon, title, text, onClick, tc }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors lg:hidden ${tc.card} ${tc.cardHover}`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
        <Icon name={icon} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className={`block truncate text-xs ${tc.sub}`}>{text}</span>
      </span>
      <Icon name="chevronRight" size={18} className={tc.sub} />
    </button>
  );
}

export default function Account() {
  const { user, avatarLetter, updateProfile, logout, isAdmin } = useAuth();
  const userId = user?.id;
  const { theme, setTheme, tc } = useTheme(userId);
  const navigate = useNavigate();
  const { summary } = useOrgs();
  const canDrive = summary.driving.length > 0 || summary.managed.length > 0;
  const canManage = summary.managed.length > 0;

  // ── Editing ──
  // The form holds its own copy of the fields only WHILE editing; it is
  // filled from the profile at the moment "Edit profile" is pressed.
  const [form, setForm] = useState(null); // null = viewing
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const editing = form !== null;
  const setField = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  // ── Numbers from the server ──
  const [stats, setStats] = useState({ rides: null, km: null, connections: null });
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;

    getUserRides(userId)
      .then((rides) => {
        if (cancelled) return;
        const list = Array.isArray(rides) ? rides : [];
        // What was actually ridden; the planned length only for rides
        // completed before distance tracking existed (see rideRiddenMeters).
        const metres = list.reduce((sum, ride) => sum + rideRiddenMeters(ride), 0);
        setStats((current) => ({ ...current, rides: list.length, km: metres / 1000 }));
      })
      .catch(() => {});

    getConnectionsFull()
      .then((list) => {
        if (!cancelled) setStats((current) => ({ ...current, connections: Array.isArray(list) ? list.length : 0 }));
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [userId]);

  const startEditing = () => {
    setError("");
    setForm({ username: user?.username || "", mobile: user?.mobile || "", address: user?.address || "" });
  };

  const cancelEditing = () => {
    setForm(null);
    setError("");
  };

  const handleSave = async () => {
    const username = form.username.trim();
    const mobile = form.mobile.trim();
    const address = form.address.trim();

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setError("Username must be 3–20 characters — letters, numbers and underscores only.");
      return;
    }
    if (mobile && !/^[+\d][\d\s\-()]{6,18}$/.test(mobile)) {
      setError("Please enter a valid mobile number.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await updateProfile({ username, mobile, address });
      setForm(null);
      toast.success("Profile saved.");
    } catch (err) {
      setError(err.message || "Couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Share (or refresh) the location used by "riders near me".
  const shareLocation = async () => {
    setLocating(true);
    try {
      const here = await getCurrentLocation();
      await updateProfile({ lat: here.lat, lng: here.lng });
      toast.success("Location saved. Riders near you can now find you.");
    } catch (err) {
      toast.error(err.message || "Couldn't get your location.");
    } finally {
      setLocating(false);
    }
  };

  const hasLocation = Number.isFinite(user?.lat) && Number.isFinite(user?.lng);
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString([], { month: "long", year: "numeric" })
    : null;
  const show = (value, format = String) => (value == null ? "—" : format(value));

  const statTiles = [
    { icon: "route",  label: "Rides",       value: show(stats.rides) },
    { icon: "road",   label: "km ridden",   value: show(stats.km, (km) => (km >= 100 ? Math.round(km) : km.toFixed(1))) },
    { icon: "riders", label: "Connections", value: show(stats.connections) },
  ];

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}>
      <Sidebar tc={tc} />
      <TopBar theme={theme} setTheme={setTheme} tc={tc} userId={userId} />
      <MobileNav tc={tc} />

      <main className="px-4 pb-28 pt-24 lg:ml-64 lg:pb-12">
        <div className="mx-auto w-full max-w-2xl space-y-4">

          {/* ── Who you are ───────────────────────────────── */}
          <section className={`flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center ${tc.card}`}>
            <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-xl text-4xl font-bold ${tc.inkTile}`}>
              {avatarLetter}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold tracking-tight">{user?.username || "Rider"}</h1>
              <p className={`truncate text-sm ${tc.sub}`}>{user?.email}</p>
              {memberSince && <p className={`mt-0.5 text-xs ${tc.sub}`}>Riding with RideWise since {memberSince}</p>}
            </div>
            {!editing && (
              <Button id="edit-profile-btn" variant="secondary" icon="edit" tc={tc} onClick={startEditing}>
                Edit profile
              </Button>
            )}
          </section>

          {/* ── Your numbers ──────────────────────────────── */}
          <section aria-label="Your numbers" className="grid grid-cols-3 gap-3">
            {statTiles.map((stat) => (
              <div key={stat.label} className={`rounded-xl border p-4 ${tc.card}`}>
                <Icon name={stat.icon} size={18} className={tc.sub} />
                <p className="mt-3 text-xl font-bold tabular-nums">{stat.value}</p>
                <p className={`mt-0.5 text-xs ${tc.sub}`}>{stat.label}</p>
              </div>
            ))}
          </section>

          {/* ── Settings (phones: there is no sidebar to reach it from) ── */}
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors lg:hidden ${tc.card} ${tc.cardHover}`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
              <Icon name="settings" size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Settings</span>
              <span className={`block truncate text-xs ${tc.sub}`}>Theme, text size, motion and contrast</span>
            </span>
            <Icon name="chevronRight" size={18} className={tc.sub} />
          </button>

          {/* ── Organizations: drive · manage · platform admin (phones) ── */}
          {canDrive && (
            <Shortcut tc={tc} icon="steering" title="Drive" text="Take one of your organization's vehicles out"
              onClick={() => navigate("/driver")} />
          )}
          {canManage && (
            <Shortcut tc={tc} icon="building" title="Manage your organization" text="Vehicles, drivers, live map, trips"
              onClick={() => navigate("/org-admin")} />
          )}
          {isAdmin && (
            <Shortcut tc={tc} icon="shield" title="RideWise admin" text="Users, rides and organizations of the platform"
              onClick={() => navigate("/admin")} />
          )}

          {/* ── Profile details ───────────────────────────── */}
          <section className={`rounded-xl border p-5 ${tc.card}`} aria-labelledby="profile-details-title">
            <h2 id="profile-details-title" className="mb-4 flex items-center gap-2 text-base font-semibold">
              <Icon name="idCard" size={18} className={tc.sub} />
              Profile details
            </h2>

            {error && (
              <div role="alert" className={`mb-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${tc.dangerSoft}`}>
                <Icon name="alertCircle" size={16} className="mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <Field
                icon="at" label="Username" tc={tc} editing={editing}
                value={user?.username ? `@${user.username}` : null}
                editValue={form?.username ?? ""} onChange={setField("username")}
                hint={editing ? "3–20 characters: letters, numbers and underscores." : null}
              />
              <Field icon="mail" label="Email" tc={tc} editing={false} value={user?.email}
                hint={editing ? "Your email is your sign-in and can't be changed here." : null}
              />
              <Field
                icon="phone" label="Mobile" type="tel" tc={tc} editing={editing}
                value={user?.mobile}
                editValue={form?.mobile ?? ""} onChange={setField("mobile")}
              />
              <Field
                icon="city" label="City or address" multiline tc={tc} editing={editing}
                value={user?.address}
                editValue={form?.address ?? ""} onChange={setField("address")}
              />
            </div>

            {editing && (
              <div className="mt-5 flex gap-2">
                <Button variant="ghost" tc={tc} onClick={cancelEditing} disabled={saving}>Cancel</Button>
                <Button variant="primary" icon="check" tc={tc} loading={saving} onClick={handleSave}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            )}
          </section>

          {/* ── Location for "riders near me" ─────────────── */}
          <section className={`rounded-xl border p-5 ${tc.card}`} aria-labelledby="location-title">
            <h2 id="location-title" className="flex items-center gap-2 text-base font-semibold">
              <Icon name="pin" size={18} className={tc.sub} />
              Riders near me
            </h2>
            <p className={`mt-1 text-xs ${tc.sub}`}>
              {hasLocation
                ? "Your location is saved. Riders within 50 km can find you, and only ever see how far away you are."
                : "Share your location once so riders within 50 km can find you. They only ever see a distance, never where you are."}
            </p>
            <div className="mt-3">
              <Button
                variant={hasLocation ? "secondary" : "primary"}
                icon="recenter"
                tc={tc}
                loading={locating}
                onClick={shareLocation}
              >
                {locating ? "Finding you…" : hasLocation ? "Update my location" : "Share my location"}
              </Button>
            </div>
          </section>

          {/* ── Log out ───────────────────────────────────── */}
          <section className={`flex flex-col gap-3 rounded-xl border p-5 sm:flex-row sm:items-center ${tc.card}`}>
            <div className="flex-1">
              <h2 className="text-base font-semibold">Log out</h2>
              <p className={`mt-0.5 text-xs ${tc.sub}`}>
                Your rides and connections stay saved. You can log back in any time.
              </p>
            </div>
            <Button variant="danger" icon="logout" tc={tc} onClick={logout}>
              Log out
            </Button>
          </section>
        </div>
      </main>
    </div>
  );
}
