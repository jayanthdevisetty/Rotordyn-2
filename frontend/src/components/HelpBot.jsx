import React, { useState, useEffect, useRef } from 'react';
import { FiMessageSquare, FiMic, FiSend, FiX, FiHelpCircle, FiLoader } from 'react-icons/fi';

// Predefined quick-start suggestions
const PREDEFINED_QUESTIONS = [
    { text: "How do I register a new account?", category: "setup" },
    { text: "How does the admin approval queue work?", category: "setup" },
    { text: "How do I upload dynamic telemetry datasets?", category: "workspace" },
    { text: "Starter Plan vs. Premium Analyst pricing?", category: "pricing" },
    { text: "What ISO vibration severity standards are supported?", category: "workspace" }
];

// Rich offline machinery diagnostics client knowledge base
const KNOWLEDGE_BASE = [
    {
        keywords: ["register", "account", "signup", "create account", "registration"],
        answer: "To register a new account on Rotordyn.ai: \n1. Click 'Launch Workspace' or go to the Auth page.\n2. Switch to the Register form.\n3. Input your name, email, password, company, plant, and intended purpose.\n4. Click 'Register'. New user profiles are queued under 'Pending Admin Approval' to prevent unauthorized access to critical plant telemetry."
    },
    {
        keywords: ["admin", "approval", "queue", "approved", "pending"],
        answer: "Every registered user account is subject to review by the system administrator for security compliance. Once approved, the account status switches from 'pending' to 'approved', allowing you to access the diagnostics dashboard. Administrators can grant or revoke approval statuses inside the Admin Panel."
    },
    {
        keywords: ["login", "signin", "credentials", "oauth", "google", "github"],
        answer: "You can sign in using either: \n1. Your registered email and password.\n2. Google or GitHub Single Sign-On (SSO) OAuth integration buttons at the top of the Auth form. If your account is approved, SSO will automatically redirect you straight to the dashboard."
    },
    {
        keywords: ["upload", "csv", "excel", "dataset", "telemetry", "data"],
        answer: "To upload dynamic machinery sensor datasets:\n1. Open your workspace and click the drag-and-drop zone in the Left Control Drawer.\n2. Select a valid CSV/Excel file containing speed (RPM) and proximity probe vibration columns.\n3. Verify your sensor configurations in the sensors listing tree.\n4. Click 'Load Dataset' to sync variables and render the Trend, Bode, and Orbit plots."
    },
    {
        keywords: ["slow roll", "compensation", "baseline", "vector subtraction"],
        answer: "Vector Slow-Roll Compensation subtracts slow-speed runout error from dynamic probe telemetry. To enable it: \n1. Load your dataset and check the Slow Roll section in the Control Drawer.\n2. Select a low speed range (e.g. 300 RPM) as your baseline runout target.\n3. Click 'Subtract Baseline'. The system will recalculate your Bode and 1X Polar plots with runout baseline vectors subtracted automatically."
    },
    {
        keywords: ["iso", "severity", "limits", "10816", "alarm"],
        answer: "Rotordyn.ai overlays standard ISO 10816 machinery vibration severity bands on Trend plots. Toggle the 'ISO severity limits' switch under your vibration charts. This overlays color-coded threshold zones:\n- Green: Zone A (Newly commissioned machines)\n- Yellow: Zone B (Unrestricted long-term operation)\n- Orange: Zone C (Restricted short-term operation)\n- Red: Zone D (Catastrophic vibration level; trip recommended)"
    },
    {
        keywords: ["3d", "waterfall", "cascade", "webgl", "spectral"],
        answer: "The WebGL 3D Spectral Cascade plot maps frequency spectrum lines over time and shaft speed. Go to the plot selectors in the sidebar and enable 'WebGL 3D Waterfall'. Drag, rotate, and zoom the interactive 3D mesh surface to identify sub-synchronous rub, oil whirl, or resonance peaks during machine speed sweeps."
    },
    {
        keywords: ["pricing", "cost", "subscription", "premium", "free", "tier", "starter", "usd", "dollars"],
        answer: "Rotordyn.ai operates on two plan tiers:\n1. **Starter Plan ($0 / month):** Grants access to basic dynamic plotting. Limit of 3 free AI Diagnostics report generations; PDF and Word downloads are locked.\n2. **Premium Analyst ($199 / month):** Grants unlimited telemetry uploads, WebGL 3D waterfall cascades, and unlimited PDF & Word report exports with embedded plot evidence. Upgrade instantly inside the Subscription panel."
    },
    {
        keywords: ["password", "reset", "forgot password", "change password"],
        answer: "If you forgot your password, please contact your company administrator or system support (support@rotordyn.com) to trigger a password reset instruction link to your email address."
    },
    {
        keywords: ["report", "generate", "pdf", "word", "docx", "export"],
        answer: "To generate a report:\n1. Click the 'Generate AI Report' button in the toolbar.\n2. The system prompts Gemini AI to compile diagnostics based on telemetry peaks.\n3. Premium users can click 'Print / Save PDF' or 'Save as Word (.docx)' to export the report with embedded plot images. Free-tier users are restricted to 3 total generations."
    }
];

