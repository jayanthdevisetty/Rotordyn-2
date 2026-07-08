import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiShield, FiLock, FiUsers, FiFileText } from 'react-icons/fi';

export const Security = () => {
    const navigate = useNavigate();

    return (
        <div style={{
            backgroundColor: '#f1f5f9',
            color: '#0f172a',
            minHeight: '100vh',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            padding: '50px 8%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundImage: `
                radial-gradient(circle at 5% 5%, rgba(37, 99, 235, 0.02) 0%, transparent 35%),
                radial-gradient(circle at 95% 95%, rgba(16, 185, 129, 0.02) 0%, transparent 35%)
            `
        }}>
            <button 
                onClick={() => navigate('/')} 
                style={{
                    alignSelf: 'flex-start',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 18px',
                    borderRadius: '50px',
                    background: '#f1f5f9',
                    border: 'none',
                    color: '#0f172a',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    boxShadow: '4px 4px 10px #cbd5e1, -4px -4px 10px #ffffff',
                    transition: 'all 0.3s ease',
                    marginBottom: '30px'
                }}
            >
                <FiArrowLeft style={{ fontSize: '1rem', strokeWidth: '3' }} /> Back to Home
            </button>

            <div className="neu-card" style={{
                width: '100%',
                maxWidth: '850px',
                padding: '45px',
                borderRadius: '16px',
                boxShadow: '8px 8px 24px #cbd5e1, -8px -8px 24px #ffffff',
                backgroundColor: '#f1f5f9',
                textAlign: 'left'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                    <div style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(37, 99, 235, 0.08)',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.6rem'
                    }}><FiShield /></div>
                    <div>
                        <h1 style={{ 
                            fontFamily: "'Outfit', sans-serif", 
                            fontSize: '2.1rem', 
                            fontWeight: 800, 
                            color: '#0f172a',
                            margin: 0
                        }}>
                            Security Architecture
                        </h1>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '2px', margin: 0 }}>Rotordyn.ai Industrial Data Protection Specifications</p>
                    </div>
                </div>

                <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.65', marginBottom: '35px', borderBottom: '1px solid #cbd5e1', paddingBottom: '25px' }}>
                    Rotordyn.ai is engineered to protect sensitive machinery telemetry records. Our multi-tenant, containerized structure guarantees that vibration datasets, diagnostic sweeps, and AI maintenance logs remain secure and isolated.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    
                    {/* 1. RLS */}
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '1.3rem', color: '#2563eb', padding: '6px', background: 'rgba(37, 99, 235, 0.05)', borderRadius: '6px' }}><FiLock /></div>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>PostgreSQL Row-Level Security (RLS)</h3>
                            <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.6', margin: 0 }}>
                                Database tables are hardened with strict PostgreSQL RLS policies. Even in the event of public key exposure, queries bypassable restrictions are blocked at the database engine level, verifying access boundaries for every transaction.
                            </p>
                        </div>
                    </div>

                    {/* 2. Private Storage */}
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '1.3rem', color: '#10b981', padding: '6px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '6px' }}><FiShield /></div>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>Private Cloud Storage Bucket Locks</h3>
                            <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.6', margin: 0 }}>
                                Telemetry upload containers are locked down to restrict public file URL harvesting. All download and upload actions force server-side session checks, serving dataset files exclusively via temporary presigned links that automatically expire after 15 minutes.
                            </p>
                        </div>
                    </div>

                    {/* 3. Multi-Tenancy */}
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '1.3rem', color: '#4f46e5', padding: '6px', background: 'rgba(79, 70, 229, 0.05)', borderRadius: '6px' }}><FiUsers /></div>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>Multi-Tenant Workspace Partitioning</h3>
                            <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.6', margin: 0 }}>
                                Teams and workplaces are logically isolated matching company and plant scopes. Coworkers sharing a workspace can seamlessly collaborate and review shared diagnostics datasets, while keeping records strictly sealed from external organizations.
                            </p>
                        </div>
                    </div>

                    {/* 4. Audit Logging */}
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '1.3rem', color: '#db2777', padding: '6px', background: 'rgba(219, 39, 119, 0.05)', borderRadius: '6px' }}><FiFileText /></div>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>Compliance Audit Logs</h3>
                            <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.6', margin: 0 }}>
                                Every user operation—such as authentication status, file modifications, dataset downloads, and AI diagnostics prompts—records an immutable audit entry. Compliance logs are aggregated and available for administrator inspection to support SOC 2 audits.
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
