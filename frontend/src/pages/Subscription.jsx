import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiAward, FiArrowLeft, FiPrinter, FiFileText, FiCheckCircle, FiXCircle } from 'react-icons/fi';

export const Subscription = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!token) {
            navigate('/auth');
        }
    }, [token, navigate]);

    if (!user) return null;

    const isPremium = user.subscription_status === 'premium';
    const genCount = user.report_generation_count || 0;
    const limit = 3;
    const remaining = Math.max(0, limit - genCount);
    const usagePercent = Math.min(100, (genCount / limit) * 100);

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
                    onClick={() => navigate('/dashboard')}
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
                    <FiArrowLeft size={14} /> Back to Dashboard
                </button>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '1.25rem' }}>
                    Rotordyn<span style={{ color: '#2563eb' }}>.ai</span>
                </div>
            </div>

            <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>
                
                {/* Active Subscription Summary */}
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
                        <button 
                            disabled 
                            className="neu-button" 
                            style={{ width: '100%', padding: '12px', fontSize: '0.85rem', color: '#94a3b8', cursor: 'not-allowed' }}
                        >
                            {!isPremium ? 'Current Plan' : 'Downgrade Restricted'}
                        </button>
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
                        ) : (
                            <button 
                                onClick={() => alert("Please contact Shaik Rameez Basha at contact@rotordyn.com or your company administrator to activate your Premium Analyst subscription license.")}
                                className="neu-button" 
                                style={{ width: '100%', padding: '12px', fontSize: '0.85rem', background: '#2563eb', color: 'white', border: 'none', boxShadow: '5px 5px 12px #cbd5e1, -5px -5px 12px #ffffff, 0 4px 12px rgba(37, 99, 235, 0.15)', cursor: 'pointer' }}
                            >
                                Upgrade Account
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
                        Shaik Rameez Basha (contact@rotordyn.com)
                    </p>
                </div>

            </div>
        </div>
    );
};
