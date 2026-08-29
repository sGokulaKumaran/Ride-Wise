// ============================================================
// 🚀 App.jsx — Root component
// ============================================================

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

// ─── Public pages ─────────────────────────────────────────────
import LoginPage from "./pages/landing-page/Login";
import Onboarding from "./pages/Onboarding";

// ─── Protected pages ──────────────────────────────────────────
import Account from "./pages/Account";
import Home from "./pages/Home";
import Settings from "./pages/Settings";
import Riders from "./pages/Riders";   // ← NEW

// ─── Route guard ──────────────────────────────────────────────
import ProtectedRoute from "./pages/components/shared/ProtectedRoute";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/"           element={<LoginPage />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Protected routes */}
          <Route path="/home"     element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/riders"   element={<ProtectedRoute><Riders /></ProtectedRoute>} />
          <Route path="/account"  element={<ProtectedRoute><Account /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          {/* Redirects for old/related routes */}
          <Route path="/saved"   element={<Navigate to="/home" replace />} />
          <Route path="/profile" element={<Navigate to="/account" replace />} />
          <Route path="/login"   element={<Navigate to="/" replace />} />

          {/* 404 catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}