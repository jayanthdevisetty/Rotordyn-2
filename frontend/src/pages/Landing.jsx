import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiTrendingUp, FiSliders, FiFolder, FiArrowRight } from 'react-icons/fi';
import logoImg from '../assets/logo.png';
import { useAuth } from '../context/AuthContext';

export const Landing = () => {
    const { token, user, loading } = useAuth();
    const navigate = useNavigate();
    const [showIntro, setShowIntro] = useState(!localStorage.getItem('token') && !localStorage.getItem('hasWatchedIntro'));

    const dismissIntro = () => {
        localStorage.setItem('hasWatchedIntro', 'true');
        setShowIntro(false);
    };

    useEffect(() => {
        if (token && user) {
            if (user.role === 'admin') {
                navigate('/admin');
            } else if (user.status === 'approved') {
                navigate('/dashboard');
            } else {
                navigate(`/pending?status=${user.status}`);
            }
        }
    }, [token, user, navigate]);

    if (loading && localStorage.getItem('token')) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: '#090d16',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 99999
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid rgba(255, 255, 255, 0.1)',
                    borderTop: '3px solid #3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }} />
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    if (showIntro) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: '#090d16',
                zIndex: 99999,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden'
            }}>
                <video
                    src="/intro.mp4"
                    autoPlay
                    muted
                    playsInline
                    onEnded={dismissIntro}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    }}
                />
                <button
                    onClick={dismissIntro}
                    style={{
                        position: 'absolute',
                        top: '24px',
                        right: '24px',
                        backgroundColor: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#f8fafc',
                        padding: '10px 20px',
                        borderRadius: '30px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        zIndex: 100000,
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                    }}
                >
                    Skip Intro <FiArrowRight />
                </button>
            </div>
        );
    }

    return (
        <div style={{
            backgroundColor: '#f1f5f9',
            color: '#0f172a',
            minHeight: '100vh',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            position: 'relative',
            overflowX: 'hidden',
        }}>
            {/* Dynamic CSS Animated Background Glows */}
            <div className="bg-glow bg-glow-red"></div>
            <div className="bg-glow bg-glow-blue"></div>

            {/* Navigation Header */}
            <nav style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '24px 8%',
                borderBottom: 'none',
                backdropFilter: 'blur(16px)',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                background: 'rgba(241, 245, 249, 0.85)',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)'
            }}>
                <div style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 800,
                    fontSize: '1.7rem',
                    letterSpacing: '-0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <img src={logoImg} alt="Rotordyn Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                    Rotordyn<span style={{ color: '#2563eb' }}>.ai</span>
                </div>
                <div style={{ display: 'flex', gap: '35px', alignItems: 'center' }}>
                    <a href="#features" className="nav-link-item nav-hide-mobile">Features</a>
                    <a href="#workflow" className="nav-link-item nav-hide-mobile">Workflow</a>
                    <Link to="/security" className="nav-link-item nav-hide-mobile">Security</Link>
                    <Link to="/auth" className="nav-link-item" style={{ color: '#475569' }}>Sign In</Link>
                    <Link to="/auth" className="btn-glow-cta" style={{
                        background: '#2563eb',
                        color: 'white',
                        padding: '11px 24px',
                        borderRadius: '10px',
                        textDecoration: 'none',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        boxShadow: '5px 5px 12px #cbd5e1, -5px -5px 12px #ffffff',
                        transition: 'all 0.3s ease'
                    }}>Launch Workspace</Link>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="landing-hero" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '100px 8% 60px 8%',
                maxWidth: '1200px',
                margin: '0 auto',
                position: 'relative',
                zIndex: 10
            }}>
                <div className="badge-pulse" style={{
                    background: '#f1f5f9',
                    color: '#2563eb',
                    padding: '8px 18px',
                    borderRadius: '50px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    marginBottom: '28px',
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: 'inset 3px 3px 6px #cbd5e1, inset -3px -3px 6px #ffffff'
                }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'inline-block' }}></span>
                    Phase II Automated Diagnostics
                </div>
                
                <h1 style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: '4.5rem',
                    fontWeight: 900,
                    lineHeight: 1.1,
                    marginBottom: '24px',
                    letterSpacing: '-2px',
                    color: '#0f172a'
                }}>
                    <span style={{
                        fontSize: 'inherit',
                        background: 'linear-gradient(135deg, #2563eb 0%, #10b981 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textShadow: '0 0 40px rgba(37, 99, 235, 0.05)'
                    }}>Machinery Diagnostics</span>
                </h1>
                
                <p style={{
                    fontSize: '1.25rem',
                    color: '#475569',
                    lineHeight: 1.6,
                    marginBottom: '40px',
                    maxWidth: '820px'
                }}>
                    An advanced machinery diagnostics engine designed for critical rotating equipment. Upload startup, steady-state, or coastdown datasets, plot Trend, Bode, Polar, Orbit, and Shaft Centerline, and let automated AI execute malfunction diagnostics — all in a secure workspace.
                </p>
                
                <div style={{ display: 'flex', gap: '25px', marginBottom: '80px' }}>
                    <Link to="/auth" className="btn-glow-cta" style={{
                        background: '#2563eb',
                        color: 'white',
                        padding: '16px 36px',
                        borderRadius: '12px',
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                        boxShadow: '6px 6px 16px #cbd5e1, -6px -6px 16px #ffffff',
                        transition: 'all 0.3s ease'
                    }}>Get Started Free</Link>
                    <a href="#features" className="nav-link-item ExploreFeaturesBtn" style={{
                        padding: '16px 36px',
                        borderRadius: '12px',
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        border: 'none',
                        color: '#0f172a',
                        backgroundColor: '#f1f5f9',
                        boxShadow: '6px 6px 16px #cbd5e1, -6px -6px 16px #ffffff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.25s'
                    }} onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '3px 3px 8px #cbd5e1, -3px -3px 8px #ffffff'; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '6px 6px 16px #cbd5e1, -6px -6px 16px #ffffff'; }}>Explore Features <FiArrowRight /></a>
                </div>
            </div>

            {/* Features Showcase Section */}
            <section id="features" style={{
                padding: '100px 8%',
                maxWidth: '1200px',
                margin: '0 auto',
                position: 'relative',
                zIndex: 10
            }}>
                <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                    <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '2.5rem', fontWeight: 800, marginBottom: '15px', color: '#0f172a' }}>Machinery Diagnostics Suite</h2>
                    <p style={{ color: '#475569', fontSize: '1.05rem', maxWidth: '650px', margin: '0 auto' }}>Equipped with standard industrial plotting specifications to provide direct turbomachinery analysis workflows.</p>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: '35px'
                }}>
                    <div className="feature-card-glass" style={{ transition: 'all 0.25s ease' }}>
                        <div className="feature-icon-box" style={{ background: '#f1f5f9', boxShadow: 'inset 3px 3px 6px #cbd5e1, inset -3px -3px 6px #ffffff', color: '#2563eb' }}><FiTrendingUp /></div>
                        <h3>Interactive Orbit Overlay</h3>
                        <p>Evaluate shaft orbits, centerline traces, and centerline orbit overlays with raw direct and filtered nX amplitude configurations.</p>
                    </div>
                    
                    <div className="feature-card-glass" style={{ transition: 'all 0.25s ease' }}>
                        <div className="feature-icon-box" style={{ background: '#f1f5f9', boxShadow: 'inset 3px 3px 6px #cbd5e1, inset -3px -3px 6px #ffffff', color: '#10b981' }}><FiSliders /></div>
                        <h3>Dynamic Timeline Slider</h3>
                        <p>Drag the Range Box edges along the speed timeline to isolate any sweep you want to analyze.</p>
                    </div>

                    <div className="feature-card-glass" style={{ transition: 'all 0.25s ease' }}>
                        <div className="feature-icon-box" style={{ background: '#f1f5f9', boxShadow: 'inset 3px 3px 6px #cbd5e1, inset -3px -3px 6px #ffffff', color: '#4f46e5' }}><FiFolder /></div>
                        <h3>Secure Session Storage</h3>
                        <p>Encrypted, versioned storage for every dataset you upload — your analysis pipeline stays organized and auditable, with nothing exposed at the infrastructure level.</p>
                    </div>
                </div>
            </section>

            {/* Workflow / How it works Section */}
            <section id="workflow" style={{
                padding: '80px 8% 120px 8%',
                maxWidth: '1200px',
                margin: '0 auto',
                position: 'relative',
                zIndex: 10,
                borderTop: 'none'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '70px', marginTop: '40px' }}>
                    <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '2.5rem', fontWeight: 800, marginBottom: '15px', color: '#0f172a' }}>Simple Analysis Workflow</h2>
                    <p style={{ color: '#475569', fontSize: '1.05rem' }}>Diagnose rotor mechanical faults in three straightforward steps.</p>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '40px'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div className="step-number" style={{ background: '#f1f5f9', color: '#2563eb', boxShadow: '5px 5px 12px #cbd5e1, -5px -5px 12px #ffffff' }}>01</div>
                        <h4 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '15px 0 10px 0', fontFamily: "'Outfit', sans-serif", color: '#0f172a' }}>Secure Upload</h4>
                        <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>Upload CSV or Excel sheets via the drag & drop zone. Datasets are encrypted in transit and at rest, then queued for processing.</p>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <div className="step-number" style={{ background: '#f1f5f9', color: '#3b82f6', boxShadow: '5px 5px 12px #cbd5e1, -5px -5px 12px #ffffff' }}>02</div>
                        <h4 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '15px 0 10px 0', fontFamily: "'Outfit', sans-serif", color: '#0f172a' }}>Timeline Scrubbing</h4>
                        <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>Drag and adjust the range slider box on the speed profile to isolate key startup, steady state, or coastdown sweeps.</p>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <div className="step-number" style={{ background: '#f1f5f9', color: '#10b981', boxShadow: '5px 5px 12px #cbd5e1, -5px -5px 12px #ffffff' }}>03</div>
                        <h4 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '15px 0 10px 0', fontFamily: "'Outfit', sans-serif", color: '#0f172a' }}>Render & Export</h4>
                        <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>Hover charts for values, toggle sensors on the navigation tree, and export all generated diagnostic plots in bulk as a ZIP archive.</p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer style={{
                borderTop: 'none',
                padding: '40px 8%',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '0.9rem',
                position: 'relative',
                zIndex: 10
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '25px', marginBottom: '15px' }}>
                    <Link to="/terms" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = '#2563eb'} onMouseLeave={(e) => e.target.style.color = '#64748b'}>Terms of Service</Link>
                    <Link to="/privacy" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = '#2563eb'} onMouseLeave={(e) => e.target.style.color = '#64748b'}>Privacy Policy</Link>
                    <Link to="/security" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = '#2563eb'} onMouseLeave={(e) => e.target.style.color = '#64748b'}>Security Features</Link>
                </div>
                <p>&copy; 2026 Rotordyn.ai. All rights reserved. Professional Turbomachinery & Generator machinery diagnostics environments.</p>
            </footer>

            {/* Inline Page Styling overrides for Enhanced UI */}
            <style>{`
                .bg-glow {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(100px);
                    pointer-events: none;
                    z-index: 0;
                }
                .bg-glow-red {
                    width: 500px;
                    height: 500px;
                    background: radial-gradient(circle, rgba(37, 99, 235, 0.06) 0%, transparent 70%);
                    top: -10%;
                    left: -10%;
                    animation: pulseGlow 14s infinite alternate;
                }
                .bg-glow-blue {
                    width: 600px;
                    height: 600px;
                    background: radial-gradient(circle, rgba(16, 185, 129, 0.04) 0%, transparent 70%);
                    bottom: 20%;
                    right: -10%;
                    animation: pulseGlow 18s infinite alternate-reverse;
                }
                @keyframes pulseGlow {
                    0% { transform: translate(0, 0) scale(1); }
                    100% { transform: translate(50px, 30px) scale(1.15); }
                }
                .nav-link-item {
                    color: #475569;
                    text-decoration: none;
                    font-weight: 600;
                    font-size: 0.95rem;
                    transition: color 0.25s ease;
                }
                .nav-link-item:hover {
                    color: #2563eb;
                }
                .btn-glow-cta:hover {
                    transform: translateY(0.5px);
                    box-shadow: 2px 2px 6px #cbd5e1, -2px -2px 6px #ffffff !important;
                }
                .feature-card-glass {
                    background: #f1f5f9;
                    border: none;
                    border-radius: 16px;
                    padding: 40px 30px;
                    box-shadow: 6px 6px 16px #cbd5e1, -6px -6px 16px #ffffff;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .feature-card-glass:hover {
                    background: #f1f5f9;
                    box-shadow: 2px 2px 6px #cbd5e1, -2px -2px 6px #ffffff;
                    transform: translateY(-2px);
                }
                .feature-icon-box {
                    width: 50px;
                    height: 50px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    margin-bottom: 25px;
                }
                .feature-card-glass h3 {
                    font-family: 'Outfit', sans-serif;
                    font-size: 1.35rem;
                    font-weight: 700;
                    margin-bottom: 12px;
                    color: #0f172a;
                }
                .feature-card-glass p {
                    color: #475569;
                    font-size: 0.95rem;
                    line-height: 1.5;
                }
                .step-number {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    font-family: 'Outfit', sans-serif;
                    font-weight: 800;
                    font-size: 1.4rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto;
                }
                .badge-pulse {
                    animation: shadowPulse 2.5s infinite;
                }
                @keyframes shadowPulse {
                    0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.2); }
                    70% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
                }
                
                /* Mobile & Tablet Responsiveness */
                @media (max-width: 768px) {
                    .nav-hide-mobile {
                        display: none !important;
                    }
                    nav {
                        padding: 12px 4% !important;
                        flex-direction: row !important;
                        justify-content: space-between !important;
                        align-items: center !important;
                        gap: 0 !important;
                    }
                    nav > div:first-child {
                        font-size: 1.35rem !important;
                    }
                    nav > div:last-child {
                        display: flex !important;
                        gap: 12px !important;
                        align-items: center !important;
                    }
                    .btn-glow-cta {
                        padding: 8px 16px !important;
                        font-size: 0.8rem !important;
                        border-radius: 6px !important;
                    }
                    .nav-link-item {
                        font-size: 0.85rem !important;
                    }
                    .landing-hero {
                        padding: 60px 4% 40px 4% !important;
                    }
                    .landing-hero h1 {
                        font-size: 2.1rem !important;
                        letter-spacing: -0.5px !important;
                        line-height: 1.2 !important;
                    }
                    .landing-hero p {
                        font-size: 0.95rem !important;
                        margin-bottom: 25px !important;
                        line-height: 1.5 !important;
                    }
                    .landing-hero div {
                        flex-direction: column !important;
                        width: 100% !important;
                        gap: 12px !important;
                        margin-bottom: 40px !important;
                    }
                    .landing-hero a {
                        width: 100% !important;
                        box-sizing: border-box !important;
                        text-align: center !important;
                        padding: 14px 20px !important;
                    }
                    section {
                        padding: 50px 4% !important;
                    }
                    section h2 {
                        font-size: 1.8rem !important;
                    }
                    footer {
                        padding: 30px 4% !important;
                        flex-direction: column !important;
                        gap: 15px !important;
                        text-align: center !important;
                    }
                }
            `}</style>
        </div>
    );
};
