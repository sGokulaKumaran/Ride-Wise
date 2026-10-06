import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
// BrowserRouter: enables URL-based navigation
// Routes: container for all route definitions
// Route: one URL pattern → one component
// Navigate: redirect component

import { AuthProvider, useAuth } from "./context/AuthContext";
// Wraps the entire app — makes auth state available everywhere
import { OrgProvider } from "./context/OrgContext";
// "Which organizations am I part of?" — what the navigation needs to know
import { DriverTripProvider } from "./context/DriverTripContext";
// The vehicle trip I am driving: tracked for the whole app, whatever page is open

import { applyA11ySettings, loadA11ySettings } from "./utils/a11y";
import { useTheme } from "./pages/hooks/useTheme";

// ── Re-applies saved accessibility settings (text size, reduce motion,
//    high contrast) app-wide whenever the logged-in user changes ──
function A11yApplier() {
  const { user } = useAuth();
  useEffect(() => {
    const saved = loadA11ySettings(user?.id);
    if (saved) applyA11ySettings(saved);
  }, [user?.id]);
  return null;
}

// ── Toast host — uses the same theme system as the rest of the app,
//    so notifications match the four themes instead of always being dark ──
function ThemedToasts() {
  const { user } = useAuth();
  const { tc } = useTheme(user?.id);
  return (
    <ToastContainer
      position="bottom-right"
      autoClose={3000}
      theme={tc.isDark ? "dark" : "light"}
    />
  );
}

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import LoginPage from "./pages/landing-page/Login";   // Public — entry point
import Onboarding from "./pages/Onboarding";          // Public — between signup and home

import Account from "./pages/Account";   // Protected
import Home from "./pages/Home";         // Protected
import Settings from "./pages/Settings"; // Protected
import Riders from "./pages/Riders";     // Protected

// Organizations: follow vehicles · drive · manage a fleet
import Organizations from "./pages/org/Organizations";
import CreateOrganization from "./pages/org/CreateOrganization";
import OrganizationPage from "./pages/org/OrganizationPage";
import TrackVehicle from "./pages/org/TrackVehicle";
import Driver from "./pages/org/Driver";
import DriverSession from "./pages/org/DriverSession";
import TripPill from "./pages/components/org/TripPill";
import Icon from "./pages/components/ui/Icon";

// ── Loaded on demand ─────────────────────────────────────────
// Running an organization and administering the platform are what a few
// people do; riding and following a bus are what everybody does. Their
// screens are split out of the main download and fetched the first time
// somebody opens them.
const OrgAdmin = lazy(() => import("./pages/org/OrgAdmin"));
const OrgAdminHome = lazy(() => import("./pages/org/OrgAdmin").then((module) => ({ default: module.OrgAdminHome })));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminRides = lazy(() => import("./pages/admin/AdminRides"));
const AdminOrganizations = lazy(() => import("./pages/admin/AdminOrganizations"));

import ProtectedRoute from "./pages/components/shared/ProtectedRoute";
// The "security guard" — checks auth before allowing access
import AdminProtectedRoute from "./pages/components/shared/AdminProtectedRoute";
// Admin-only route guard — checks auth + admin role
import ErrorBoundary from "./pages/components/shared/ErrorBoundary";
// Catches render crashes — one bad branch can no longer blank the whole app

// ── Shown for the moment an on-demand screen takes to arrive ──
function PageLoader() {
  const { user } = useAuth();
  const { tc } = useTheme(user?.id);
  return (
    <div className={`flex min-h-screen w-full items-center justify-center ${tc.bg} ${tc.text}`}>
      <Icon name="spinner" size={20} className={`rw-spin ${tc.sub}`} />
    </div>
  );
}

