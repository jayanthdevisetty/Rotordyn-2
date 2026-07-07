import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

export const AdminLogin = () => {
    const { user, token, login, saveToken } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [toastMsg, setToastMsg] = useState('');
    const [toastType, setToastType] = useState('error');
    const [showToast, setShowToast] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reactive redirection when admin user state is verified
    React.useEffect(() => {
        if (token && user) {
            console.log("Admin Login Page: Authenticated. Routing...", { email: user.email, role: user.role });
            if (user.role === 'admin') {
                navigate('/admin');
            } else {
                navigate('/dashboard');
            }
        }
    }, [token, user, navigate]);

    // Debug console state
    const [debugLogs, setDebugLogs] = useState(window.debugLogs || []);
    const [isDebugOpen, setIsDebugOpen] = useState(false);

    React.useEffect(() => {
        const syncLogs = () => {
            setDebugLogs([...window.debugLogs]);
        };
        window.onDebugLogAdded = syncLogs;
        syncLogs(); // Sync initially
        return () => {
            window.onDebugLogAdded = null;
        };
    }, []);

    const triggerToast = (msg, type = 'error') => {
        setToastMsg(msg);
        setToastType(type);
        setShowToast(true);
        setTimeout(() => {
            setShowToast(false);
        }, 4000);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const { token, user } = await login(email, password);

            if (user.role !== 'admin') {
                await supabase.auth.signOut();
                triggerToast('Access denied. This login page is reserved for administrators only.');
                setIsSubmitting(false);
                return;
            }

            // Save token and user - redirection handled reactively by useEffect
            saveToken(token, user);
            triggerToast('Authentication successful! Routing to admin portal...', 'success');
        } catch (err) {
            triggerToast(err.message);
            setIsSubmitting(false);
        }
    };

    if (token && user) {
        return (
            <div style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                backgroundColor: '#f1f5f9',
                color: '#0f172a',
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        border: '4px solid rgba(0,0,0,0.1)',
                        borderTop: '4px solid #2563eb',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 15px auto'
                    }}></div>
                    <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#475569' }}>Authenticated. Routing to Admin Portal...</p>
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
            <Link to="/" style={{
                position: 'absolute',
                top: '30px',
                left: '30px',
                color: '#64748b',
                textDecoration: 'none',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'color 0.3s'
            }}>&larr; Back to Landing Page</Link>

            <div className="neu-card" style={{
                width: '420px',
                padding: '40px',
                textAlign: 'center'
            }}>
                <div style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 800,
                    fontSize: '1.8rem',
                    letterSpacing: '-0.5px',
                    marginBottom: '8px'
                }}>
                    Rotordyn<span style={{ color: '#2563eb' }}>Admin</span>
                </div>
                <div style={{
                    fontSize: '0.85rem',
                    color: '#64748b',
                    marginBottom: '30px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    fontWeight: 600
                }}>System Portal Access</div>

                <form onSubmit={handleSubmit} style={{ padding: 0 }}>
                    <div style={{ width: '100%', marginBottom: '18px', textAlign: 'left' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            color: '#64748b',
                            marginBottom: '5px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>Admin Email Address</label>
                        <input 
                            type="email" 
                            className="neu-input"
                            required 
                            placeholder="e.g. admin@rotordyn.ai"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ width: '100%', marginBottom: '18px', textAlign: 'left' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            color: '#64748b',
                            marginBottom: '5px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>Admin Password</label>
                        <input 
                            type="password" 
                            className="neu-input"
                            required 
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="submit-btn" 
                        disabled={isSubmitting}
                        style={{ 
                            width: '100%', 
                            marginTop: '15px',
                            opacity: isSubmitting ? 0.7 : 1,
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="btn-spinner" /> Authenticating...
                            </>
                        ) : 'Authenticate Admin'}
                    </button>
                </form>

                <Link to="/auth" style={{
                    display: 'inline-block',
                    marginTop: '20px',
                    color: '#64748b',
                    textDecoration: 'none',
                    fontSize: '0.85rem'
                }}>&larr; Switch to User Portal</Link>
            </div>

            {/* Notification Toast */}
            {showToast && (
                <div className={`toast show ${toastType === 'success' ? 'success' : ''}`}
                    dangerouslySetInnerHTML={{ __html: toastMsg }}
                ></div>
            )}
            {/* Collapsible Diagnostic Console overlay */}
            <div style={{
                position: 'fixed',
                bottom: '16px',
                right: '16px',
                width: isDebugOpen ? '500px' : '180px',
                height: isDebugOpen ? '320px' : '36px',
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 9999,
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                border: '1px solid #475569',
                transition: 'all 0.3s ease'
            }}>
                <div 
                    onClick={() => setIsDebugOpen(!isDebugOpen)}
                    style={{
                        padding: '8px 12px',
                        backgroundColor: '#0f172a',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        userSelect: 'none'
                    }}
                >
                    <span>⚙️ Diagnostic Console</span>
                    <span>{isDebugOpen ? '▼' : '▲'}</span>
                </div>
                {isDebugOpen && (
                    <>
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            backgroundColor: '#111827'
                        }}>
                            {debugLogs.length === 0 ? (
                                <p style={{ color: '#94a3b8', margin: 0 }}>No console logs captured...</p>
                            ) : (
                                debugLogs.map((log, idx) => (
                                    <div key={idx} style={{
                                        color: log.type === 'error' ? '#f87171' : log.type === 'warn' ? '#fbbf24' : '#cbd5e1',
                                        borderBottom: '1px solid #1f2937',
                                        paddingBottom: '2px',
                                        wordBreak: 'break-all'
                                    }}>
                                        [{log.time}] [{log.type.toUpperCase()}] {log.text}
                                    </div>
                                ))
                            )}
                        </div>
                        <div style={{
                            padding: '6px 12px',
                            backgroundColor: '#0f172a',
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '8px'
                        }}>
                            <button 
                                onClick={() => {
                                    const text = debugLogs.map(l => `[${l.time}] [${l.type.toUpperCase()}] ${l.text}`).join('\n');
                                    navigator.clipboard.writeText(text);
                                    alert('Copied diagnostic logs to clipboard!');
                                }}
                                style={{
                                    flex: 1,
                                    padding: '4px',
                                    backgroundColor: '#2563eb',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '0.7rem'
                                }}
                            >
                                Copy Logs
                            </button>
                            <button 
                                onClick={() => {
                                    window.debugLogs = [];
                                    setDebugLogs([]);
                                }}
                                style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '0.7rem'
                                }}
                            >
                                Clear
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
