// ============================================================
// 🔐 AuthContext — Global authentication state manager
//
// BACKEND CONNECTED:
//   signup       → POST /api/auth/signup
//   login        → POST /api/auth/login
//   updateProfile → PATCH /api/auth/profile/{userId}
//
// SESSION PERSISTENCE:
//   The UserResponse returned by the backend is saved to
//   localStorage so the user stays logged in on refresh.
//   The actual source-of-truth for credentials lives in the
//   backend H2 / PostgreSQL database.
//
// NOTES:
//   - user.id is now a Long (number) from the backend — no more
//     "u_<timestamp>_<random>" string IDs.
//   - Passwords are BCrypt-hashed on the backend; we never store
//     them in localStorage.
// ============================================================

import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

// ── Custom hook used by every component that needs auth ──
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

// ── Helper: throw a readable error from a non-2xx response ──
async function handleResponse(res) {
  if (res.ok) return res.json();
  // Try to parse a message from the backend error body
  let msg = `Server error (${res.status})`;
  try {
    const body = await res.json();
    if (body?.message) msg = body.message;
    else if (typeof body === "string") msg = body;
  } catch (_) {
    // body wasn't JSON — keep the generic message
  }
  throw new Error(msg);
}

export function AuthProvider({ children }) {
  // ── STATE ──
  const [user,             setUser]             = useState(null);
  const [isAuthenticated,  setIsAuthenticated]  = useState(false);
  const [isFullyOnboarded, setIsFullyOnboarded] = useState(false);
  const [loading,          setLoading]          = useState(true);

  // ── RESTORE SESSION FROM THE SERVER ON APP LOAD ──
  // localStorage is only a UI cache. /api/auth/me confirms that the
  // server-side session cookie is still valid before protected pages render.
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) throw new Error("Not authenticated");
        const serverUser = await res.json();
        if (cancelled) return;

        localStorage.setItem("ridewise-user", JSON.stringify(serverUser));
        localStorage.setItem("ridewise-authenticated", "true");
        localStorage.setItem("ridewise-onboarded", serverUser.username ? "true" : "false");
        setUser(serverUser);
        setIsAuthenticated(true);
        setIsFullyOnboarded(Boolean(serverUser.username));
      } catch (_) {
        if (cancelled) return;
        localStorage.removeItem("ridewise-user");
        localStorage.removeItem("ridewise-authenticated");
        localStorage.removeItem("ridewise-onboarded");
        setUser(null);
        setIsAuthenticated(false);
        setIsFullyOnboarded(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    restore();
    return () => { cancelled = true; };
  }, []);

  // ── SIGNUP — POST /api/auth/signup ──
  const signup = async (email, password) => {
    if (!email || !password) throw new Error("Email and password are required.");
    if (password.length < 6)  throw new Error("Password must be at least 6 characters.");
    
    //Its awake the backend of the signup controller in the authController
    const res = await fetch("/api/auth/signup", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body:    JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });

    const newUser = await handleResponse(res);
    // newUser is a UserResponse: { id, email, username, mobile, address, lat, lng, createdAt }

    localStorage.setItem("ridewise-user", JSON.stringify(newUser));
    localStorage.setItem("ridewise-authenticated", "true");
    localStorage.setItem("ridewise-onboarded", "false");

    setUser(newUser);
    setIsAuthenticated(true);
    setIsFullyOnboarded(false);

    return newUser;
  };

  // ── LOGIN — POST /api/auth/login ──
  const login = async (email, password) => {
    if (!email || !password) throw new Error("Email and password are required.");

    const res = await fetch("/api/auth/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body:    JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });

    const loggedInUser = await handleResponse(res);

    localStorage.setItem("ridewise-user",          JSON.stringify(loggedInUser));
    localStorage.setItem("ridewise-authenticated", "true");
    localStorage.setItem("ridewise-onboarded",     loggedInUser.username ? "true" : "false");

    setUser(loggedInUser);
    setIsAuthenticated(true);
    setIsFullyOnboarded(Boolean(loggedInUser.username));

    return loggedInUser;
  };

  // ── UPDATE PROFILE — PATCH /api/auth/profile/{userId} ──
  const updateProfile = async (patch) => {
    if (!user) throw new Error("Not logged in");// for safty check

    const res = await fetch(`/api/auth/profile/${user.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body:    JSON.stringify(patch),
      // patch can include: { username, mobile, address }
    });

    const updated = await handleResponse(res);
    // Merge: keep anything the backend echoed back, fall back to local copy
    const merged = { ...user, ...updated };

    localStorage.setItem("ridewise-user", JSON.stringify(merged));
    setUser(merged);

    // Mark as onboarded if username was just set
    if (patch.username && patch.username.trim()) {
      localStorage.setItem("ridewise-onboarded", "true");
      setIsFullyOnboarded(true);
    }

    return merged;
  };

  // ── LOGOUT ──
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (_) {
      // Still clear local state if the network request fails
    }

    if (user?.id) {
      localStorage.removeItem(`ridewise-theme-${user.id}`);
      localStorage.removeItem(`ridewise-settings-${user.id}`);
      localStorage.removeItem(`ridewise-rides-local-${user.id}`);
    }
    localStorage.removeItem("ridewise-rides-local"); // legacy shared cache
    localStorage.removeItem("ridewise-user");
    localStorage.removeItem("ridewise-authenticated");
    localStorage.removeItem("ridewise-onboarded");
    localStorage.removeItem("ridewise-theme");

    setUser(null);
    setIsAuthenticated(false);
    setIsFullyOnboarded(false);
  };

  // ── COMPUTED: avatar letter ──
  const avatarLetter =
    (user?.username?.[0] || user?.email?.[0] || "R").toUpperCase();
    // first its check the username if not then its check email
    //even that also not then its use R default value

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isFullyOnboarded, loading, avatarLetter,
      login, signup, updateProfile, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}