// ============================================================
// ProtectedRoute — Guards routes that require authentication
//
// USAGE (in App.jsx):
//   <Route path="/home" element={
//     <ProtectedRoute><Home /></ProtectedRoute>
//   } />
//
// REDIRECT LOGIC:
//   loading               → show a themed loader (prevents flash of login page)
//   not isAuthenticated   → redirect to / (Login page)
//   isAuthenticated but
//     not isFullyOnboarded → redirect to /onboarding (details page)
//   both true             → render children normally
// ============================================================
import { Navigate } from "react-router-dom";   // For redirects
import { useAuth } from "../../../context/AuthContext";  // Get auth state
import { useTheme } from "../../hooks/useTheme";          // Theme tokens
import Icon from "../ui/Icon";                           // Icon family

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isFullyOnboarded, loading, user } = useAuth();
  const { tc } = useTheme(user?.id);   // same tokens the page will use

  // ── CHECK 1: Still checking localStorage? Show spinner ──
  // Without this, logged-in users would see a flash of login page
  if (loading) {
    return (
      <div className={`min-h-screen w-full flex items-center justify-center ${tc.bg} ${tc.text}`}>
        <div className={`rounded-xl border px-6 py-5 text-center ${tc.card}`}>
          <Icon name="spinner" size={18} className={`rw-spin block mx-auto mb-3 ${tc.sub}`} />
          <p className={`text-sm font-medium tracking-wide ${tc.sub}`}>
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