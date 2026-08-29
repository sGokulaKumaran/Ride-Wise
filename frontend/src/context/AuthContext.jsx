// ============================================================
// 🔐 AuthContext — Global authentication state manager
//
// HOW IT WORKS:
//   Wrap the entire app with <AuthProvider> in App.jsx.
//   Any component can then call useAuth() to read/change auth state.
//
// STATE:
//   user              → { email, username, mobile, address, createdAt }
//   isAuthenticated   → true after the email + password login/signup step
//   isFullyOnboarded  → true after the user fills the /onboarding details page
//   loading           → true only on first render while restoring from localStorage
//   avatarLetter      → first char of username (or email) for avatar circles
//
// FUNCTIONS:
//   login(email, password)   → verifies credentials, sets state
//   signup(email, password)  → creates a new account, sets state
//   updateProfile(data)      → merges new data into user, marks onboarded if username set
//   logout()                 → clears all auth state (account record stays)
//
// BACKEND-READY:
//   Everything is currently stored in localStorage (no server needed).
//   When you add a backend later, just replace the localStorage logic
//   inside each function with your API calls (axios/fetch). The rest of
//   the app does not need to change at all.
// ============================================================

import { createContext, useContext, useState, useEffect } from "react";

// ─── 1. Create the context object ─────────────────────────────
const AuthContext = createContext(null);

// ─── 2. AuthProvider — wraps the entire app ───────────────────
export function AuthProvider({ children }) {

  // loading = true while we hydrate from localStorage on first mount.
  // Keeps ProtectedRoute from briefly showing the login page to logged-in users.
  const [loading, setLoading] = useState(true);

  // Full user profile: email + profile fields (filled during onboarding)
  const [user, setUser] = useState(null);

  // Has the user completed the email + password step?
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Has the user completed the /onboarding details page (username required)?
  // This is the gate between /onboarding and /home.
  const [isFullyOnboarded, setIsFullyOnboarded] = useState(false);

  // ── Restore auth state from localStorage on first mount ────
  useEffect(() => {
    try {
      const savedUser  = localStorage.getItem("ridewise-user");
      const savedAuth  = localStorage.getItem("ridewise-authenticated");
      const savedBoard = localStorage.getItem("ridewise-onboarded");

      if (savedUser && savedAuth === "true") {
        setUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
        setIsFullyOnboarded(savedBoard === "true");
      }
    } catch (_) {
      // Corrupt data — wipe and start fresh
      localStorage.removeItem("ridewise-user");
      localStorage.removeItem("ridewise-authenticated");
      localStorage.removeItem("ridewise-onboarded");
    } finally {
      setLoading(false); // Done — let ProtectedRoute make redirect decisions
    }
  }, []);

  // ── avatarLetter: first letter of username or email ─────────
  // Used in Sidebar's AccountMenu and TopBar profile button
  const avatarLetter = user
    ? (user.username || user.email || "R").charAt(0).toUpperCase()
    : "R";

  // ── login(email, password) ──────────────────────────────────
  // FRONTEND-ONLY (localStorage) — replace body with API call when backend is ready:
  // TODO: const res = await axios.post('/api/auth/login', { email, password });
  const login = async (email, password) => {
    await new Promise((r) => setTimeout(r, 800)); // simulate network

    const stored = localStorage.getItem(`ridewise-account-${email}`);
    if (!stored) {
      throw new Error("No account found with this email. Please sign up first.");
    }

    const account = JSON.parse(stored);

    // Plain-text password check (replace with JWT/bcrypt when backend is added)
    if (account.password !== password) {
      throw new Error("Incorrect password. Please try again.");
    }

    const restoredUser = account.user;
    const wasOnboarded = !!restoredUser.username; // username filled = onboarded

    setUser(restoredUser);
    setIsAuthenticated(true);
    setIsFullyOnboarded(wasOnboarded);

    // Persist so refreshing the page keeps the user logged in
    localStorage.setItem("ridewise-user", JSON.stringify(restoredUser));
    localStorage.setItem("ridewise-authenticated", "true");
    localStorage.setItem("ridewise-onboarded", wasOnboarded ? "true" : "false");

    return restoredUser;
  };

  // ── signup(email, password) ─────────────────────────────────
  // After signup the user goes to /onboarding, NOT directly to /home.
  // TODO: const res = await axios.post('/api/auth/signup', { email, password });
  const signup = async (email, password) => {
    await new Promise((r) => setTimeout(r, 800)); // simulate network

    const existing = localStorage.getItem(`ridewise-account-${email}`);
    if (existing) {
      throw new Error("An account already exists with this email. Please log in.");
    }

    // Start with a blank profile — fields filled during /onboarding
    const newUser = {
      email,
      username:  "",  // filled on /onboarding step 1
      mobile:    "",  // filled on /onboarding step 2
      address:   "",  // filled on /onboarding step 3
      createdAt: new Date().toISOString(),
    };

    // ⚠️ Plain-text password in localStorage is ONLY acceptable for this
    //    frontend-only prototype. Switch to hashed storage with a backend.
    localStorage.setItem(
      `ridewise-account-${email}`,
      JSON.stringify({ password, user: newUser })
    );

    setUser(newUser);
    setIsAuthenticated(true);
    setIsFullyOnboarded(false); // Must complete /onboarding first

    localStorage.setItem("ridewise-user", JSON.stringify(newUser));
    localStorage.setItem("ridewise-authenticated", "true");
    localStorage.setItem("ridewise-onboarded", "false");

    return newUser;
  };

  // ── updateProfile(data) ─────────────────────────────────────
  // Called from:
  //   /onboarding → saves { username, mobile, address }
  //   /account    → edits profile inline
  // TODO: await axios.put('/api/user/profile', data, { headers: authHeader });
  const updateProfile = async (data) => {
    await new Promise((r) => setTimeout(r, 400)); // simulate network

    const updated  = { ...user, ...data };
    const onboarded = !!updated.username; // username = minimum onboarding requirement

    setUser(updated);
    setIsFullyOnboarded(onboarded);

    localStorage.setItem("ridewise-user", JSON.stringify(updated));
    localStorage.setItem("ridewise-onboarded", onboarded ? "true" : "false");

    // Also update the account record so future logins restore the latest profile
    if (updated.email) {
      const stored = localStorage.getItem(`ridewise-account-${updated.email}`);
      if (stored) {
        const account = JSON.parse(stored);
        account.user  = updated;
        localStorage.setItem(`ridewise-account-${updated.email}`, JSON.stringify(account));
      }
    }

    return updated;
  };

  // ── logout() ────────────────────────────────────────────────
  // Clears the auth session. The account record is kept so the user
  // can log back in later with the same email + password.
  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setIsFullyOnboarded(false);
    localStorage.removeItem("ridewise-user");
    localStorage.removeItem("ridewise-authenticated");
    localStorage.removeItem("ridewise-onboarded");
  };

  // ── Provide all values and functions to the component tree ──
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

// ─── 3. useAuth hook ──────────────────────────────────────────
// Usage in any component:
//   const { user, login, logout, isAuthenticated } = useAuth();
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      "useAuth() must be called inside a component that is a child of <AuthProvider>. " +
      "Make sure <AuthProvider> wraps your app in App.jsx."
    );
  }
  return ctx;
}
