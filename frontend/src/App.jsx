// ============================================================
// 🚀 App.jsx — Root component + Router setup
//
// RESPONSIBILITIES:
//   1. Wrap the entire app in <AuthProvider> so every page and
//      component can call useAuth()
//   2. Set up React Router with all routes
//   3. Guard protected routes with <ProtectedRoute> which checks
//      isAuthenticated and isFullyOnboarded from AuthContext
//   4. Redirect unbuilt/future routes to existing pages
//
// FLOW:
//   /           → Login/Signup (public)
//   /onboarding → Profile details (public, but only reached after signup)
//   /home       → Rider Dashboard (protected)
//   /account    → Profile page (protected)
//   /settings   → Settings (protected)
//   /community  → Community (protected)
//   /messages   → Messages (protected)
//   ... (other existing pages remain protected too)
//
// ADDING NEW PAGES:
//   1. Create your page in src/pages/
//   2. Import it here
//   3. Add a <Route path="..." element={<ProtectedRoute><YourPage /></ProtectedRoute>} />
// ============================================================

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

// ─── Public pages ─────────────────────────────────────────────
// The Login page also handles Signup — it's the single entry point
import LoginPage from "./pages/landing-page/Login";
import Onboarding from "./pages/Onboarding";

// ─── Protected pages ──────────────────────────────────────────
import Account from "./pages/Account";
import BikeDetail from "./pages/BikeDetail";
import Community from "./pages/Community";
import Home from "./pages/Home";
import Live from "./pages/Live";
import Marketplace from "./pages/Marketplace";
import Messages from "./pages/Messages";
import Search from "./pages/Search";
import Settings from "./pages/Settings";

// ─── Route guard ──────────────────────────────────────────────
// Redirects: unauthenticated → /, not onboarded → /onboarding
import ProtectedRoute from "./pages/components/shared/ProtectedRoute";

export default function App() {
  return (
    // AuthProvider must be the outermost wrapper so ProtectedRoute
    // can call useAuth() inside the router context
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* ════════════════════════════════════════════════
              PUBLIC ROUTES — no auth required
          ════════════════════════════════════════════════ */}

          {/* Login / Signup combined page (the app entry point) */}
          <Route path="/" element={<LoginPage />} />

          {/* Onboarding details page: username, mobile, address */}
          {/* Reached after signup. Also accessible if user hasn't onboarded yet. */}
          <Route path="/onboarding" element={<Onboarding />} />

          {/* ════════════════════════════════════════════════
              PROTECTED ROUTES — require login + onboarding
              All wrapped in <ProtectedRoute> which handles redirects
          ════════════════════════════════════════════════ */}

          {/* Rider dashboard — the main page after login */}
          <Route path="/home"        element={<ProtectedRoute><Home /></ProtectedRoute>} />

          {/* User profile / account page */}
          <Route path="/account"     element={<ProtectedRoute><Account /></ProtectedRoute>} />

          {/* App settings */}
          <Route path="/settings"    element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          {/* Marketplace for bikes / gear */}
          <Route path="/marketplace" element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />

          {/* Live ride streams */}
          <Route path="/live"        element={<ProtectedRoute><Live /></ProtectedRoute>} />

          {/* Direct messages */}
          <Route path="/messages"    element={<ProtectedRoute><Messages /></ProtectedRoute>} />

          {/* Search results */}
          <Route path="/search"      element={<ProtectedRoute><Search /></ProtectedRoute>} />

          {/* Community feed */}
          <Route path="/community"   element={<ProtectedRoute><Community /></ProtectedRoute>} />

          {/* Individual bike detail page */}
          <Route path="/bike/:id"    element={<ProtectedRoute><BikeDetail /></ProtectedRoute>} />

          {/* ════════════════════════════════════════════════
              FUTURE ROUTES — placeholder redirects
              These will be real pages once their features are built.
              Replace Navigate with the actual page component when ready.
          ════════════════════════════════════════════════ */}

          {/* Find Riders page → redirects to community for now */}
          <Route path="/find-riders" element={<Navigate to="/community" replace />} />

          {/* My Rides page → redirects to home for now */}
          <Route path="/my-rides"    element={<Navigate to="/home" replace />} />

          {/* Map page → redirects to home for now */}
          <Route path="/map"         element={<Navigate to="/home" replace />} />

          {/* Plan Ride → home */}
          <Route path="/plan-ride"   element={<Navigate to="/home" replace />} />

          {/* Saved items → home */}
          <Route path="/saved"       element={<Navigate to="/home" replace />} />

          {/* Old /profile → /account */}
          <Route path="/profile"     element={<Navigate to="/account" replace />} />

          {/* Old /login route → / (login is now the root) */}
          <Route path="/login"       element={<Navigate to="/" replace />} />

          {/* Share ride → home */}
          <Route path="/share"       element={<Navigate to="/home" replace />} />

          {/* Sell → marketplace */}
          <Route path="/sell"        element={<Navigate to="/marketplace" replace />} />

          {/* Individual ride → home for now */}
          <Route path="/ride/:id"    element={<Navigate to="/home" replace />} />

          {/* ════════════════════════════════════════════════
              404 CATCH-ALL → landing page
          ════════════════════════════════════════════════ */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
