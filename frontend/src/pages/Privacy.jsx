import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

export const Privacy = () => {
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
            alignItems: 'center'
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
                maxWidth: '800px',
                padding: '40px',
                borderRadius: '16px',
                boxShadow: '8px 8px 24px #cbd5e1, -8px -8px 24px #ffffff',
                backgroundColor: '#f1f5f9'
            }}>
                <h1 style={{ 
                    fontFamily: "'Outfit', sans-serif", 
                    fontSize: '2.2rem', 
                    fontWeight: 800, 
                    color: '#0f172a', 
                    marginBottom: '10px' 
                }}>
                    Privacy Policy
                </h1>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '30px' }}>Last updated: July 4, 2026</p>
                
                <div style={{
                    fontSize: '0.95rem',
                    lineHeight: '1.7',
                    color: '#475569',
                    textAlign: 'left'
                }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '25px', marginBottom: '10px' }}>1. Information We Collect</h3>
                    <p style={{ marginBottom: '20px' }}>
                        We collect user profile metadata (Name, Email, Company Name, Intended Purpose) and uploaded turbomachinery vibration log streams.
                    </p>
                    
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '25px', marginBottom: '10px' }}>2. Telemetry Processing & Security</h3>
                    <p style={{ marginBottom: '20px' }}>
                        Uploaded dataset files are stored on secure local server nodes and processed inside the active browser sandbox. Telemetry values are parsed in the client window and are only transmitted to the server when utilizing cloud-save features. Transmitted telemetry files are subject to strict de-identification rules.
                    </p>
                    
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '25px', marginBottom: '10px' }}>3. Third-Party Sharing</h3>
                    <p style={{ marginBottom: '25px' }}>
                        Rotordyn.ai does not share, rent, or sell your proprietary turbomachinery datasets, company information, or email addresses with external advertisers or commercial entities. All data processing is strictly handled inside our secure cloud system nodes.
                    </p>
                </div>
            </div>
        </div>
    );
};
