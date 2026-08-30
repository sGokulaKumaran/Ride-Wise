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
import { Navigate } from "react-router-dom";   // For redirects
import { useAuth } from "../../../context/AuthContext";  // Get auth state

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isFullyOnboarded, loading } = useAuth();

  // ── CHECK 1: Still checking localStorage? Show spinner ──
  // Without this, logged-in users would see a flash of login page
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-black">
        <div className="text-white text-center">
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

  // ── CHECK 2: Not logged in? → redirect to / (login page) ──
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;  // replace = don't add to history
  }

  // ── CHECK 3: Logged in but no username? → go to onboarding ──
  if (!isFullyOnboarded) {
    return <Navigate to="/onboarding" replace />;
  }

  // ── ALL CLEAR: Show the protected page ──
  return children;
}