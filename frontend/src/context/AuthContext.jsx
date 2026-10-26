// ============================================================
// AuthContext — who is logged in, for the whole app
//
// BACKEND
//   signup         POST  /api/auth/signup
//   login          POST  /api/auth/login
//   restore        GET   /api/auth/me        (on app load)
//   updateProfile  PATCH /api/auth/profile/{userId}
//   changeEmail    PATCH /api/auth/email                  (services/accountApi)
//   deleteAccount  POST  /api/auth/account/delete         (services/accountApi)
//   logout         POST  /api/auth/logout
//
// THE SESSION lives on the server (an HttpOnly cookie the browser sends
// by itself). localStorage only keeps a copy of the user object so the
// app can start while the server is waking up.
//
// "REMEMBER ME"
//   ticked   → localStorage "ridewise-remember-me": a new browser session
//              restores the login
//   unticked → only sessionStorage marks the tab as logged in, so closing
//              the browser ends the login on this device
//
// SESSION LOST WHILE USING THE APP
//   Any API call that comes back 401 (session expired, or the account
//   was suspended) raises AUTH_EXPIRED_EVENT. This provider clears the
//   login and the route guards send the rider to the login page —
//   instead of leaving them on a page where every request fails silently.
// ============================================================

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AUTH_EXPIRED_EVENT, apiFetch, apiJson, isOffline, jsonBody } from "../services/http";
import { setCacheOwner } from "../services/pageCache";
import { changeEmail as changeAccountEmail, deleteAccount as deleteAccountOnServer } from "../services/accountApi";

const AuthContext = createContext(null);

// ── Custom hook used by every component that needs auth ──
// (the provider and its hook belong together in this file)
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

const SESSION_EXPIRED_FLAG = "ridewise-session-expired";

function rememberUser(user) {
  localStorage.setItem("ridewise-user", JSON.stringify(user));
  localStorage.setItem("ridewise-authenticated", "true");
  localStorage.setItem("ridewise-onboarded", user?.username ? "true" : "false");
}

function forgetUser() {
  localStorage.removeItem("ridewise-user");
  localStorage.removeItem("ridewise-authenticated");
  localStorage.removeItem("ridewise-onboarded");
  sessionStorage.removeItem("ridewise-session-active");
}

function cachedUser() {
  try {
    const user = JSON.parse(localStorage.getItem("ridewise-user") || "null");
    return user && user.id != null ? user : null;
  } catch {
    return null;
  }
}

// Ride data cached for offline use belongs to the account that created
// it — it must not be left behind for the next person on this device.
function clearRideCaches() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (
        key &&
        (key === "ridewise-rides-local" ||
          key === "ridewise-pending-ends" ||
          key.startsWith("ridewise-ride-") ||
          key.startsWith("ridewise-nav-"))
      ) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // storage unavailable
  }
}

