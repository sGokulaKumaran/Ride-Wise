// ============================================================
// OrgContext — "which organizations am I part of?"
//
// One small request (GET /api/organizations/me) answers what the whole
// navigation needs to know:
//   managed      organizations I run (owner / admin)   → "Manage"
//   driving      organizations I drive for             → "Drive"
//   invitations  invitations waiting for my answer     → the badge
//   savedCount   organizations on my list
//   activeTrip   the vehicle trip I am driving right now, if any
//
// A person is never "an organization account" or "a driver account":
// these roles are per organization, and the same person can hold several.
// So the app asks, instead of assuming from the account.
//
// The answer is refreshed when the tab is looked at again and every
// couple of minutes — an invitation or a removal by an admin shows up
// without a reload — and on demand (refresh()) right after the user
// changes something themselves.
// ============================================================

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { useAuth } from "./AuthContext";
import { useLoad } from "../pages/hooks/useFleet";
import { getMyOrganizations } from "../services/orgApi";

const EMPTY = Object.freeze({ managed: [], driving: [], invitations: [], savedCount: 0, activeTrip: null });
const FALLBACK = Object.freeze({ summary: EMPTY, loaded: false, refresh: () => {} });

const REFRESH_EVERY_MS = 120_000;
const MIN_GAP_MS = 15_000;

const OrgContext = createContext(FALLBACK);

export function OrgProvider({ children }) {
  const { user, isAuthenticated, isFullyOnboarded } = useAuth();
  const userId = isAuthenticated && isFullyOnboarded ? user?.id ?? null : null;

  const { data, loading, reload } = useLoad(userId != null ? `orgs-${userId}` : null, getMyOrganizations);

  // Refresh when the tab comes back, and now and then while it is open.
  const lastRef = useRef(0);
  useEffect(() => {
    if (userId == null) return undefined;
    lastRef.current = Date.now();
    const refreshIfDue = () => {
      if (document.hidden || Date.now() - lastRef.current < MIN_GAP_MS) return;
      lastRef.current = Date.now();
      reload();
    };
    const timer = setInterval(refreshIfDue, REFRESH_EVERY_MS);
    document.addEventListener("visibilitychange", refreshIfDue);
    window.addEventListener("focus", refreshIfDue);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfDue);
      window.removeEventListener("focus", refreshIfDue);
    };
  }, [userId, reload]);

  const value = useMemo(() => ({
    summary: data || EMPTY,
    loaded: userId != null && !loading,
    refresh: reload,
  }), [data, loading, reload, userId]);

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOrgs() {
  return useContext(OrgContext);
}
