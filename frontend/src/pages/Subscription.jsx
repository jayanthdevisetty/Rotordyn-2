import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiAward, FiArrowLeft, FiPrinter, FiFileText, FiCheckCircle, FiXCircle, FiLoader } from 'react-icons/fi';

export const Subscription = () => {
    const { user, setUser, token, loading, API_BASE_URL } = useAuth();
    const navigate = useNavigate();

    // Mock checkout states
    const [showCheckout, setShowCheckout] = useState(false);
    const [loadingCheckout, setLoadingCheckout] = useState(false);
    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvc, setCvc] = useState('');
    const [cardName, setCardName] = useState('');
    const [checkoutError, setCheckoutError] = useState('');
    const [isCardFlipped, setIsCardFlipped] = useState(false);

    // Stripe checkout states
    const [verifyingPayment, setVerifyingPayment] = useState(false);
    const [verifyingError, setVerifyingError] = useState('');
    const [initiatingStripe, setInitiatingStripe] = useState(false);

    useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);
        const sessionId = queryParams.get('session_id');
        const success = queryParams.get('success');
        const canceled = queryParams.get('canceled');

        if (canceled) {
            alert('Payment checkout canceled.');
            navigate('/subscription', { replace: true });
        } else if (sessionId && success === 'true') {
            const verifyStripePayment = async () => {
                setVerifyingPayment(true);
                setVerifyingError('');
                try {
                    const apiBase = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '';
                    const response = await fetch(`${apiBase}/auth/verify_checkout_session?session_id=${sessionId}`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        }
                    });

                    if (!response.ok) {
                        const err = await response.json();
                        throw new Error(err.detail || "Payment verification failed.");
                    }

                    const data = await response.json();
                    if (data.status === 'success') {
                        if (setUser) {
                            setUser(data.user);
                        }
                        alert("Payment Confirmed! Your account is upgraded to Premium Analyst license.");
                        navigate('/dashboard', { replace: true });
                    } else {
                        throw new Error("Payment is still pending verification.");
                    }
                } catch (err) {
                    setVerifyingError(err.message || 'Verification failed. Please contact support.');
                } finally {
                    setVerifyingPayment(false);
                }
            };
            verifyStripePayment();
        }
    }, [token, API_BASE_URL, setUser, navigate]);

    const handleUpgradeClick = async () => {
        setCheckoutError('');
        setInitiatingStripe(true);
        try {
            const apiBase = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '';
            const response = await fetch(`${apiBase}/auth/create_checkout_session?origin=${window.location.origin}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error("Failed to contact payment system.");
            }

            const data = await response.json();
            if (data.stripe_active && data.url) {
                window.location.href = data.url;
            } else {
                setCardNumber('');
                setExpiry('');
                setCvc('');
                setCardName('');
                setShowCheckout(true);
            }
        } catch (err) {
            console.error("Stripe initiation failed, using sandbox fallback:", err);
            setCardNumber('');
            setExpiry('');
            setCvc('');
            setCardName('');
            setShowCheckout(true);
        } finally {
            setInitiatingStripe(false);
        }
    };

    if (loading || verifyingPayment) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f1f5f9', flexDirection: 'column', gap: '12px' }}>
                <FiLoader size={32} style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {verifyingPayment ? "Confirming payment with Stripe..." : "Verifying session..."}
                </span>
                {verifyingError && (
                    <span style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '10px' }}>{verifyingError}</span>
                )}
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    const isGuest = !token || !user;
    const isPremium = !isGuest && user.subscription_status === 'premium';
    const genCount = !isGuest ? (user.report_generation_count || 0) : 0;
    const limit = 3;
    const remaining = Math.max(0, limit - genCount);
    const usagePercent = Math.min(100, (genCount / limit) * 100);

    const handleMockCheckout = async (e) => {
        e.preventDefault();
        setCheckoutError('');
        
        if (!cardNumber || !expiry || !cvc || !cardName) {
            setCheckoutError('Please fill in all credit card details.');
            return;
        }

        setLoadingCheckout(true);

        try {
            const apiBase = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '';
            const response = await fetch(`${apiBase}/auth/upgrade_subscription`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || "Checkout failed.");
            }

            const updatedUser = await response.json();
            
            if (setUser) {
                setUser(updatedUser);
            }

            setTimeout(() => {
                setLoadingCheckout(false);
                setShowCheckout(false);
                alert("Payment Confirmed! Your account is upgraded to Premium Analyst license.");
                navigate('/dashboard');
            }, 1200);

        } catch (err) {
            setLoadingCheckout(false);
            setCheckoutError(err.message || 'Payment processing failed. Please try again.');
        }
    };

    return (
        <div style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            backgroundColor: '#f1f5f9',
            color: '#0f172a',
            minHeight: '100vh',
            padding: '40px 20px',
            boxSizing: 'border-box'
        }}>
            {/* Header / Nav */}
            <div style={{ maxWidth: '960px', margin: '0 auto 30px auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button 
                    onClick={() => navigate(isGuest ? '/' : '/dashboard')}
                    className="neu-button"
                    style={{
                        padding: '10px 18px',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                    }}
                >
                    <FiArrowLeft size={14} /> {isGuest ? 'Back to Home' : 'Back to Dashboard'}
                </button>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '1.25rem' }}>
                    Rotordyn<span style={{ color: '#2563eb' }}>.ai</span>
                </div>
            </div>

            <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>
                
                {/* Active Subscription Summary */}
                {!isGuest && (
                    <div className="neu-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
                        <div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Active Subscription</span>
                            <h2 style={{ fontFamily: "'Outfit', sans-serif", margin: '5px 0 10px 0', fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FiAward size={22} style={{ color: isPremium ? '#0284c7' : '#64748b' }} />
                                {isPremium ? 'Premium Analyst' : 'Starter Plan'}
                            </h2>
                        </div>
                        <div style={{
                            padding: '6px 14px',
                            borderRadius: '50px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            backgroundColor: isPremium ? '#e0f2fe' : '#f3f4f6',
                            color: isPremium ? '#0369a1' : '#4b5563',
                            border: `1px solid ${isPremium ? 'rgba(2, 132, 199, 0.15)' : 'rgba(100, 116, 139, 0.15)'}`
                        }}>
                            Active
                        </div>
                    </div>

                    {/* Report Generation Usage Meter */}
                    {!isPremium ? (
                        <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                                <span style={{ fontWeight: 600, color: '#475569' }}>Free-Tier AI Reports Generated</span>
                                <span style={{ fontWeight: 700, color: '#0f172a' }}>{genCount} / {limit} Used</span>
                            </div>
                            {/* Progress bar container */}
                            <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${usagePercent}%`,
                                    height: '100%',
                                    backgroundColor: usagePercent >= 100 ? '#ef4444' : '#2563eb',
                                    borderRadius: '4px',
                                    transition: 'width 0.4s ease-out'
                                }} />
                            </div>
                            <p style={{ margin: '8px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                {remaining > 0 ? `You have ${remaining} free AI diagnostic report generations remaining.` : 'Free limit reached. Upgrade to Premium is required to compile new diagnostic reports.'}
                            </p>
                        </div>
                    ) : (
                        <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '20px' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#0369a1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FiCheckCircle size={16} /> You have unlimited AI report generations and PDF/Word evidence exports.
                            </p>
                        </div>
                    )}
                    </div>
                )}

                {/* Pricing Tiers Columns */}
                <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
                    
                    {/* Starter Card */}
                    <div className="neu-card" style={{ flex: 1, minWidth: '280px', padding: '30px', display: 'flex', flexDirection: 'column', border: !isPremium ? '2px solid #94a3b8' : '1px solid var(--border-color)', opacity: isPremium ? 0.75 : 1 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Starter Tier</span>
                        <h3 style={{ fontFamily: "'Outfit', sans-serif", margin: '5px 0 10px 0', fontSize: '1.25rem', fontWeight: 800 }}>Starter Plan</h3>
                        <div style={{ margin: '10px 0 20px 0' }}>
                            <span style={{ fontSize: '1.8rem', fontWeight: 800 }}>$0</span>
                            <span style={{ fontSize: '0.82rem', color: '#64748b' }}> / month</span>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 30px 0', fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '10px', flexGrow: 1 }}>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiCheckCircle size={14} style={{ color: '#10b981' }} /> Basic dynamic workspace</li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiCheckCircle size={14} style={{ color: '#10b981' }} /> 1 telemetry dataset upload</li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiCheckCircle size={14} style={{ color: '#10b981' }} /> Max 3 AI Report generations</li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}><FiXCircle size={14} style={{ color: '#ef4444' }} /> Locked PDF / Word downloads</li>
                        </ul>
                        {isGuest ? (
                            <button 
                                onClick={() => navigate('/auth?redirect=/subscription')}
                                className="neu-button" 
                                style={{ width: '100%', padding: '12px', fontSize: '0.85rem', background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }}
                            >
                                Get Started
                            </button>
                        ) : (
                            <button 
                                disabled 
                                className="neu-button" 
                                style={{ width: '100%', padding: '12px', fontSize: '0.85rem', color: '#94a3b8', cursor: 'not-allowed' }}
                            >
                                {!isPremium ? 'Current Plan' : 'Downgrade Restricted'}
                            </button>
                        )}
                    </div>

                    {/* Premium Card */}
                    <div className="neu-card" style={{ flex: 1, minWidth: '280px', padding: '30px', display: 'flex', flexDirection: 'column', border: isPremium ? '2px solid #0284c7' : '2px solid #2563eb', boxShadow: '0 10px 30px rgba(37, 99, 235, 0.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Machinery Analyst</span>
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, backgroundColor: '#2563eb', color: 'white', padding: '3px 8px', borderRadius: '20px' }}>POPULAR</span>
                        </div>
                        <h3 style={{ fontFamily: "'Outfit', sans-serif", margin: '5px 0 10px 0', fontSize: '1.25rem', fontWeight: 800 }}>Premium Analyst</h3>
                        <div style={{ margin: '10px 0 20px 0' }}>
                            <span style={{ fontSize: '1.8rem', fontWeight: 800 }}>$199</span>
                            <span style={{ fontSize: '0.82rem', color: '#64748b' }}> / month</span>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 30px 0', fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '10px', flexGrow: 1 }}>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiCheckCircle size={14} style={{ color: '#10b981' }} /> Unlimited telemetry dataset uploads</li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiCheckCircle size={14} style={{ color: '#10b981' }} /> WebGL 3D waterfall cascade analysis</li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiCheckCircle size={14} style={{ color: '#10b981' }} /> Unlimited AI report generation</li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiCheckCircle size={14} style={{ color: '#10b981' }} /> <FiPrinter size={12} /> Print & Save PDF exports</li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiCheckCircle size={14} style={{ color: '#10b981' }} /> <FiFileText size={12} /> Word document exports with evidence</li>
                        </ul>
                        {isPremium ? (
                            <button 
                                disabled 
                                className="neu-button" 
                                style={{ width: '100%', padding: '12px', fontSize: '0.85rem', color: '#94a3b8', cursor: 'not-allowed' }}
                            >
                                Active Plan
                            </button>
                        ) : isGuest ? (
                            <button 
                                onClick={() => navigate('/auth?redirect=/subscription')}
                                className="neu-button" 
                                style={{ width: '100%', padding: '12px', fontSize: '0.85rem', background: '#2563eb', color: 'white', border: 'none', boxShadow: '5px 5px 12px #cbd5e1, -5px -5px 12px #ffffff, 0 4px 12px rgba(37, 99, 235, 0.15)', cursor: 'pointer' }}
                            >
                                Upgrade Account
                            </button>
                        ) : (
                            <button 
                                onClick={handleUpgradeClick}
                                disabled={initiatingStripe}
                                className="neu-button" 
                                style={{ width: '100%', padding: '12px', fontSize: '0.85rem', background: '#2563eb', color: 'white', border: 'none', boxShadow: '5px 5px 12px #cbd5e1, -5px -5px 12px #ffffff, 0 4px 12px rgba(37, 99, 235, 0.15)', cursor: initiatingStripe ? 'not-allowed' : 'pointer', opacity: initiatingStripe ? 0.8 : 1 }}
                            >
                                {initiatingStripe ? 'Initiating Checkout...' : 'Upgrade Account'}
                            </button>
                        )}
                    </div>

                </div>

                {/* Enterprise Custom activation note */}
                <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: 'rgba(37, 99, 235, 0.04)', border: '1px solid rgba(37, 99, 235, 0.1)', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                        Need corporate team licensing or volume pricing? Contact our billing department:
                    </p>
                    <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', fontWeight: 800, color: '#2563eb' }}>
                        Billing Department (support@rotordyn.com)
                    </p>
                </div>

            </div>

            {/* Mock Checkout Modal overlay */}
            {showCheckout && (
                <div className="payment-modal-backdrop">
                    <div className="payment-modal-card">
                        
                        {/* Header */}
                        <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>Payment Details</h3>
                            <button type="button" onClick={() => setShowCheckout(false)} style={{ background: "transparent", border: "none", color: "#64748b", fontSize: "1.5rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>&times;</button>
                        </div>
                        
                        {/* Form Body */}
                        <form onSubmit={handleMockCheckout} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            
                            {/* Cardholder Visual Preview Card */}
                            <div className="interactive-card-wrapper">
                                <div className={`interactive-card ${isCardFlipped ? 'flipped' : ''}`}>
                                    {/* Front Side */}
                                    <div className="card-face front">
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div className="card-chip" />
                                            <div className="card-logo">
                                                <svg style={{ width: "20px", height: "20px" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                                    <path d="M2 12h20" />
                                                </svg>
                                                RotorPay
                                            </div>
                                        </div>
                                        
                                        <div className="card-number-display">
                                            {cardNumber || "•••• •••• •••• ••••"}
                                        </div>
                                        
                                        <div className="card-lower">
                                            <div style={{ flexGrow: 1, marginRight: "10px" }}>
                                                <div className="card-label">Card Holder</div>
                                                <div className="card-value">{cardName || "Jane Doe"}</div>
                                            </div>
                                            <div style={{ flexShrink: 0 }}>
                                                <div className="card-label">Expires</div>
                                                <div className="card-value">{expiry || "MM/YY"}</div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Back Side */}
                                    <div className="card-face back">
                                        <div className="card-back-stripe" />
                                        <div>
                                            <div className="card-label" style={{ paddingLeft: "24px" }}>CVC / CVV</div>
                                            <div className="card-back-signature">
                                                {cvc || "•••"}
                                            </div>
                                        </div>
                                        <div style={{ padding: "0 24px", fontSize: "0.5rem", color: "rgba(255,255,255,0.4)", textAlign: "right" }}>
                                            Simulated Sandbox Card
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Order Total</span>
                                <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "#1e3a8a" }}>$199.00 <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "normal" }}>/ month</span></div>
                            </div>
                            
                            {/* Cardholder name */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Cardholder Name</label>
                                <input 
                                    type="text" 
                                    required
                                    value={cardName} 
                                    onChange={(e) => setCardName(e.target.value)}
                                    placeholder="Jane Doe" 
                                    className="card-input-field"
                                />
                            </div>

                            {/* Card Number */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Card Number</label>
                                <input 
                                    type="text" 
                                    required
                                    maxLength="19"
                                    value={cardNumber} 
                                    onChange={(e) => {
                                        let val = e.target.value.replace(/\D/g, '');
                                        // Format as 4-4-4-4
                                        let parts = [];
                                        for (let i = 0; i < val.length; i += 4) {
                                            parts.push(val.substring(i, i + 4));
                                        }
                                        setCardNumber(parts.join(' '));
                                    }}
                                    placeholder="4242 4242 4242 4242" 
                                    className="card-input-field"
                                />
                            </div>
                            
                            {/* Expiry and CVC */}
                            <div style={{ display: "flex", gap: "16px" }}>
                                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Expiry Date</label>
                                    <input 
                                        type="text" 
                                        required
                                        maxLength="5"
                                        value={expiry} 
                                        onChange={(e) => {
                                            let val = e.target.value.replace(/\D/g, '');
                                            if (val.length > 2) {
                                                val = val.substring(0, 2) + '/' + val.substring(2);
                                            }
                                            setExpiry(val);
                                        }}
                                        placeholder="MM/YY" 
                                        className="card-input-field"
                                        style={{ width: "100%", boxSizing: "border-box" }}
                                    />
                                </div>
                                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>CVC</label>
                                    <input 
                                        type="text" 
                                        required
                                        maxLength="4"
                                        value={cvc} 
                                        onChange={(e) => setCvc(e.target.value.replace(/\D/g, ''))}
                                        onFocus={() => setIsCardFlipped(true)}
                                        onBlur={() => setIsCardFlipped(false)}
                                        placeholder="123" 
                                        className="card-input-field"
                                        style={{ width: "100%", boxSizing: "border-box" }}
                                    />
                                </div>
                            </div>

                            {checkoutError && (
                                <div style={{ color: "#ef4444", fontSize: "0.78rem", fontWeight: 600, padding: "8px 12px", backgroundColor: "#fef2f2", borderRadius: "8px", border: "1px solid #fee2f2" }}>
                                    {checkoutError}
                                </div>
                            )}

                            {/* Alert Sandbox Message */}
                            <div style={{ padding: "12px", borderRadius: "10px", backgroundColor: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)", fontSize: "0.72rem", color: "#b45309", lineHeight: "1.4", display: "flex", gap: "8px" }}>
                                <svg style={{ flexShrink: 0, width: "14px", height: "14px", marginTop: "2px" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span>
                                    <strong>Sandbox Mode:</strong> You can enter any credit card details (e.g. Stripe test card 4242) to trigger a simulated successful license activation.
                                </span>
                            </div>
                            
                            {/* Buttons */}
                            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                                <button 
                                    type="button" 
                                    onClick={() => setShowCheckout(false)}
                                    className="neu-button" 
                                    style={{ flex: 1, padding: "12px", fontSize: "0.85rem", cursor: "pointer", borderRadius: "10px" }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={loadingCheckout}
                                    className="neu-button" 
                                    style={{ flex: 1, padding: "12px", fontSize: "0.85rem", background: "#2563eb", color: "white", border: "none", cursor: loadingCheckout ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", borderRadius: "10px" }}
                                >
                                    {loadingCheckout ? (
                                        <>
                                            <FiLoader className="spinner" style={{ animation: "spin 1s linear infinite" }} /> Processing...
                                        </>
                                    ) : (
                                        "Confirm Payment"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
