// ============================================================
// 🔐 AuthContext — Global authentication state manager
//
// CRITICAL FIX:
// - signup now matches the call site: signup(email, password)
//   - Every signup/login also writes to "ridewise-all-accounts"
//     so other users can find them in Riders search & Near Riders
//   - updateProfile merges fields and refreshes the shared list
//   - user.id is ALWAYS set so ridersApi.js can track connections
// ============================================================

import { createContext, useContext, useEffect, useState } from "react";

// Shared list key — readable by ridersApi.js
const ACCOUNTS_LIST_KEY = "ridewise-all-accounts";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

// ── INTERNAL: save/update account in shared list ──
function saveToAccountsList(user) {
 if (!user || !user.email) return;
  const list = JSON.parse(localStorage.getItem(ACCOUNTS_LIST_KEY) || "[]");
  const idx = list.findIndex((u) => u.email === user.email);
  if (idx >= 0) list[idx] = { ...list[idx], ...user };
  else list.push(user);
  localStorage.setItem(ACCOUNTS_LIST_KEY, JSON.stringify(list));
}

// ── INTERNAL: remove account from shared list (on logout/deletion) ──
function removeFromAccountsList(email) {
  if (!email) return;
  const list = JSON.parse(localStorage.getItem(ACCOUNTS_LIST_KEY) || "[]");
  const filtered = list.filter((u) => u.email !== email);
  localStorage.setItem(ACCOUNTS_LIST_KEY, JSON.stringify(filtered));
}

// ── INTERNAL: generate a unique user id ──
function makeUserId() {
  return "u_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

// ── INTERNAL: build a complete user object with all expected fields ──
function makeUser(overrides = {}) {
  return {
    id:        overrides.id        || makeUserId(),
    email:     overrides.email     || "",
    username:  overrides.username  || "",
    mobile:    overrides.mobile    || "",
    address:   overrides.address   || "",
    avatar:    overrides.avatar    || "",
    createdAt: overrides.createdAt || new Date().toISOString(),
    // Optional lat/lng — populated if you add geocoding later
    lat:       overrides.lat       ?? null,
    lng:       overrides.lng       ?? null,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFullyOnboarded, setIsFullyOnboarded] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Restore session on mount ──
  useEffect(() => {
    try {
      const savedUser  = localStorage.getItem("ridewise-user");
      const savedAuth  = localStorage.getItem("ridewise-authenticated");
      const savedBoard = localStorage.getItem("ridewise-onboarded");

      if (savedUser && savedAuth === "true") {
        const parsed = JSON.parse(savedUser);
        // Make sure restored user has an id — backfill if missing
        if (!parsed.id) parsed.id = makeUserId();
        setUser(parsed);
        setIsAuthenticated(true);
        setIsFullyOnboarded(savedBoard === "true" && Boolean(parsed.username));
      }
    } catch (_) {
      localStorage.removeItem("ridewise-user");
      localStorage.removeItem("ridewise-authenticated");
      localStorage.removeItem("ridewise-onboarded");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── SIGNUP ──
  // Called as: signup(email, password) ← matches Login.jsx call site
  const signup = async (email, password) => {
    await new Promise((r) => setTimeout(r, 400));

    if (!email || !password) throw new Error("Email and password are required.");
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");

    const cleanEmail = email.trim().toLowerCase();

    const newUser = makeUser({ email: cleanEmail });

    // 1) Save to per-account record (used for login verification)
    localStorage.setItem(`ridewise-account-${cleanEmail}`, JSON.stringify({
      email: cleanEmail,
      password,
      user: newUser,
    }));

    // 2) Save to SHARED list — so Riders search & Near Riders can see them
    saveToAccountsList(newUser);

    // 3) Set auth state
    localStorage.setItem("ridewise-user", JSON.stringify(newUser));
    localStorage.setItem("ridewise-authenticated", "true");
    localStorage.setItem("ridewise-onboarded", "false");

    setUser(newUser);
    setIsAuthenticated(true);
    setIsFullyOnboarded(false);

 return newUser;
  };

  // ── LOGIN ──
  // Called as: login(email, password)
  const login = async (email, password) => {
    await new Promise((r) => setTimeout(r, 400));

    if (!email || !password) throw new Error("Email and password are required.");

    const cleanEmail = email.trim().toLowerCase();
    const stored = localStorage.getItem(`ridewise-account-${cleanEmail}`);
    if (!stored) throw new Error("No account found with this email.");

    const account = JSON.parse(stored);
    if (account.password !== password) throw new Error("Incorrect password.");

    // Ensure user has id (for accounts created before this fix)
    const restoredUser = account.user || makeUser({ email: cleanEmail });
    if (!restoredUser.id) restoredUser.id = makeUserId();

    // Refresh shared list so newer fields (like username, address) are visible
    saveToAccountsList(restoredUser);

    localStorage.setItem("ridewise-user", JSON.stringify(restoredUser));
    localStorage.setItem("ridewise-authenticated", "true");
    localStorage.setItem("ridewise-onboarded", restoredUser.username ? "true" : "false");

    setUser(restoredUser);
    setIsAuthenticated(true);
    setIsFullyOnboarded(Boolean(restoredUser.username));

    return restoredUser;
  };

  // ── UPDATE PROFILE ──
  // Called as: updateProfile({ username, mobile, address, ... })
  const updateProfile = async (patch) => {
    await new Promise((r) => setTimeout(r, 300));
    if (!user) throw new Error("Not logged in");

    const updated = { ...user, ...patch };

    // Update per-account record
    if (updated.email) {
      const stored = localStorage.getItem(`ridewise-account-${updated.email}`);
      if (stored) {
        const account = JSON.parse(stored);
        account.user = updated;
        localStorage.setItem(`ridewise-account-${updated.email}`, JSON.stringify(account));
      }
    }

    // Update shared list — CRITICAL for Riders feature
    saveToAccountsList(updated);

    // Update active session
    localStorage.setItem("ridewise-user", JSON.stringify(updated));
    setUser(updated);

    // Mark onboarded if username was just set
    if (patch.username && patch.username.trim()) {
      localStorage.setItem("ridewise-onboarded", "true");
      setIsFullyOnboarded(true);
    }

    return updated;
  };

  // ── LOGOUT ──
  // NOTE: We DO NOT remove the account from the shared list —
 // so other users can still find/connect with them.
  const logout = () => {
    // Don't remove from ACCOUNTS_LIST_KEY so they remain searchable
    // removeFromAccountsList(user?.email);  // intentionally disabled

    setUser(null);
    setIsAuthenticated(false);
    setIsFullyOnboarded(false);
    localStorage.removeItem("ridewise-user");
    localStorage.removeItem("ridewise-authenticated");
    localStorage.removeItem("ridewise-onboarded");
  };

  const avatarLetter =
    (user?.username?.[0] || user?.email?.[0] || "R").toUpperCase();

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isFullyOnboarded,
        loading,
        avatarLetter,
        login,
        signup,
        updateProfile,
        logout,
      }}
    >
 {children}
    </AuthContext.Provider>
  );
}