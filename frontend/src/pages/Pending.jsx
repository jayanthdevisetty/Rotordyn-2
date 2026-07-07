import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiClock, FiAlertCircle, FiSlash } from 'react-icons/fi';

export const Pending = () => {
    const { user, token, logout } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Check status parameter from URL or fall back to user context status
    const status = searchParams.get('status') || (user ? user.status : 'pending');

    useEffect(() => {
        if (!token) {
            navigate('/auth');
            return;
        }

        if (user && user.status === 'approved') {
            navigate('/dashboard');
        }
    }, [user, token, navigate]);

    const handleSignOut = () => {
        logout();
        navigate('/auth');
    };

    // Determine values to show
    let icon = <FiClock style={{ color: '#d97706' }} />;
    let title = 'Pending Admin Approval';
    let message = 'Your account is pending admin approval. You will gain access as soon as the system administrator approves your request.';

    if (status === 'rejected') {
        icon = <FiAlertCircle style={{ color: '#ef4444' }} />;
        title = 'Registration Rejected';
        message = 'Your account request has been reviewed and rejected by the administrator. Contact support if you believe this is an error.';
    } else if (status === 'blocked') {
        icon = <FiSlash style={{ color: '#dc2626' }} />;
        title = 'Account Blocked';
        message = 'This user profile has been blocked by the system administrator. Access to the diagnostics engine is restricted.';
    }

    return (
        <div style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            backgroundColor: '#f1f5f9',
            color: '#0f172a',
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundImage: `
                radial-gradient(circle at 50% 30%, rgba(37, 99, 235, 0.03) 0%, transparent 40%)
            `
        }}>
            <div className="neu-card" style={{
                width: '480px',
                padding: '40px',
                textAlign: 'center'
            }}>
                <div style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 800,
                    fontSize: '2rem',
                    letterSpacing: '-0.5px',
                    marginBottom: '30px'
                }}>
                    Rotordyn<span style={{ color: '#2563eb' }}>.ai</span>
                </div>
                
                <div style={{
                    fontSize: '3.5rem',
                    marginBottom: '24px',
                    animation: 'float 3s ease-in-out infinite',
                    display: 'flex',
                    justifyContent: 'center'
                }}>{icon}</div>
                
                <h2 style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: '1.5rem',
                    marginBottom: '12px',
                    color: '#0f172a'
                }}>{title}</h2>
                
                <p style={{
                    color: '#64748b',
                    fontSize: '0.95rem',
                    lineHeight: 1.5,
                    marginBottom: '30px'
                }}>{message}</p>
                
                <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                    <LinkToHome />
                    <button 
                        onClick={handleSignOut} 
                        className="neu-button"
                        style={{
                            padding: '12px 24px',
                            fontSize: '0.9rem'
                        }}
                    >Sign Out</button>
                </div>
            </div>
            
            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
            `}</style>
        </div>
    );
};

const LinkToHome = () => {
    const navigate = useNavigate();
    return (
        <button 
            onClick={() => navigate('/')} 
            className="neu-button"
            style={{
                background: '#2563eb',
                color: 'white',
                padding: '12px 24px',
                fontSize: '0.9rem',
                border: 'none',
                boxShadow: '5px 5px 12px #cbd5e1, -5px -5px 12px #ffffff, 0 4px 12px rgba(37, 99, 235, 0.15)'
            }}
        >Back Home</button>
    );
};
