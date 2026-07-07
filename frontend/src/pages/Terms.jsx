import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

export const Terms = () => {
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
                    Terms of Service
                </h1>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '30px' }}>Last updated: July 4, 2026</p>
                
                <div style={{
                    fontSize: '0.95rem',
                    lineHeight: '1.7',
                    color: '#475569',
                    textAlign: 'left'
                }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '25px', marginBottom: '10px' }}>1. Telemetry Data License for ML/AI Training</h3>
                    <p style={{ marginBottom: '20px' }}>
                        By utilizing Rotordyn.ai and uploading machinery vibration spreadsheets (CSV, XLS, XLSX), you grant the platform a worldwide, non-exclusive, royalty-free, perpetual license to host, parse, and utilize your telemetry data strictly in de-identified, anonymized formats for the purpose of training machine learning, artificial intelligence diagnostic models, and optimizing machinery fault identification algorithms.
                    </p>
                    
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '25px', marginBottom: '10px' }}>2. Data Anonymization Standards</h3>
                    <p style={{ marginBottom: '20px' }}>
                        Rotordyn.ai strictly enforces telemetry anonymization. Prior to using any uploaded spreadsheets for training, we strip all user profile associations, company names, specific site locations, specific timestamps, and custom sensor tags. Only raw engineering coordinates (RPM, Amplitude, Phase, Gap Voltage, Frequency spectra) are processed.
                    </p>
                    
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '25px', marginBottom: '10px' }}>3. Limitation of Liability & Advisory Scope</h3>
                    <p style={{ marginBottom: '20px' }}>
                        Vibration diagnostics calculations, 3D orbits, polar plots, and mode shape calculations are advisory only. Rotordyn.ai provides automated tool insights but does not replace certified ISO Vibration Analyst reviews. The platform accepts no liability for decisions made based on its outputs, machinery downtime, catastrophic failure, or financial loss.
                    </p>
                    
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '25px', marginBottom: '10px' }}>4. Administrator Privileges</h3>
                    <p style={{ marginBottom: '25px' }}>
                        Accounts are subject to administrator approval. The administration reserves the right to reject, restrict, block, or delete any profile at its sole discretion for violation of system guidelines.
                    </p>
                </div>
            </div>
        </div>
    );
};
