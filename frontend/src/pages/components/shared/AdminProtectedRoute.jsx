// ============================================================
// AdminProtectedRoute — Guards admin routes
//
// USAGE (in App.jsx):
//   <Route path="/admin" element={
//     <AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>
//   } />
//
// REDIRECT LOGIC:
//   loading               → show themed loader
//   not isAuthenticated   → redirect to / (Login page)
//   not isFullyOnboarded  → redirect to /onboarding
//   not isAdmin           → redirect to /home (unauthorized)
//   all clear             → render children
// ============================================================
import { Navigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../hooks/useTheme";
import Icon from "../ui/Icon";

export default function AdminProtectedRoute({ children }) {
  const { isAuthenticated, isFullyOnboarded, isAdmin, loading, user } = useAuth();
  const { tc } = useTheme(user?.id);   // same tokens the admin pages use

  // ── CHECK 1: Still loading? Show spinner ──
  if (loading) {
    return (
      <div className={`min-h-screen w-full flex items-center justify-center ${tc.bg} ${tc.text}`}>
        <div className={`rounded-xl border px-6 py-5 text-center ${tc.card}`}>
          <Icon name="spinner" size={18} className={`rw-spin block mx-auto mb-3 ${tc.sub}`} />
          <p className={`text-sm font-medium tracking-wide ${tc.sub}`}>
            Loading RideWise Admin…
          </p>
        </div>
      </div>
    );
  }

  // ── CHECK 2: Not logged in? → login page ──
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // ── CHECK 3: Not onboarded? → onboarding ──
  if (!isFullyOnboarded) {
    return <Navigate to="/onboarding" replace />;
  }

  // ── CHECK 4: Not admin? → redirect to home ──
  if (!isAdmin) {
    return <Navigate to="/home" replace />;
  }

  // ── ALL CLEAR: Show the admin page ──
  return children;
}
