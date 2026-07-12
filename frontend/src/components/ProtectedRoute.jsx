import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, requireAdmin = false }) => {
    const { user, token, loading } = useAuth();
    const location = useLocation();

    console.log("ProtectedRoute: Render. token:", token ? token.substring(0, 15) + "..." : "null", "user:", user ? { email: user.email, role: user.role, status: user.status } : "null", "loading:", loading);

    // Show loading spinner while fetching profile
    if (loading) {
        console.log("ProtectedRoute: Loading is true, rendering spinner");
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#090d16',
                color: '#f3f4f6',
                fontFamily: 'sans-serif'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        border: '4px solid rgba(255,255,255,0.1)',
                        borderTop: '4px solid #ef4444',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 15px auto'
                    }}></div>
                    <p style={{ fontSize: '0.9rem', color: '#9ca3af' }}>Validating user credentials...</p>
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            </div>
        );
    }

    // Guest redirection
    if (!token || !user) {
        console.warn("ProtectedRoute: Redirecting to auth page because token or user is missing. token:", !!token, "user:", !!user);
        if (!requireAdmin && location.pathname !== '/auth' && location.pathname !== '/') {
            localStorage.setItem('auth_redirect_target', location.pathname);
        }
        return <Navigate to={requireAdmin ? "/admin-login" : "/auth"} replace />;
    }

    // Admin authorization check
    if (requireAdmin) {
        if (user.role !== 'admin') {
            console.warn("ProtectedRoute: Non-admin trying to access admin page, redirecting to dashboard");
            return <Navigate to="/dashboard" replace />;
        }
    } else {
        // Enforce dedicated portal routing
        if (user.role === 'admin') {
            console.warn("ProtectedRoute: Admin trying to access user page, redirecting to admin portal");
            return <Navigate to="/admin" replace />;
        }
        
        // Enforce user approval status checks
        if (user.status !== 'approved') {
            console.warn("ProtectedRoute: Unapproved user status:", user.status, "redirecting to /pending");
            return <Navigate to="/pending" replace />;
        }
    }

    console.log("ProtectedRoute: Authorized. Rendering children.");
    return children;
};
