import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#090d16', color: '#fff' }}>
    <div style={{ fontSize: '1rem', fontFamily: 'sans-serif' }}>Loading...</div>
  </div>
);

// Lazy Load Named Export Page Bundles for Chunk Optimization
const Landing = React.lazy(() => import('./pages/Landing').then(m => ({ default: m.Landing })));
const Auth = React.lazy(() => import('./pages/Auth').then(m => ({ default: m.Auth })));
const AdminLogin = React.lazy(() => import('./pages/AdminLogin').then(m => ({ default: m.AdminLogin })));
const Pending = React.lazy(() => import('./pages/Pending').then(m => ({ default: m.Pending })));
const Admin = React.lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Upload = React.lazy(() => import('./pages/Upload').then(m => ({ default: m.Upload })));
const OAuthCallback = React.lazy(() => import('./pages/OAuthCallback').then(m => ({ default: m.OAuthCallback })));
const Terms = React.lazy(() => import('./pages/Terms').then(m => ({ default: m.Terms })));
const Privacy = React.lazy(() => import('./pages/Privacy').then(m => ({ default: m.Privacy })));
const Security = React.lazy(() => import('./pages/Security').then(m => ({ default: m.Security })));
const Subscription = React.lazy(() => import('./pages/Subscription').then(m => ({ default: m.Subscription })));

function App() {
  return (
    <AuthProvider>
      <React.Suspense fallback={<PageLoader />}>
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

          {/* Protected Onboarding Upload Portal */}
          <Route 
            path="/upload" 
            element={
              <ProtectedRoute requireAdmin={false}>
                <Upload />
              </ProtectedRoute>
            } 
          />

          {/* Billing & Subscription Page */}
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
      </React.Suspense>
    </AuthProvider>
  );
}

export default App;
