// ============================================================
// 🔐 AuthContext — Global authentication state manager
//
// FIX: Also writes every account to "ridewise-all-accounts"
// so other features (like Riders) can see ALL signed-up users.
// ============================================================

import { createContext, useContext, useEffect, useState } from "react";

const ACCOUNTS_LIST_KEY = "ridewise-all-accounts";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

// Helper: add or update an account in the shared list
function saveToAccountsList(user) {
  if (!user || !user.email) return;
  const list = JSON.parse(localStorage.getItem(ACCOUNTS_LIST_KEY) || "[]");
  const idx = list.findIndex((u) => u.email === user.email);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...user };
  } else {
    list.push(user);
  }
  localStorage.setItem(ACCOUNTS_LIST_KEY, JSON.stringify(list));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFullyOnboarded, setIsFullyOnboarded] = useState(false);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
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
      localStorage.removeItem("ridewise-user");
      localStorage.removeItem("ridewise-authenticated");
      localStorage.removeItem("ridewise-onboarded");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── SIGNUP ──
  const signup = async (email, password) => {
    await new Promise((r) => setTimeout(r, 400));
    if (!email || !password) throw new Error("Email and password are required.");
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");

    const newUser = {
      id: "u_" + Date.now(),
      email,
      username: "",
      mobile: "",
      address: "",
      avatar: "",
      createdAt: new Date().toISOString(),
    };

    // Per-account record
    localStorage.setItem(`ridewise-account-${email}`, JSON.stringify({
      email, password, user: newUser,
    }));

    // ✅ Shared list — so other users can find this one
    saveToAccountsList(newUser);

    localStorage.setItem("ridewise-user", JSON.stringify(newUser));
    localStorage.setItem("ridewise-authenticated", "true");
    localStorage.setItem("ridewise-onboarded", "false");
    setUser(newUser);
    setIsAuthenticated(true);
    setIsFullyOnboarded(false);
  };

  // ── LOGIN ──
  const login = async (email, password) => {
    await new Promise((r) => setTimeout(r, 400));
    if (!email || !password) throw new Error("Email and password are required.");

    const stored = localStorage.getItem(`ridewise-account-${email}`);
    if (!stored) throw new Error("No account found with this email.");

    const account = JSON.parse(stored);
    if (account.password !== password) throw new Error("Incorrect password.");

    const restoredUser = account.user || {
      id: "u_" + Date.now(),
      email,
      username: "",
      mobile: "",
      address: "",
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem("ridewise-user", JSON.stringify(restoredUser));
    localStorage.setItem("ridewise-authenticated", "true");
    localStorage.setItem("ridewise-onboarded", restoredUser.username ? "true" : "false");

    setUser(restoredUser);
    setIsAuthenticated(true);
    setIsFullyOnboarded(Boolean(restoredUser.username));

    // ✅ Make sure shared list has this user
    saveToAccountsList(restoredUser);
  };

  // ── UPDATE PROFILE ──
  const updateProfile = async (patch) => {
    await new Promise((r) => setTimeout(r, 300));
    if (!user) throw new Error("Not logged in");

    const updated = { ...user, ...patch };

    localStorage.setItem("ridewise-user", JSON.stringify(updated));

    if (updated.email) {
      const stored = localStorage.getItem(`ridewise-account-${updated.email}`);
      if (stored) {
        const account = JSON.parse(stored);
        account.user = updated;
        localStorage.setItem(`ridewise-account-${updated.email}`, JSON.stringify(account));
      }
    }

    // ✅ Update shared list
    saveToAccountsList(updated);

    setUser(updated);
    if (patch.username) {
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
    // Note: account record and shared list entry stay
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