import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const OAuthCallback = ({ provider }) => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { saveToken, API_BASE_URL, token, user, loading } = useAuth();
    const [error, setError] = useState(null);

    useEffect(() => {
        // 1. If already logged in, redirect immediately based on status
        if (token && user) {
            console.log("OAuthCallback: Session active, redirecting to appropriate workspace.");
            const redirectUrl = sessionStorage.getItem('auth_redirect_target');
            if (user.status === 'approved') {
                if (redirectUrl) {
                    sessionStorage.removeItem('auth_redirect_target');
                    navigate(redirectUrl);
                } else {
                    navigate('/dashboard');
                }
            } else {
                navigate('/pending');
            }
            return;
        }

        // 2. If auth state is still loading, wait for it
        if (loading) return;

        // 3. If token is already present (exchanged by SDK or cached), wait for user profile to load
        if (token) {
            console.log("OAuthCallback: Token present, waiting for user profile to load...");
            return;
        }

        // 4. Extract PKCE code parameter
        const code = searchParams.get('code');
        if (!code) {
            setError('Missing authorization code from provider.');
            return;
        }

        const exchangeCode = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/auth/${provider}/callback`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.detail || 'OAuth authentication failed.');
                }

                const data = await response.json();

                // Retrieve profile immediately to avoid redirection race conditions in ProtectedRoute
                const profileRes = await fetch(`${API_BASE_URL}/auth/me?t=${Date.now()}`, {
                    headers: { 'Authorization': `Bearer ${data.access_token}` },
                    cache: 'no-store'
                });
                if (!profileRes.ok) {
                    throw new Error('Failed to retrieve user profile.');
                }
                const profile = await profileRes.json();

                saveToken(data.access_token, profile);

                // Redirect based on user approval status
                const redirectUrl = sessionStorage.getItem('auth_redirect_target');
                if (profile.status === 'approved') {
                    if (redirectUrl) {
                        sessionStorage.removeItem('auth_redirect_target');
                        navigate(redirectUrl);
                    } else {
                        navigate('/dashboard');
                    }
                } else {
                    navigate('/pending');
                }
            } catch (err) {
                console.error(err);
                if (sessionStorage.getItem('token')) {
                    console.log("OAuthCallback: Session token is already active, ignoring callback error.");
                    return;
                }
                setError(err.message || 'An unexpected authentication error occurred.');
            }
        };

        // Delay manual exchange to allow client SDK automatic exchange to finish first
        const timer = setTimeout(() => {
            if (sessionStorage.getItem('token')) {
                console.log("OAuthCallback: Session token is already active, skipping manual exchange.");
                return;
            }
            console.log("OAuthCallback: Initiating manual code exchange...");
            exchangeCode();
        }, 1200);

        return () => clearTimeout(timer);
    }, [searchParams, provider, API_BASE_URL, saveToken, navigate, token, user, loading]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            width: '100vw',
            backgroundColor: 'var(--bg-color)',
            color: 'var(--text-color)',
            fontFamily: "'Outfit', sans-serif"
        }}>
            <div className="neu-card" style={{
                padding: '40px',
                borderRadius: '16px',
                textAlign: 'center',
                maxWidth: '400px',
                boxShadow: '6px 6px 16px #cbd5e1, -6px -6px 16px #ffffff'
            }}>
                {error ? (
                    <>
                        <h2 style={{ color: '#ef4444', marginBottom: '15px', fontSize: '1.4rem' }}>Authentication Failed</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.5' }}>{error}</p>
                        <button 
                            className="neu-button" 
                            onClick={() => navigate('/auth')}
                            style={{
                                padding: '10px 20px',
                                borderRadius: '8px',
                                background: 'var(--bg-color)',
                                border: 'none',
                                fontWeight: '600',
                                color: 'var(--accent-color)',
                                cursor: 'pointer',
                                boxShadow: '4px 4px 10px #cbd5e1, -4px -4px 10px #ffffff'
                            }}
                        >
                            Return to Login
                        </button>
                    </>
                ) : (
                    <>
                        <div style={{
                            width: '50px',
                            height: '50px',
                            border: '4px solid var(--border-color)',
                            borderTop: '4px solid var(--accent-color)',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 20px'
                        }} />
                        <h2 style={{ marginBottom: '10px', fontSize: '1.2rem' }}>Completing Sign-In</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Exchanging secure authorization code with Rotordyn.ai...</p>
                        <style>{`
                            @keyframes spin {
                                0% { transform: rotate(0deg); }
                                100% { transform: rotate(360deg); }
                            }
                        `}</style>
                    </>
                )}
            </div>
        </div>
    );
};
