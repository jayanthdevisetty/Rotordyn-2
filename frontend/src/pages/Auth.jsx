import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiArrowLeft } from 'react-icons/fi';
import { supabase } from '../supabaseClient';

export const Auth = () => {
    const { user, token, login, register, saveToken } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // UI state
    const [isRightActive, setIsRightActive] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [toastType, setToastType] = useState('error'); // 'error' or 'success'
    const [showToast, setShowToast] = useState(false);

    // Form inputs: Login
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Form inputs: Registration
    const [regFirstName, setRegFirstName] = useState('');
    const [regLastName, setRegLastName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regCompany, setRegCompany] = useState('');
    const [regPlant, setRegPlant] = useState('');
    const [regPurpose, setRegPurpose] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const getPasswordStrength = (pass) => {
        if (!pass) return { label: '', color: '', width: '0%' };
        let score = 0;
        if (pass.length >= 6) score++;
        if (pass.length >= 8) score++;
        if (/[A-Z]/.test(pass)) score++;
        if (/[a-z]/.test(pass)) score++;
        if (/[0-9]/.test(pass)) score++;
        if (/[^A-Za-z0-9]/.test(pass)) score++;

        if (score <= 2) {
            return { label: 'Weak', color: '#ef4444', width: '33%' };
        } else if (score <= 4) {
            return { label: 'Medium', color: '#f59e0b', width: '66%' };
        } else {
            return { label: 'Strong', color: '#10b981', width: '100%' };
        }
    };

    // Terms & Conditions state
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('terms'); // 'terms' or 'privacy'

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

    // Reactive redirection when user state is set/updated
    React.useEffect(() => {
        if (token && user) {
            console.log("Auth Page Redirect Effect: Token and User are present.", { email: user.email, role: user.role, status: user.status });
            
            const queryParams = new URLSearchParams(location.search);
            const redirectUrl = queryParams.get('redirect');

            if (user.role === 'admin') {
                navigate('/admin');
            } else if (user.status === 'approved') {
                if (redirectUrl) {
                    navigate(redirectUrl);
                } else {
                    navigate('/dashboard');
                }
            } else {
                navigate(`/pending?status=${user.status}`);
            }
        }
    }, [token, user, navigate, location.search]);

    const openModal = (e, type) => {
        e.preventDefault();
        e.stopPropagation();
        setModalType(type);
        setIsModalOpen(true);
    };

    const triggerToast = (msg, type = 'error') => {
        setToastMsg(msg);
        setToastType(type);
        setShowToast(true);
        setTimeout(() => {
            setShowToast(false);
        }, 4000);
    };

    const handleOAuthSignUp = (provider) => {
        if (!termsAccepted) {
            triggerToast("Please agree to the Terms of Service and Privacy Policy before registering.", "error");
            return;
        }
        supabase.auth.signInWithOAuth({
            provider: provider,
            options: { redirectTo: `${window.location.origin}/api/auth/callback/${provider}` }
        });
    };

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const { token, user } = await login(loginEmail, loginPassword);

            if (user.role === 'admin') {
                await supabase.auth.signOut();
                triggerToast('Admin profiles must log in via the dedicated <a href="/admin-login" style="color:#2563eb; font-weight:600; text-decoration:underline;">Admin Portal</a>.');
                setIsSubmitting(false);
                return;
            }

            // Save token and user - the reactive useEffect hook handles redirection
            saveToken(token, user);
            triggerToast('Login successful! Redirecting...', 'success');
        } catch (err) {
            triggerToast(err.message);
            setIsSubmitting(false);
        }
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const fullName = `${regFirstName.trim()} ${regLastName.trim()}`;
            await register(fullName, regEmail, regPassword, regCompany, regPlant, regPurpose);
            triggerToast('Registration successful! Supabase has sent a confirmation email to verify your address. Please click the link to confirm, then wait for admin approval.', 'success');
            
            setTimeout(() => {
                navigate('/pending?status=pending');
            }, 6000);

        } catch (err) {
            triggerToast(err.message);
            setIsSubmitting(false);
        }
    };

    if (token && user) {
        return (
            <div style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                backgroundColor: '#090d16',
                color: '#f3f4f6',
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        border: '4px solid rgba(255,255,255,0.1)',
                        borderTop: '4px solid #3b82f6',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 15px auto'
                    }}></div>
                    <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#9ca3af' }}>Redirecting to diagnostics workspace...</p>
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
        <div className="auth-body" style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            backgroundColor: '#f1f5f9',
            color: '#0f172a',
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundImage: `
                radial-gradient(circle at 20% 30%, rgba(37, 99, 235, 0.04) 0%, transparent 40%),
                radial-gradient(circle at 80% 70%, rgba(16, 185, 129, 0.03) 0%, transparent 40%)
            `
        }}>
            <Link to="/" style={{
                position: 'absolute',
                top: '30px',
                left: '30px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '50px',
                background: '#f1f5f9',
                border: 'none',
                color: '#0f172a',
                fontWeight: 700,
                fontSize: '0.85rem',
                textDecoration: 'none',
                boxShadow: '4px 4px 10px #cbd5e1, -4px -4px 10px #ffffff',
                transition: 'all 0.3s ease',
                zIndex: 1000
            }}>
                <FiArrowLeft style={{ fontSize: '1rem', strokeWidth: '3' }} /> Back to Home
            </Link>

            <div className={`auth-container neu-card ${isRightActive ? 'right-panel-active' : ''}`} id="auth-card">
                
                {/* Register Form Panel */}
                <div className="form-container sign-up-container">
                    <form onSubmit={handleRegisterSubmit} autoComplete="off" style={{ padding: '25px 40px', justifyContent: 'flex-start', overflowY: 'auto' }}>
                        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.8rem', fontWeight: 800, marginBottom: '20px', color: '#0f172a' }}>Create Account</h2>
                        
                        <div style={{ display: 'flex', gap: '15px', width: '100%' }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>First Name</label>
                                <input 
                                    type="text" 
                                    className="neu-input"
                                    required 
                                    placeholder="John"
                                    autoComplete="given-name"
                                    value={regFirstName}
                                    onChange={(e) => setRegFirstName(e.target.value)}
                                />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Last Name</label>
                                <input 
                                    type="text" 
                                    className="neu-input"
                                    required 
                                    placeholder="Doe"
                                    autoComplete="family-name"
                                    value={regLastName}
                                    onChange={(e) => setRegLastName(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Email Address</label>
                            <input 
                                type="email" 
                                name="email"
                                id="signup-email"
                                className="neu-input"
                                required 
                                placeholder="e.g. john@company.com"
                                autoComplete="email"
                                value={regEmail}
                                onChange={(e) => setRegEmail(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>Password</label>
                            <input 
                                type="password" 
                                name="password"
                                id="signup-password"
                                className="neu-input"
                                required 
                                placeholder="At least 6 characters"
                                autoComplete="new-password"
                                value={regPassword}
                                onChange={(e) => setRegPassword(e.target.value)}
                            />
                            {regPassword && (() => {
                                const strength = getPasswordStrength(regPassword);
                                return (
                                    <div style={{ marginTop: '6px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Password Strength:</span>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: strength.color }}>{strength.label}</span>
                                        </div>
                                        <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                                            <div style={{ width: strength.width, height: '100%', backgroundColor: strength.color, transition: 'all 0.3s' }} />
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="form-group">
                            <label>Company / Organization</label>
                            <input 
                                type="text" 
                                name="organization"
                                id="signup-organization"
                                className="neu-input"
                                required 
                                placeholder="e.g. Siemens Energy"
                                autoComplete="organization"
                                value={regCompany}
                                onChange={(e) => setRegCompany(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>Plant Location</label>
                            <input 
                                type="text" 
                                name="plant"
                                id="signup-plant"
                                className="neu-input"
                                required 
                                placeholder="e.g. Houston Plant"
                                value={regPlant}
                                onChange={(e) => setRegPlant(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>Intended Purpose</label>
                            <textarea 
                                className="neu-input"
                                placeholder="Describe the machinery data you plan to analyze..."
                                value={regPurpose}
                                onChange={(e) => setRegPurpose(e.target.value)}
                            ></textarea>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '15px 0', textAlign: 'left' }}>
                            <input 
                                type="checkbox" 
                                id="accept-terms" 
                                checked={termsAccepted}
                                onChange={(e) => setTermsAccepted(e.target.checked)}
                                style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer', flexShrink: 0 }}
                            />
                            <label htmlFor="accept-terms" style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4', cursor: 'pointer', userSelect: 'none' }}>
                                I agree to the <span onClick={() => window.open('/terms', '_blank')} style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 600, cursor: 'pointer' }}>Terms of Service</span> and <span onClick={() => window.open('/privacy', '_blank')} style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 600, cursor: 'pointer' }}>Privacy Policy</span>, granting permission to process anonymized telemetry data for AI/ML training model optimization.
                            </label>
                        </div>

                        <button 
                            type="submit" 
                            className="submit-btn" 
                            disabled={!termsAccepted || isSubmitting}
                            style={{ 
                                opacity: (termsAccepted && !isSubmitting) ? 1 : 0.5, 
                                cursor: (termsAccepted && !isSubmitting) ? 'pointer' : 'not-allowed',
                                marginTop: '10px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="btn-spinner" /> Registering...
                                </>
                            ) : 'Register Account'}
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', width: '100%' }}>
                            <div style={{ flex: 1, height: '1px', backgroundColor: '#cbd5e1' }} />
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', padding: '0 10px', textTransform: 'uppercase', fontWeight: 600 }}>Or continue with</span>
                            <div style={{ flex: 1, height: '1px', backgroundColor: '#cbd5e1' }} />
                        </div>

                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', width: '100%', marginBottom: '10px' }}>
                            {/* Google Sign-in */}
                            <button 
                                type="button"
                                onClick={() => handleOAuthSignUp('google')}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    backgroundColor: '#f1f5f9',
                                    border: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '4px 4px 10px #cbd5e1, -4px -4px 10px #ffffff',
                                    transition: 'all 0.2s',
                                    gap: '8px',
                                    fontSize: '0.8rem',
                                    fontWeight: '600',
                                    color: '#0f172a'
                                }}
                            >
                                <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                                </svg>
                                Google
                            </button>

                            {/* GitHub Sign-in */}
                            <button 
                                type="button"
                                onClick={() => handleOAuthSignUp('github')}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    backgroundColor: '#f1f5f9',
                                    border: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '4px 4px 10px #cbd5e1, -4px -4px 10px #ffffff',
                                    transition: 'all 0.2s',
                                    gap: '8px',
                                    fontSize: '0.8rem',
                                    fontWeight: '600',
                                    color: '#0f172a'
                                }}
                            >
                                <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="currentColor">
                                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                                </svg>
                                GitHub
                            </button>
                        </div>

                        <p className="mobile-toggle-link" onClick={() => setIsRightActive(false)} style={{ color: '#2563eb' }}>
                            Already have an account? Sign In here
                        </p>
                    </form>
                </div>

                {/* Login Form Panel */}
                <div className="form-container sign-in-container">
                    <form onSubmit={handleLoginSubmit}>
                        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.8rem', fontWeight: 800, marginBottom: '20px', color: '#0f172a' }}>Sign In</h2>
                        
                        <div className="form-group">
                            <label>Email Address</label>
                            <input 
                                type="email" 
                                name="email"
                                id="signin-email"
                                className="neu-input"
                                required 
                                placeholder="e.g. john@company.com"
                                autoComplete="username"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>Password</label>
                            <input 
                                type="password" 
                                name="password"
                                id="signin-password"
                                className="neu-input"
                                required 
                                placeholder="Enter password"
                                autoComplete="current-password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                            />
                        </div>

                        <button 
                            type="submit" 
                            className="submit-btn" 
                            disabled={isSubmitting}
                            style={{
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
                                    <div className="btn-spinner" /> Signing In...
                                </>
                            ) : 'Sign In'}
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0 15px', width: '100%' }}>
                            <div style={{ flex: 1, height: '1px', backgroundColor: '#cbd5e1' }} />
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', padding: '0 10px', textTransform: 'uppercase', fontWeight: 600 }}>Or continue with</span>
                            <div style={{ flex: 1, height: '1px', backgroundColor: '#cbd5e1' }} />
                        </div>

                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', width: '100%', marginBottom: '10px' }}>
                            {/* Google Sign-in */}
                            <button 
                                type="button"
                                onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/api/auth/callback/google` } })}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    backgroundColor: '#f1f5f9',
                                    border: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '4px 4px 10px #cbd5e1, -4px -4px 10px #ffffff',
                                    transition: 'all 0.2s',
                                    gap: '8px',
                                    fontSize: '0.8rem',
                                    fontWeight: '600',
                                    color: '#0f172a'
                                }}
                            >
                                <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                                </svg>
                                Google
                            </button>

                            {/* GitHub Sign-in */}
                            <button 
                                type="button"
                                onClick={() => supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: `${window.location.origin}/api/auth/callback/github` } })}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    backgroundColor: '#f1f5f9',
                                    border: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '4px 4px 10px #cbd5e1, -4px -4px 10px #ffffff',
                                    transition: 'all 0.2s',
                                    gap: '8px',
                                    fontSize: '0.8rem',
                                    fontWeight: '600',
                                    color: '#0f172a'
                                }}
                            >
                                <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="currentColor">
                                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                                </svg>
                                GitHub
                            </button>
                        </div>

                        <p className="mobile-toggle-link" onClick={() => setIsRightActive(true)} style={{ color: '#2563eb' }}>
                            Don't have an account? Register here
                        </p>
                    </form>
                </div>

                {/* Sliding Visual Panels Overlay */}
                <div className="overlay-container">
                    <div className="overlay">
                        {/* Overlay Left */}
                        <div className="overlay-panel overlay-left">
                            <h1>Welcome Back!</h1>
                            <p>To analyze machinery telemetry and view diagnostic reports, please sign in with your credential profile.</p>
                            <button className="ghost-btn" onClick={() => setIsRightActive(false)} type="button">Sign In</button>
                        </div>
                        {/* Overlay Right */}
                        <div className="overlay-panel overlay-right">
                            <h1>Join Rotordyn.ai</h1>
                            <p>Sign up to analyze vibration speed waveforms and generate dynamic rotor diagnostic dashboards.</p>
                            <button className="ghost-btn" onClick={() => setIsRightActive(true)} type="button">Create Account</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification Toast */}
            {showToast && (
                <div className={`toast show ${toastType === 'success' ? 'success' : ''}`}
                    dangerouslySetInnerHTML={{ __html: toastMsg }}
                ></div>
            )}

            {/* Legal Policies Modal */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 2000,
                    backdropFilter: 'blur(8px)'
                }}>
                    <div className="neu-card" style={{
                        width: '600px',
                        maxWidth: '90%',
                        maxHeight: '80vh',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '30px',
                        border: 'none',
                        boxShadow: '8px 8px 24px #cbd5e1, -8px -8px 24px #ffffff'
                    }}>
                        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.4rem', fontWeight: 700, borderBottom: '1px solid #cbd5e1', paddingBottom: '15px', color: '#0f172a' }}>
                            {modalType === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
                        </h3>
                        
                        <div style={{
                            overflowY: 'auto',
                            flexGrow: 1,
                            margin: '20px 0',
                            textAlign: 'left',
                            fontSize: '0.85rem',
                            lineHeight: '1.6',
                            color: '#475569',
                            paddingRight: '10px'
                        }}>
                            {modalType === 'terms' ? (
                                <>
                                    <p style={{ marginBottom: '12px', fontWeight: 600, color: '#0f172a' }}>1. Telemetry Data License for ML/AI Training</p>
                                    <p style={{ marginBottom: '20px' }}>
                                        By utilizing Rotordyn.ai and uploading machinery vibration spreadsheets (CSV, XLS, XLSX), you grant the platform a worldwide, non-exclusive, royalty-free, perpetual license to host, parse, and utilize your telemetry data strictly in de-identified, anonymized formats for the purpose of training machine learning, artificial intelligence diagnostic models, and optimizing machinery fault identification algorithms.
                                    </p>
                                    <p style={{ marginBottom: '12px', fontWeight: 600, color: '#0f172a' }}>2. Data Anonymization Standards</p>
                                    <p style={{ marginBottom: '20px' }}>
                                        Rotordyn.ai strictly enforces telemetry anonymization. Prior to using any uploaded spreadsheets for training, we strip all user profile associations, company names, specific site locations, specific timestamps, and custom sensor tags. Only raw engineering coordinates (RPM, Amplitude, Phase, Gap Voltage, Frequency spectra) are processed.
                                    </p>
                                    <p style={{ marginBottom: '12px', fontWeight: 600, color: '#0f172a' }}>3. Limitation of Liability & Advisory Scope</p>
                                    <p style={{ marginBottom: '20px' }}>
                                        Vibration diagnostics calculations, 3D orbits, polar plots, and mode shape calculations are advisory only. Rotordyn.ai provides automated tool insights but does not replace certified ISO Vibration Analyst reviews. The platform accepts no liability for decisions made based on its outputs, machinery downtime, catastrophic failure, or financial loss.
                                    </p>
                                    <p style={{ marginBottom: '12px', fontWeight: 600, color: '#0f172a' }}>4. Administrator Privileges</p>
                                    <p style={{ marginBottom: '20px' }}>
                                        Accounts are subject to administrator approval. The administration reserves the right to reject, restrict, block, or delete any profile at its sole discretion for violation of system guidelines.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p style={{ marginBottom: '12px', fontWeight: 600, color: '#0f172a' }}>1. Information We Collect</p>
                                    <p style={{ marginBottom: '20px' }}>
                                        We collect user profile metadata (Name, Email, Company Name, Intended Purpose) and uploaded turbomachinery vibration log streams.
                                    </p>
                                    <p style={{ marginBottom: '12px', fontWeight: 600, color: '#0f172a' }}>2. Telemetry Processing & Security</p>
                                    <p style={{ marginBottom: '20px' }}>
                                        Uploaded dataset files are stored on secure local server nodes and processed inside the active browser sandbox. Telemetry values are parsed in the client window and are only transmitted to the server when utilizing cloud-save features. Transmitted telemetry files are subject to strict de-identification rules.
                                    </p>
                                    <p style={{ marginBottom: '12px', fontWeight: 600, color: '#0f172a' }}>3. Third-Party Sharing</p>
                                    <p style={{ marginBottom: '20px' }}>
                                        Rotordyn.ai does not share, rent, or sell your proprietary turbomachinery datasets, company information, or email addresses with external advertisers or commercial entities. All data processing is strictly handled inside our secure cloud system nodes.
                                    </p>
                                </>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #cbd5e1', paddingTop: '15px' }}>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                style={{
                                    background: '#2563eb',
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 20px',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    boxShadow: '4px 4px 10px #cbd5e1, -4px -4px 10px #ffffff'
                                }}
                            >Accept & Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Collapsible Diagnostic Console overlay (development environments only) */}
            {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
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
            )}
        </div>
    );
};