export const HelpBot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { sender: 'bot', text: "Hello! I am your Rotordyn AI assistant. How can I help you navigate the platform today?", timestamp: new Date() }
    ]);
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    
    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isTyping]);

    // Setup speech recognition
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const rec = new SpeechRecognition();
            rec.continuous = false;
            rec.interimResults = false;
            rec.lang = 'en-US';

            rec.onstart = () => {
                setIsListening(true);
            };

            rec.onresult = (event) => {
                const speechToText = event.results[0][0].transcript;
                setInput(speechToText);
                handleSend(speechToText);
            };

            rec.onerror = (e) => {
                console.error("Speech Recognition error:", e);
                setIsListening(false);
            };

            rec.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = rec;
        }
    }, []);

    const toggleVoiceInput = () => {
        if (!recognitionRef.current) {
            alert("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            setInput('');
            recognitionRef.current.start();
        }
    };

    const handleSend = (textToSend) => {
        const queryText = textToSend || input;
        if (!queryText.trim()) return;

        // User message
        const userMsg = { sender: 'user', text: queryText, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');

        // Simulate typing delay
        setIsTyping(true);
        setTimeout(() => {
            const replyText = getBotResponse(queryText);
            setMessages(prev => [...prev, { sender: 'bot', text: replyText, timestamp: new Date() }]);
            setIsTyping(false);
        }, 800);
    };

    const getBotResponse = (query) => {
        const cleanQuery = query.toLowerCase();

        // Confidentiality check
        const confidentialKeywords = ["postgres", "password", "secret", "apikey", "jwt", "database connection", "credentials list", "config", "port"];
        const holdsConfidentialQuery = confidentialKeywords.some(keyword => {
            // Avoid flagging safe general queries about standard password reset
            if (cleanQuery.includes("forgot") || cleanQuery.includes("reset") || cleanQuery.includes("change")) {
                return false;
            }
            return cleanQuery.includes(keyword) && (cleanQuery.includes("db") || cleanQuery.includes("url") || cleanQuery.includes("root") || cleanQuery.includes("key") || cleanQuery.includes("system"));
        });

        if (holdsConfidentialQuery) {
            return "I am not authorized to disclose confidential system credentials, backend connection strings, database parameters, or application API keys. For security issues, contact System Support.";
        }

        // Search in offline knowledge base
        for (const entry of KNOWLEDGE_BASE) {
            const matched = entry.keywords.some(keyword => cleanQuery.includes(keyword));
            if (matched) {
                return entry.answer;
            }
        }

        // Generic fallback
        return "I'm not sure about that specific topic. I can guide you on account creation, dashboard navigation, telemetry uploads, vector slow-roll compensation, ISO standards, and subscription tiers. What else can I answer?";
    };

    return (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            
            {/* Toggle Floating button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        backgroundColor: '#2563eb',
                        border: 'none',
                        color: 'white',
                        fontSize: '1.6rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)',
                        transition: 'transform 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <FiMessageSquare />
                </button>
            )}

            {/* Chat Box Panel */}
            {isOpen && (
                <div style={{
                    width: '360px',
                    height: '520px',
                    backgroundColor: 'var(--card-color, #ffffff)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '16px',
                    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.12)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'slideUp 0.25s ease-out'
                }}>
                    
                    {/* Header */}
                    <div style={{
                        padding: '16px 20px',
                        background: '#2563eb',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FiHelpCircle size={20} />
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>Platform Assistant</div>
                                <div style={{ fontSize: '0.68rem', opacity: 0.85 }}>Online | Guided FAQ</div>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.25rem', cursor: 'pointer' }}
                        >
                            <FiX />
                        </button>
                    </div>

                    {/* Chat Body */}
                    <div style={{
                        flexGrow: 1,
                        padding: '16px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        backgroundColor: '#f8fafc'
                    }}>
                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                style={{
                                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                                    maxWidth: '85%',
                                    padding: '10px 14px',
                                    borderRadius: '12px',
                                    fontSize: '0.82rem',
                                    lineHeight: '1.45',
                                    whiteSpace: 'pre-line',
                                    backgroundColor: msg.sender === 'user' ? '#2563eb' : '#ffffff',
                                    color: msg.sender === 'user' ? 'white' : '#0f172a',
                                    boxShadow: msg.sender === 'user' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
                                    border: msg.sender === 'user' ? 'none' : '1px solid #e2e8f0'
                                }}
                            >
                                {msg.text}
                            </div>
                        ))}
                        
                        {isTyping && (
                            <div style={{
                                alignSelf: 'flex-start',
                                padding: '10px 14px',
                                borderRadius: '12px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <FiLoader className="spinner" style={{ animation: 'spin 1s linear infinite', color: '#64748b' }} />
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Typing response...</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Predefined suggestion list */}
                    <div style={{
                        padding: '8px 12px',
                        borderTop: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        display: 'flex',
                        gap: '6px',
                        overflowX: 'auto',
                        whiteSpace: 'nowrap',
                        scrollbarWidth: 'none'
                    }}>
                        {PREDEFINED_QUESTIONS.map((q, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSend(q.text)}
                                style={{
                                    padding: '5px 10px',
                                    borderRadius: '30px',
                                    border: '1px solid #cbd5e1',
                                    backgroundColor: '#ffffff',
                                    color: '#475569',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = '#2563eb';
                                    e.currentTarget.style.color = '#2563eb';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = '#cbd5e1';
                                    e.currentTarget.style.color = '#475569';
                                }}
                            >
                                {q.text}
                            </button>
                        ))}
                    </div>

                    {/* Footer Input */}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSend();
                        }}
                        style={{
                            padding: '12px 16px',
                            borderTop: '1px solid var(--border-color, #e2e8f0)',
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'center',
                            backgroundColor: 'var(--card-color, #ffffff)'
                        }}
                    >
                        {/* Voice recognition mic */}
                        <button
                            type="button"
                            onClick={toggleVoiceInput}
                            style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isListening ? '#ef4444' : '#f1f5f9',
                                color: isListening ? 'white' : '#64748b',
                                transition: 'all 0.25s ease',
                                animation: isListening ? 'pulseRed 1.5s infinite' : 'none'
                            }}
                            title={isListening ? "Listening..." : "Enable Voice Input"}
                        >
                            <FiMic size={16} />
                        </button>
                        
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={isListening ? "Listening..." : "Ask plataforma help bot..."}
                            disabled={isListening}
                            style={{
                                flexGrow: 1,
                                border: '1px solid #cbd5e1',
                                borderRadius: '20px',
                                padding: '8px 14px',
                                fontSize: '0.82rem',
                                outline: 'none',
                                fontFamily: 'inherit'
                            }}
                        />
                        
                        <button
                            type="submit"
                            style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                border: 'none',
                                backgroundColor: '#2563eb',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)'
                            }}
                        >
                            <FiSend size={14} />
                        </button>
                    </form>
                </div>
            )}

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes pulseRed {
                    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                    70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                }
            `}</style>
        </div>
    );
};
