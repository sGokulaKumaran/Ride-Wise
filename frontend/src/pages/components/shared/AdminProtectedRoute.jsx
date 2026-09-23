// ============================================================
// 🛡️ AdminProtectedRoute — Guards admin routes
//
// USAGE (in App.jsx):
//   <Route path="/admin" element={
//     <AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>
//   } />
//
// REDIRECT LOGIC:
//   loading               → show branded loader
//   not isAuthenticated   → redirect to / (Login page)
//   not isFullyOnboarded  → redirect to /onboarding
//   not isAdmin           → redirect to /home (unauthorized)
//   all clear             → render children
// ============================================================
import { Navigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";

export default function AdminProtectedRoute({ children }) {
  const { isAuthenticated, isFullyOnboarded, isAdmin, loading } = useAuth();

  // ── CHECK 1: Still loading? Show spinner ──
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-black">
        <div className="text-white text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center animate-pulse shadow-2xl shadow-orange-500/40">
            <i className="fa fa-shield text-xl text-white" />
          </div>
          <p className="text-sm text-gray-400 font-medium tracking-wide">
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