// A protected page inside its own error boundary: a render crash in one
// page — or an on-demand screen that could not be fetched — shows a
// recovery panel instead of blanking the whole app.
const guarded = (page) => (
  <ProtectedRoute>
    <ErrorBoundary><Suspense fallback={<PageLoader />}>{page}</Suspense></ErrorBoundary>
  </ProtectedRoute>
);
const adminOnly = (page) => (
  <AdminProtectedRoute>
    <ErrorBoundary><Suspense fallback={<PageLoader />}>{page}</Suspense></ErrorBoundary>
  </AdminProtectedRoute>
);

export default function App() {
  return (
    <AuthProvider>           {/* Step 1: Provide auth context to entire app */}
      <OrgProvider>          {/* Step 1a: My organizations (roles are per organization) */}
        <DriverTripProvider> {/* Step 1b: The vehicle trip in progress, tracked app-wide */}
          <A11yApplier />    {/* Step 1c: Apply saved accessibility settings */}
          <BrowserRouter>    {/* Step 2: Enable client-side routing */}
            <Routes>         {/* Step 3: Define all routes */}

              {/* ─── PUBLIC ROUTES (no login required) ─── */}
              <Route path="/"           element={<LoginPage />} />
              <Route path="/onboarding" element={<Onboarding />} />

              {/* ─── PROTECTED ROUTES (login + onboarding required) ─── */}
              <Route path="/home"     element={guarded(<Home />)} />
              <Route path="/riders"   element={guarded(<Riders />)} />
              <Route path="/account"  element={guarded(<Account />)} />
              <Route path="/settings" element={guarded(<Settings />)} />

              {/* ─── ORGANIZATIONS ───
                  What a person may do in an organization (follow, drive,
                  manage) is decided per organization by the server — these
                  routes only require being signed in. */}
              <Route path="/organizations"                         element={guarded(<Organizations />)} />
              <Route path="/organizations/:orgId"                  element={guarded(<OrganizationPage />)} />
              <Route path="/organizations/:orgId/track/:vehicleId" element={guarded(<TrackVehicle />)} />
              <Route path="/create-organization"                   element={guarded(<CreateOrganization />)} />

              {/* Driving for an organization */}
              <Route path="/driver"         element={guarded(<Driver />)} />
              <Route path="/driver/session" element={guarded(<DriverSession />)} />

              {/* Running an organization — its id is part of the address,
                  because one person can manage several. */}
              <Route path="/org-admin"             element={guarded(<OrgAdminHome />)} />
              <Route path="/org-admin/:orgId"      element={guarded(<OrgAdmin />)} />
              <Route path="/org-admin/:orgId/:tab" element={guarded(<OrgAdmin />)} />

              {/* ─── ADMIN ROUTES (login + onboarding + admin role required) ─── */}
              <Route path="/admin"               element={adminOnly(<AdminDashboard />)} />
              <Route path="/admin/users"         element={adminOnly(<AdminUsers />)} />
              <Route path="/admin/rides"         element={adminOnly(<AdminRides />)} />
              <Route path="/admin/organizations" element={adminOnly(<AdminOrganizations />)} />

              {/* ─── REDIRECTS (old URLs → new) ─── */}
              <Route path="/saved"   element={<Navigate to="/home" replace />} />
              <Route path="/profile" element={<Navigate to="/account" replace />} />
              <Route path="/login"   element={<Navigate to="/" replace />} />
              {/* Addresses from the platform plan that became one page each */}
              <Route path="/organizations/search"    element={<Navigate to="/organizations?tab=find" replace />} />
              <Route path="/organizations/my-access" element={<Navigate to="/organizations" replace />} />
              <Route path="/driver/organizations"    element={<Navigate to="/driver" replace />} />
              <Route path="/org-admin/dashboard"     element={<Navigate to="/org-admin" replace />} />

              {/* ─── 404 CATCH-ALL ─── */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {/* "You are driving BUS-01" — on every page while a trip runs */}
            <TripPill />
          </BrowserRouter>
          <ThemedToasts />
        </DriverTripProvider>
      </OrgProvider>
    </AuthProvider>
  );
}
