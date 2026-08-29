// ============================================================
// 🛡️ ProtectedRoute — Guards routes that require authentication
//
// USAGE (in App.jsx):
//   <Route path="/home" element={
//     <ProtectedRoute><Home /></ProtectedRoute>
//   } />
//
// REDIRECT LOGIC:
//   loading               → show a branded loader (prevents flash of login page)
//   not isAuthenticated   → redirect to / (Login page)
//   isAuthenticated but
//     not isFullyOnboarded → redirect to /onboarding (details page)
//   both true             → render children normally
// ============================================================

import { Navigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isFullyOnboarded, loading } = useAuth();

  // ── While restoring auth from localStorage, show a loader ───
  // Without this, already-logged-in users would see a brief flash
  // of the login page before the redirect happens.
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-black">
        <div className="text-white text-center">
          {/* Animated logo */}
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center animate-pulse shadow-2xl shadow-orange-500/40">
            <i className="fa fa-motorcycle text-xl text-white" />
          </div>
          <p className="text-sm text-gray-400 font-medium tracking-wide">
            Loading RideWise…
          </p>
        </div>
      </div>
    );
  }

  // ── Not logged in → redirect to landing / login page ────────
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // ── Logged in but hasn't completed onboarding → send there ──
  if (!isFullyOnboarded) {
    return <Navigate to="/onboarding" replace />;
  }

  // ── All conditions met → render the protected page ──────────
  return children;
}
