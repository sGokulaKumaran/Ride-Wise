import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
// BrowserRouter: enables URL-based navigation
// Routes: container for all route definitions
// Route: one URL pattern → one component
// Navigate: redirect component

import { AuthProvider, useAuth } from "./context/AuthContext";
// Wraps the entire app — makes auth state available everywhere

import { applyA11ySettings, loadA11ySettings } from "./utils/a11y";

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

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import LoginPage from "./pages/landing-page/Login";   // Public — entry point
import Onboarding from "./pages/Onboarding";          // Public — between signup and home

import Account from "./pages/Account";   // Protected
import Home from "./pages/Home";         // Protected
import Settings from "./pages/Settings"; // Protected
import Riders from "./pages/Riders";     // Protected (NEW)

import ProtectedRoute from "./pages/components/shared/ProtectedRoute";
// The "security guard" — checks auth before allowing access

export default function App() {
  return (
    <AuthProvider>           {/* Step 1: Provide auth context to entire app */}
      <A11yApplier />        {/* Step 1b: Apply saved accessibility settings */}
      <BrowserRouter>        {/* Step 2: Enable client-side routing */}
        <Routes>             {/* Step 3: Define all routes */}
          
          {/* ─── PUBLIC ROUTES (no login required) ─── */}
          <Route path="/"           element={<LoginPage />} />
          <Route path="/onboarding" element={<Onboarding />} />
          
          {/* ─── PROTECTED ROUTES (login + onboarding required) ─── */}
          <Route path="/home"     element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/riders"   element={<ProtectedRoute><Riders /></ProtectedRoute>} />
          <Route path="/account"  element={<ProtectedRoute><Account /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          
          {/* ─── REDIRECTS (old URLs → new) ─── */}
          <Route path="/saved"   element={<Navigate to="/home" replace />} />
          <Route path="/profile" element={<Navigate to="/account" replace />} />
          <Route path="/login"   element={<Navigate to="/" replace />} />
          
          {/* ─── 404 CATCH-ALL ─── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer position="bottom-right" autoClose={3000} theme="dark" />
    </AuthProvider>
  );
}