// Is there a login worth restoring? "Remember me", or a browser session
// that is still open.
function hasRestorableLogin() {
  try {
    return (
      localStorage.getItem("ridewise-remember-me") === "true" ||
      sessionStorage.getItem("ridewise-session-active") === "true"
    );
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [user,            setUser]            = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // "loading" = still asking the server who is logged in. When there is
  // nothing to restore, the app can show the login page straight away.
  const [loading,         setLoading]         = useState(hasRestorableLogin);

  const isFullyOnboarded = Boolean(user?.username);

  const applyUser = useCallback((next) => {
    rememberUser(next);
    setCacheOwner(next?.id); // another account → its screens' cached data goes
    sessionStorage.setItem("ridewise-session-active", "true");
    setUser(next);
    setIsAuthenticated(true);
  }, []);

  const clearUser = useCallback(() => {
    forgetUser();
    setCacheOwner(null); // signed out → nothing cached may outlive the session
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  // ── RESTORE THE SESSION ON APP LOAD ──
  useEffect(() => {
    let cancelled = false;

    // Neither "Remember me" nor an open browser session → login required.
    // Only stale leftovers need removing; the state already says "signed out".
    if (!hasRestorableLogin()) {
      forgetUser();
      return undefined;
    }

    const restore = async () => {
      try {
        const serverUser = await apiJson("/api/auth/me");
        if (!cancelled) applyUser(serverUser);
      } catch (err) {
        if (cancelled) return;
        // The server could not be REACHED (asleep / no network): start with
        // the saved copy of the user. Ride data falls back to its local
        // cache, and a real "not logged in" answer later still signs out.
        const saved = isOffline(err) ? cachedUser() : null;
        if (saved) {
          setUser(saved);
          setIsAuthenticated(true);
        } else {
          // The server answered "not logged in" although this browser
          // remembered a login: the session ran out, or was ended. The
          // login page says so instead of appearing without a word.
          if (err?.status === 401 && cachedUser()) {
            try { sessionStorage.setItem(SESSION_EXPIRED_FLAG, "true"); } catch { /* ignore */ }
          }
          clearRideCaches();
          clearUser();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    restore();
    return () => { cancelled = true; };
  }, [applyUser, clearUser]);

  // ── SESSION LOST (401 from any API call) ──
  useEffect(() => {
    const onExpired = () => {
      if (!localStorage.getItem("ridewise-authenticated")) return; // already signed out
      sessionStorage.setItem(SESSION_EXPIRED_FLAG, "true"); // the login page explains why
      clearRideCaches();
      clearUser();
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [clearUser]);

  // ── SIGNUP ──
  const signup = async (email, password) => {
    if (!email || !password) throw new Error("Email and password are required.");
    if (password.length < 6)  throw new Error("Password must be at least 6 characters.");

    const newUser = await apiJson(
      "/api/auth/signup",
      jsonBody("POST", { email: email.trim().toLowerCase(), password }),
    );
    localStorage.removeItem("ridewise-remember-me");
    applyUser(newUser);
    return newUser;
  };

  // ── LOGIN ──
  const login = async (email, password, rememberMe = false) => {
    if (!email || !password) throw new Error("Email and password are required.");

    const loggedIn = await apiJson(
      "/api/auth/login",
      jsonBody("POST", { email: email.trim().toLowerCase(), password }),
    );
    if (rememberMe) localStorage.setItem("ridewise-remember-me", "true");
    else localStorage.removeItem("ridewise-remember-me");
    applyUser(loggedIn);
    return loggedIn;
  };

  // ── UPDATE PROFILE ──
  // patch: { username?, mobile?, address?, lat?, lng? }
  const updateProfile = async (patch) => {
    if (!user) throw new Error("You're not logged in.");

    const updated = await apiJson(`/api/auth/profile/${user.id}`, jsonBody("PATCH", patch));
    const merged = { ...user, ...updated };
    rememberUser(merged);
    setUser(merged);
    return merged;
  };

  // ── CHANGE EMAIL ── (the password confirms it)
  const changeEmail = async (email, password) => {
    if (!user) throw new Error("You're not logged in.");
    const updated = await changeAccountEmail(email, password);
    const merged = { ...user, ...updated };
    rememberUser(merged);
    setUser(merged);
    return merged;
  };

  // ── DELETE ACCOUNT ──
  // The account is gone on the server, so everything this device kept for
  // it goes too — including the per-user theme and settings that a normal
  // logout leaves in place.
  const deleteAccount = async (password, confirm) => {
    if (!user) throw new Error("You're not logged in.");
    const id = user.id;
    await deleteAccountOnServer(password, confirm);
    try {
      localStorage.removeItem("ridewise-remember-me");
      localStorage.removeItem(`ridewise-theme-${id}`);
      localStorage.removeItem(`ridewise-settings-${id}`);
    } catch {
      // storage unavailable
    }
    clearRideCaches();
    clearUser();
  };

  // ── LOGOUT ──
  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Clear this device even when the server cannot be reached.
    }

    // The per-user theme ("ridewise-theme-<id>") and settings
    // ("ridewise-settings-<id>") are kept on purpose — they are device
    // preferences, not session data.
    localStorage.removeItem("ridewise-remember-me");
    clearRideCaches();
    clearUser();
  };

  const avatarLetter = (user?.username?.[0] || user?.email?.[0] || "R").toUpperCase();
  const isAdmin = user?.role === "ADMIN";

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isFullyOnboarded, loading, avatarLetter, isAdmin,
      login, signup, updateProfile, changeEmail, deleteAccount, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
