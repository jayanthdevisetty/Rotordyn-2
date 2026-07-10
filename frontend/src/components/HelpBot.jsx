import React, { useState, useEffect, useRef } from 'react';
import { FiMessageSquare, FiMic, FiSend, FiX, FiActivity, FiLoader, FiUser, FiHelpCircle } from 'react-icons/fi';

// Predefined quick questions
const PREDEFINED_QUESTIONS = [
    { text: "How do I register an account?", category: "setup" },
    { text: "How does admin approval work?", category: "setup" },
    { text: "How do I upload telemetry data?", category: "workspace" },
    { text: "What is Starter vs Premium pricing?", category: "pricing" },
    { text: "How do I use Vector Slow-Roll?", category: "workspace" }
];

// Buddy conversational answers
const BUDDY_KNOWLEDGE = [
    {
        keywords: ["register", "account", "signup", "create account", "registration"],
        answer: "Hey! Creating an account is super easy. Just click 'Launch Workspace' or head to /auth, flip to the Register form, and fill in your details. Once you register, your account goes into our pending admin queue. We review accounts manually to keep our plant data secure. Hit up support@rotordyn.com if you have any questions!"
    },
    {
        keywords: ["admin", "approval", "queue", "approved", "pending"],
        answer: "No worries, the pending queue is just our standard security check! A system administrator reviews new signups. Once they verify your credentials, they will approve you, and you'll get immediate dashboard access. Admin staff can toggle this inside the Admin page anytime."
    },
    {
        keywords: ["login", "signin", "credentials", "oauth", "google", "github"],
        answer: "You can sign in with your email and password, or use Google/GitHub SSO buttons for instant login. Once you are approved, SSO will drop you right into the diagnostics dashboard!"
    },
    {
        keywords: ["upload", "csv", "excel", "dataset", "telemetry", "data"],
        answer: "Ready to analyze some telemetry? Go to the Left Drawer in your dashboard and drag your CSV or Excel file right in. Verify your probe sensors on the tree, click 'Load Dataset', and watch the Trend, Bode, and Orbit plots render live!"
    },
    {
        keywords: ["slow roll", "compensation", "baseline", "vector subtraction"],
        answer: "Vector Slow-Roll Compensation is awesome for cleaning runout error. Just check the Slow Roll panel in the Left Drawer, select a low-speed baseline range (like 200-400 RPM), and hit 'Subtract Baseline'. It immediately adjusts your Bode and Polar plots to show the true dynamic motion!"
    },
    {
        keywords: ["iso", "severity", "limits", "20816", "alarm"],
        answer: "Yes, we support standard ISO 20816 vibration severity alarm zones! Flip the 'ISO severity limits' switch under your vibration charts. It overlays clear color bands (Green for newly commissioned, Yellow for long-term, Orange for warning, and Red for trip recommendation) so you can audit machine health instantly."
    },
    {
        keywords: ["3d", "waterfall", "cascade", "webgl", "spectral"],
        answer: "Our WebGL 3D Spectral Cascade is beautiful! Turn it on via the plot selectors in the drawer. You can drag, zoom, and rotate the interactive 3D frequency-RPM spectrum map to catch mechanical rubs, oil whirl, or resonance peaks during machine speed sweeps."
    },
    {
        keywords: ["pricing", "cost", "subscription", "premium", "free", "tier", "starter", "usd", "dollars"],
        answer: "We keep it simple: \n1. **Starter Plan ($0/month):** Great for testing. Includes basic workspace plots and 3 free AI Diagnostics reports (Word/PDF downloads locked).\n2. **Premium Analyst ($199/month):** Unleashes unlimited uploads, 3D waterfalls, and unlimited PDF/Word exports with embedded plot evidence. You can upgrade instantly using our checkout modal in the Subscription tab!"
    },
    {
        keywords: ["password", "reset", "forgot password", "change password"],
        answer: "Forgot your password? No problem! Contact your company coordinator or drop a message to support@rotordyn.com. They will shoot over a password reset link to your email inbox right away."
    },
    {
        keywords: ["report", "generate", "pdf", "word", "docx", "export"],
        answer: "You can compile diagnostic reports by clicking 'Generate AI Report' in the toolbar. Gemini AI will analyze your telemetry peaks and write up the details. Premium users can download this as PDF or Word (.docx) with active chart evidence embedded."
    }
];

