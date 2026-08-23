// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Landing / Auth
import Landing from "./pages/landing-page/Landing";
import Login from "./pages/landing-page/Login";

// Core pages
import Home from "./pages/Home";
import BikeDetail from "./pages/BikeDetail";
import Marketplace from "./pages/Marketplace";
import Live from "./pages/Live";
import Messages from "./pages/Messages";
import Search from "./pages/Search";
import Community from "./pages/Community";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing & Auth */}
        <Route path="/"       element={<Landing />} />
        <Route path="/login"  element={<Login />} />

        {/* Main App */}
        <Route path="/home"        element={<Home />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/live"        element={<Live />} />
        <Route path="/messages"    element={<Messages />} />
        <Route path="/search"      element={<Search />} />
        <Route path="/community"   element={<Community />} />

        {/* Detail Pages */}
        <Route path="/bike/:id"    element={<BikeDetail />} />

        {/* Fallback redirects for unbuilt pages */}
        <Route path="/plan-ride"   element={<Navigate to="/home" replace />} />
        <Route path="/saved"       element={<Navigate to="/home" replace />} />
        <Route path="/profile"     element={<Navigate to="/home" replace />} />
        <Route path="/share"       element={<Navigate to="/home" replace />} />
        <Route path="/sell"        element={<Navigate to="/marketplace" replace />} />
        <Route path="/ride/:id"    element={<Navigate to="/home" replace />} />

        {/* 404 → home */}
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
