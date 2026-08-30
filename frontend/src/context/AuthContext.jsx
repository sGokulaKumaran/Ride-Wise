// ============================================================
// 🔐 AuthContext — Global authentication state manager
//
// CRITICAL FIXES:
//   1. Fixed indentation/brace bugs in saveToAccountsList
//   2. signup now always creates a complete user via makeUser()
//   3. updateProfile handles missing per-account record gracefully
//   4. logout no longer leaks partial state
//   5. makeUser guarantees a valid id for all users
// ============================================================

import { createContext, useContext, useEffect, useState } from "react";
// createContext: makes a "company-wide announcement system"
// useContext: lets components "tune in" to announcements
// useState: stores changing data
// useEffect: runs side effects (like reading localStorage)

const ACCOUNTS_LIST_KEY = "ridewise-all-accounts";
// Shared list of all users — so Riders search can find them

const AuthContext = createContext(null);
// The actual announcement system (starts as null)

export function useAuth() {
  // Custom hook — any component can call this to access auth state
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

// ── INTERNAL HELPER: save user to shared list ──
function saveToAccountsList(user) {
  if (!user || !user.email) return;  // Safety check
  const list = JSON.parse(localStorage.getItem(ACCOUNTS_LIST_KEY) || "[]");
  const idx = list.findIndex((u) => u.email === user.email);
  if (idx >= 0) list[idx] = { ...list[idx], ...user };  // Update existing
  else list.push(user);                                  // Add new
  localStorage.setItem(ACCOUNTS_LIST_KEY, JSON.stringify(list));
}

// ── INTERNAL HELPER: remove from shared list ──
function removeFromAccountsList(email) {
  if (!email) return;
  const list = JSON.parse(localStorage.getItem(ACCOUNTS_LIST_KEY) || "[]");
  const filtered = list.filter((u) => u.email !== email);
  localStorage.setItem(ACCOUNTS_LIST_KEY, JSON.stringify(filtered));
}

// ── INTERNAL HELPER: generate unique user ID ──
function makeUserId() {
  return "u_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  // Example: "u_1703123456789_a3kf2j"
}

// ── INTERNAL HELPER: build complete user object ──
function makeUser(overrides = {}) {
  return {
    id:        overrides.id        || makeUserId(),
    email:     overrides.email     || "",
    username:  overrides.username  || "",
    mobile:    overrides.mobile    || "",
    address:   overrides.address   || "",
    avatar:    overrides.avatar    || "",
    createdAt: overrides.createdAt || new Date().toISOString(),
    lat:       overrides.lat       ?? null,  // For "Near Riders" feature
    lng:       overrides.lng       ?? null,
  };
}

export function AuthProvider({ children }) {
  // ── STATE (the "whiteboard" of current auth info) ──
  const [user, setUser] = useState(null);                  // Current user object
  const [isAuthenticated, setIsAuthenticated] = useState(false);  // Logged in?
  const [isFullyOnboarded, setIsFullyOnboarded] = useState(false); // Has username?
  const [loading, setLoading] = useState(true);            // Still checking localStorage?

  // ── RESTORE SESSION ON APP LOAD ──
  useEffect(() => {
    try {
      const savedUser  = localStorage.getItem("ridewise-user");
      const savedAuth  = localStorage.getItem("ridewise-authenticated");
      const savedBoard = localStorage.getItem("ridewise-onboarded");

      if (savedUser && savedAuth === "true") {
        const parsed = JSON.parse(savedUser);
        if (!parsed.id) parsed.id = makeUserId();  // Backfill missing ID
        setUser(parsed);
        setIsAuthenticated(true);
        setIsFullyOnboarded(savedBoard === "true" && Boolean(parsed.username));
      }
    } catch (err) {
      // Corrupted data — wipe everything
      localStorage.removeItem("ridewise-user");
      localStorage.removeItem("ridewise-authenticated");
      localStorage.removeItem("ridewise-onboarded");
    } finally {
      setLoading(false);  // Always tell ProtectedRoute "done checking"
    }
  }, []);  // Empty array = run ONCE on mount

  // ── SIGNUP ──
  const signup = async (email, password) => {
    await new Promise((r) => setTimeout(r, 400));  // Simulate network delay

    if (!email || !password) throw new Error("Email and password are required.");
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");

    const cleanEmail = email.trim().toLowerCase();
    const newUser = makeUser({ email: cleanEmail });

    // 1) Save to per-account record (for future login)
    localStorage.setItem(`ridewise-account-${cleanEmail}`, JSON.stringify({
      email: cleanEmail,
      password,
      user: newUser,
    }));

    // 2) Save to shared list (so others can find them)
    saveToAccountsList(newUser);

    // 3) Set session keys
    localStorage.setItem("ridewise-user", JSON.stringify(newUser));
    localStorage.setItem("ridewise-authenticated", "true");
    localStorage.setItem("ridewise-onboarded", "false");

    // 4) Update React state
    setUser(newUser);
    setIsAuthenticated(true);
    setIsFullyOnboarded(false);

    return newUser;
  };

  // ── LOGIN ──
  const login = async (email, password) => {
    await new Promise((r) => setTimeout(r, 400));

    if (!email || !password) throw new Error("Email and password are required.");

    const cleanEmail = email.trim().toLowerCase();
    const stored = localStorage.getItem(`ridewise-account-${cleanEmail}`);
    if (!stored) throw new Error("No account found with this email.");

    const account = JSON.parse(stored);
    if (account.password !== password) throw new Error("Incorrect password.");

    const restoredUser = account.user || makeUser({ email: cleanEmail });
    if (!restoredUser.id) restoredUser.id = makeUserId();

    saveToAccountsList(restoredUser);  // Refresh shared list with latest info

    localStorage.setItem("ridewise-user", JSON.stringify(restoredUser));
    localStorage.setItem("ridewise-authenticated", "true");
    localStorage.setItem("ridewise-onboarded", restoredUser.username ? "true" : "false");

    setUser(restoredUser);
    setIsAuthenticated(true);
    setIsFullyOnboarded(Boolean(restoredUser.username));

    return restoredUser;
  };

  // ── UPDATE PROFILE ──
  const updateProfile = async (patch) => {
    await new Promise((r) => setTimeout(r, 300));
    if (!user) throw new Error("Not logged in");

    const updated = { ...user, ...patch };  // Merge new fields

    // Update per-account record
    if (updated.email) {
      const accountKey = `ridewise-account-${updated.email}`;
      const stored = localStorage.getItem(accountKey);
      if (stored) {
        try {
          const account = JSON.parse(stored);
          account.user = updated;
          localStorage.setItem(accountKey, JSON.stringify(account));
        } catch (err) {
          console.error("Failed to update per-account record:", err);
        }
      }
    }

    saveToAccountsList(updated);  // Update shared list

    localStorage.setItem("ridewise-user", JSON.stringify(updated));
    setUser(updated);

    // Mark as onboarded if username was just set
    if (patch.username && patch.username.trim()) {
      localStorage.setItem("ridewise-onboarded", "true");
      setIsFullyOnboarded(true);
    }

    return updated;
  };

  // ── LOGOUT ──
  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setIsFullyOnboarded(false);
    localStorage.removeItem("ridewise-user");
    localStorage.removeItem("ridewise-authenticated");
    localStorage.removeItem("ridewise-onboarded");
    // Note: NOT removed from ACCOUNTS_LIST_KEY so others can still find them
  };

  // ── COMPUTED: avatar letter (first letter of username or email) ──
  const avatarLetter =
    (user?.username?.[0] || user?.email?.[0] || "R").toUpperCase();

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isFullyOnboarded, loading, avatarLetter,
      login, signup, updateProfile, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}