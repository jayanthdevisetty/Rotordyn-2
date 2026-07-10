import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Import Pages
import { Landing } from './pages/Landing';
import { Auth } from './pages/Auth';
import { AdminLogin } from './pages/AdminLogin';
import { Pending } from './pages/Pending';
import { Admin } from './pages/Admin';
import { Dashboard } from './pages/Dashboard';
import { OAuthCallback } from './pages/OAuthCallback';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';
import { Security } from './pages/Security';
import { Subscription } from './pages/Subscription';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<Landing />} />

        {/* User Auth (Login/Register Slider) */}
        <Route path="/auth" element={<Auth />} />

        {/* Public Policy Pages */}
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/security" element={<Security />} />

        {/* OAuth Callback Endpoints */}
        <Route path="/api/auth/callback/google" element={<OAuthCallback provider="google" />} />
        <Route path="/api/auth/callback/github" element={<OAuthCallback provider="github" />} />

        {/* Dedicated Admin Login */}
        <Route path="/admin-login" element={<AdminLogin />} />

        {/* Pending Approval Redirect Screen */}
        <Route path="/pending" element={<Pending />} />

        {/* Protected Diagnostics Workspace */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute requireAdmin={false}>
              <Dashboard />
            </ProtectedRoute>
          } 
        />

        {/* Protected Billing & Subscription Page */}
        <Route 
          path="/subscription" 
          element={
            <ProtectedRoute requireAdmin={false}>
              <Subscription />
            </ProtectedRoute>
          } 
        />

        {/* Protected Admin Portal */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute requireAdmin={true}>
              <Admin />
            </ProtectedRoute>
          } 
        />

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