export const HelpBot = ({ mode = 'floating' }) => {
    const [isOpen, setIsOpen] = useState(mode === 'tab');
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        if (mode === 'tab') {
            setIsOpen(true);
        }
    }, [mode]);
    
    // Persistent buddy memory
    const [memory, setMemory] = useState(() => {
        try {
            const saved = localStorage.getItem('rotorbuddy_memory');
            return saved ? JSON.parse(saved) : {
                userName: '',
                askedTopics: [],
                interactionCount: 0,
                affinity: 0
            };
        } catch {
            return { userName: '', askedTopics: [], interactionCount: 0, affinity: 0 };
        }
    });

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);

    // Save memory updates
    useEffect(() => {
        try {
            localStorage.setItem('rotorbuddy_memory', JSON.stringify(memory));
        } catch (e) {
            console.error(e);
        }
    }, [memory]);

    // Initial greeting based on memory
    useEffect(() => {
        let greeting = "Hey there! I'm RotorBuddy, your diagnostics co-pilot. ";
        if (memory.userName) {
            greeting = `Hey ${memory.userName}! Welcome back to the deck. I'm ready to analyze some rotors. What are we looking at today?`;
        } else {
            greeting += "What's your name, buddy? Or you can ask me anything about registration, datasets, or pricing plans to get started!";
        }
        
        setMessages([
            { sender: 'bot', text: greeting, timestamp: new Date() }
        ]);
    }, [memory.userName]);

    // Auto-scroll chat
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isTyping]);

    // Web Speech recognition setup
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
            alert("Voice input is not supported in this browser. Try Google Chrome or Microsoft Edge!");
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

        // Save message
        const userMsg = { sender: 'user', text: queryText, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');

        // Update interaction counts and affinity score
        const newInteractionCount = memory.interactionCount + 1;
        const newAffinity = memory.affinity + 1;
        let nextMemory = { ...memory, interactionCount: newInteractionCount, affinity: newAffinity };

        // Attempt to learn name
        const cleanQuery = queryText.toLowerCase();
        let nameExtracted = '';
        if (cleanQuery.startsWith("my name is ")) {
            nameExtracted = queryText.substring(11).trim();
        } else if (cleanQuery.startsWith("call me ")) {
            nameExtracted = queryText.substring(8).trim();
        } else if (cleanQuery.startsWith("i am ") && !cleanQuery.includes("trying") && !cleanQuery.includes("a ")) {
            nameExtracted = queryText.substring(5).trim();
        }

        if (nameExtracted) {
            // Capitalize name
            nameExtracted = nameExtracted.charAt(0).toUpperCase() + nameExtracted.slice(1);
            nextMemory.userName = nameExtracted;
        }

        setMemory(nextMemory);
        setIsTyping(true);

        setTimeout(() => {
            let replyText = "";
            if (nameExtracted) {
                replyText = `Awesome! I'll remember that, ${nameExtracted}. Nice to partner up! Let me know if you need help uploading telemetry data or managing subscriptions.`;
            } else {
                replyText = getBuddyResponse(queryText, nextMemory);
            }

            setMessages(prev => [...prev, { sender: 'bot', text: replyText, timestamp: new Date() }]);
            setIsTyping(false);
        }, 800);
    };

    const getBuddyResponse = (query, currentMemory) => {
        const cleanQuery = query.toLowerCase();

        // Confidentiality checks
        const confidentialKeywords = ["postgres", "password", "secret", "apikey", "jwt", "database connection", "credentials list", "config", "port"];
        const holdsConfidentialQuery = confidentialKeywords.some(keyword => {
            if (cleanQuery.includes("forgot") || cleanQuery.includes("reset") || cleanQuery.includes("change")) {
                return false;
            }
            return cleanQuery.includes(keyword) && (cleanQuery.includes("db") || cleanQuery.includes("url") || cleanQuery.includes("root") || cleanQuery.includes("key") || cleanQuery.includes("system"));
        });

        if (holdsConfidentialQuery) {
            return "I am not authorized to disclose confidential system credentials, backend connection strings, database keys, or API tokens. Let's keep our session safe and focus on workspace analysis features!";
        }

        // Check dictionary
        for (const entry of BUDDY_KNOWLEDGE) {
            const matched = entry.keywords.some(keyword => cleanQuery.includes(keyword));
            if (matched) {
                // Add some buddy flavor based on affinity level
                let suffix = "";
                if (currentMemory.affinity >= 15) {
                    suffix = `\n\n(P.S. We've compiled a lot of data together, partner. High-five! 🤝)`;
                } else if (currentMemory.affinity === 8) {
                    suffix = `\n\n(By the way, you're getting really good at this. Co-pilot affinity calibrated!)`;
                }
                return entry.answer + suffix;
            }
        }

        // Generic friendly co-pilot responses
        if (currentMemory.userName) {
            return `I'm not fully sure about that one, ${currentMemory.userName}. But I can teach you about loading CSV data, runout slow-roll subtraction, checking ISO vibration bands, or upgrading to our Premium Analyst plan. What should we look at?`;
        }
        return "I didn't quite catch that topic. I can guide you through account setups, dynamic probe configurations, ISO vibration levels, or subscription checkout. Let me know what you need!";
    };

    // Determine Relationship Badge based on affinity
    const getRelationshipLabel = () => {
        const score = memory.affinity || 0;
        if (score < 3) return "Co-pilot Calibrating";
        if (score < 8) return "Diagnostics Buddy";
        if (score < 16) return "Rotor Partner";
        return "Dynamic Duo";
    };

    return (
        <div style={mode === 'tab' ? { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' } : { position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            
            {/* Toggle Button */}
            {mode !== 'tab' && !isOpen && (
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
                <div style={mode === 'tab' ? {
                    width: '100%',
                    height: 'calc(100vh - 120px)',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                } : {
                    width: '360px',
                    height: '520px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '16px',
                    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.12)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'slideUp 0.25s ease-out'
                }}>
                    
                    {/* Header */}
                    <div style={{
                        padding: '14px 18px',
                        background: '#2563eb',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Glowing robot avatar */}
                            <div style={{ position: 'relative', width: '34px', height: '34px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
                                <FiActivity size={18} style={{ color: '#60a5fa' }} />
                                <span style={{ position: 'absolute', bottom: 0, right: 0, width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', border: '2px solid #2563eb' }} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 800 }}>RotorBuddy</div>
                                <div style={{ fontSize: '0.65rem', opacity: 0.85, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    {getRelationshipLabel()}
                                </div>
                            </div>
                        </div>
                        {mode !== 'tab' && (
                            <button
                                onClick={() => setIsOpen(false)}
                                style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', display: 'flex' }}
                            >
                                <FiX />
                            </button>
                        )}
                    </div>

                    {/* Chat Messages Logs */}
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
                                    maxWidth: '82%',
                                    padding: '10px 14px',
                                    borderRadius: '16px',
                                    borderTopRightRadius: msg.sender === 'user' ? '4px' : '16px',
                                    borderTopLeftRadius: msg.sender === 'user' ? '16px' : '4px',
                                    fontSize: '0.8rem',
                                    fontWeight: 500,
                                    lineHeight: '1.45',
                                    whiteSpace: 'pre-line',
                                    backgroundColor: msg.sender === 'user' ? '#2563eb' : '#ffffff',
                                    color: msg.sender === 'user' ? 'white' : '#1e293b',
                                    boxShadow: msg.sender === 'user' ? '0 4px 10px rgba(37, 99, 235, 0.15)' : '0 2px 4px rgba(15,23,42,0.02)',
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
                                borderRadius: '16px',
                                borderTopLeftRadius: '4px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <FiLoader className="spinner" style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>RotorBuddy is thinking...</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Predefined suggestion list */}
                    <div style={{
                        padding: '10px 12px',
                        borderTop: '1px solid #edf2f7',
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
                                    padding: '5px 12px',
                                    borderRadius: '30px',
                                    border: '1px solid #cbd5e1',
                                    backgroundColor: '#ffffff',
                                    color: '#475569',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
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

                    {/* Horizontal Combined Input Bar */}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSend();
                        }}
                        style={{
                            padding: '12px 14px',
                            borderTop: '1px solid #e2e8f0',
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'center',
                            backgroundColor: '#ffffff'
                        }}
                    >
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={isListening ? "Listening..." : "Ask RotorBuddy co-pilot..."}
                            disabled={isListening}
                            style={{
                                flexGrow: 1,
                                border: '1px solid #cbd5e1',
                                borderRadius: '30px',
                                padding: '8px 14px',
                                fontSize: '0.8rem',
                                outline: 'none',
                                fontFamily: 'inherit'
                            }}
                        />
                        
                        {/* Voice Mic inside the row */}
                        <button
                            type="button"
                            onClick={toggleVoiceInput}
                            style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isListening ? '#ef4444' : '#f1f5f9',
                                color: isListening ? 'white' : '#475569',
                                transition: 'all 0.2s ease',
                                flexShrink: 0
                            }}
                            title={isListening ? "Stop listening" : "Start voice input"}
                        >
                            <FiMic size={14} />
                        </button>
                        
                        {/* Send button inside the row */}
                        <button
                            type="submit"
                            style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                border: 'none',
                                backgroundColor: '#2563eb',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0,
                                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)'
                            }}
                        >
                            <FiSend size={12} />
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
            `}</style>
        </div>
    );
};
