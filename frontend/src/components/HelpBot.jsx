import React, { useState, useEffect, useRef } from 'react';
import { FiMessageSquare, FiMic, FiSend, FiX, FiActivity, FiLoader, FiUser, FiHelpCircle, FiVolume2, FiVolumeX } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

// Predefined quick questions
const PREDEFINED_QUESTIONS = [
    { text: "🚀 Start Guided Tour", category: "tour" },
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
    },
    {
        keywords: ["unbalance", "out of balance", "eccentricity", "1x peak"],
        answer: "A high 1X running speed radial vibration peak is the classic signature of mass unbalance. It means the center of mass doesn't align with the center of rotation. You can check the Bode and Polar plots—if you see a phase shift of 90 degrees at the critical speed peak and a steady amplitude at stable speeds, unbalance is highly likely. To balance it, mechanical engineers perform single or dual-plane balance weight additions."
    },
    {
        keywords: ["misalignment", "angular misalignment", "parallel misalignment", "offset misalignment", "2x peak"],
        answer: "Misalignment across couplings manifests as a high 2X radial vibration peak, and a high 1X or 2X axial vibration peak. The phase difference across the coupling will typically be near 180 degrees. If you see this, align the shafts using laser alignment tools or shim additions under the bearing housings."
    },
    {
        keywords: ["looseness", "loose bolt", "looseness peak", "structural looseness"],
        answer: "Mechanical looseness (like cracked foundation welds or loose mounting bolts) produces a wide spectrum of harmonics at multiples of the running speed (1X, 2X, 3X, 4X, etc.), sometimes with fractional subharmonics (like 0.5X). Check the Orbit plot—looseness will deform the orbit from a clean ellipse into a banana shape or a complex multi-loop loop."
    },
    {
        keywords: ["rub", "shaft rub", "friction", "bearing whirl", "whip", "oil whirl"],
        answer: "Frictional rotor-to-stator rub is serious! It creates subharmonic vibration components (especially 0.5X or 0.33X) and multiple integer harmonics. If it occurs in fluid-film bearings, it can trigger oil whirl or oil whip (instabilities occurring at roughly 0.43X to 0.48X running speed frequency). You must check clearance offsets immediately to prevent bearing seizure!"
    },
    {
        keywords: ["resonance", "critical speed", "structural resonance", "natural frequency"],
        answer: "Resonance occurs when the machine's rotating speed matches the natural frequency of the rotor or structural frame. On the Bode plot, you'll see a sharp amplitude peak accompanied by a rapid phase shift of approximately 180 degrees. To resolve resonance, you must adjust the structural stiffness or modify the operating speed range."
    }
];

// Local Cosine Similarity ML Classifier
const tokenize = (text) => {
    return text.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
        .split(/\s+/)
        .filter(word => word.length > 2);
};

const getVector = (tokens, vocab) => {
    const vec = {};
    tokens.forEach(t => {
        if (vocab.has(t)) {
            vec[t] = (vec[t] || 0) + 1;
        }
    });
    return vec;
};

const getCosineSimilarity = (vecA, vecB) => {
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (const key in vecA) {
        dot += vecA[key] * (vecB[key] || 0);
        magA += vecA[key] * vecA[key];
    }
    for (const key in vecB) {
        magB += vecB[key] * vecB[key];
    }
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

const BUDDY_VOCAB = new Set();
BUDDY_KNOWLEDGE.forEach(entry => {
    entry.keywords.forEach(kw => {
        tokenize(kw).forEach(t => BUDDY_VOCAB.add(t));
    });
});

export const HelpBot = ({ mode = 'floating' }) => {
    const { token, API_BASE_URL } = useAuth();
    const [isOpen, setIsOpen] = useState(mode === 'tab');
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isTyping, setIsTyping] = useState(false);

    // Voice playback configurations
    const [voiceEnabled, setVoiceEnabled] = useState(() => {
        try {
            return localStorage.getItem('rody_voice_enabled') === 'true';
        } catch (e) {
            return false;
        }
    });

    // Sync voices changes in browser speechSynthesis engine
    useEffect(() => {
        const handleVoicesChanged = () => {
            if (window.speechSynthesis) {
                window.speechSynthesis.getVoices();
            }
        };
        if (window.speechSynthesis) {
            window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
        }
        return () => {
            if (window.speechSynthesis) {
                window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
            }
        };
    }, []);

    const toggleVoicePlayback = () => {
        const nextVal = !voiceEnabled;
        setVoiceEnabled(nextVal);
        localStorage.setItem('rody_voice_enabled', String(nextVal));
        if (!nextVal && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    };

    const speakText = (text) => {
        if (!window.speechSynthesis) return;
        try {
            window.speechSynthesis.cancel();
            
            // Clean markdown syntax before speaking
            const cleanText = text
                .replace(/[*_#`~>]/g, '')
                .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
                
            const utterance = new SpeechSynthesisUtterance(cleanText);
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
                                    voices.find(v => v.lang.startsWith('en'));
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }
            utterance.rate = 1.0;
            utterance.pitch = 1.05;
            
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.error("Speech Synthesis failed:", e);
        }
    };

    const [tourStep, setTourStep] = useState(() => {
        try {
            return localStorage.getItem('rody_tour_step') || null;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        try {
            if (tourStep) {
                localStorage.setItem('rody_tour_step', tourStep);
            } else {
                localStorage.removeItem('rody_tour_step');
            }
        } catch (e) {
            console.error(e);
        }
    }, [tourStep]);

    const startGuidedTour = () => {
        setTourStep('1_UPLOAD');
        setMessages(prev => [
            ...prev,
            { sender: 'user', text: "Start Guided Tour", timestamp: new Date() },
            {
                sender: 'bot',
                text: "Welcome to the Rotordyn.ai Guided Tour! I'm RoDy, your diagnostics buddy, and I will be guiding you step-by-step.\n\nFirst, let's load a machine telemetry dataset! Drag and drop a CSV file or click the upload area in the left panel to begin.",
                timestamp: new Date()
            }
        ]);
    };

    // Implicit action tracker and onboarding tour progression
    useEffect(() => {
        const adjustLocalWeight = (topicKey, amount) => {
            try {
                const saved = localStorage.getItem('rody_weights');
                const localWeights = saved ? JSON.parse(saved) : {};
                localWeights[topicKey] = Math.min(2.0, (localWeights[topicKey] || 0) + amount);
                localStorage.setItem('rody_weights', JSON.stringify(localWeights));
            } catch (e) {
                console.error(e);
            }
        };

        const handleFileLoaded = (e) => {
            adjustLocalWeight("upload", 0.05);
            if (tourStep === '1_UPLOAD') {
                setTourStep('2_ISO');
                setMessages(prev => [...prev, {
                    sender: 'bot',
                    text: `Great job loading "${e.detail?.filename || 'dataset'}"! I've rendered the dynamic Trend, Bode, and Orbit plots.\n\nNow let's check compliance alert zones. Toggle the 'Show ISO 20816 Limits' checkbox located under your vibration charts!`,
                    timestamp: new Date()
                }]);
                setMemory(prev => ({ ...prev, affinity: (prev.affinity || 0) + 1 }));
            }
        };

        const handleIsoToggled = () => {
            adjustLocalWeight("iso", 0.05);
            if (tourStep === '2_ISO') {
                setTourStep('3_SLOWROLL');
                setMessages(prev => [...prev, {
                    sender: 'bot',
                    text: `Excellent! You can now see the Green, Yellow, Orange, and Red ISO threshold bands overlaid on your charts.\n\nNext, let's subtract runout baseline vectors to isolate the true dynamic motion. In the left panel under 'Vector Slow-Roll', select a low-speed baseline sample (e.g. 200-400 RPM) and click 'Subtract Baseline' (or check 'Enable Slow Roll Compensation')!`,
                    timestamp: new Date()
                }]);
                setMemory(prev => ({ ...prev, affinity: (prev.affinity || 0) + 1 }));
            }
        };

        const handleSlowRollSubtracted = () => {
            adjustLocalWeight("slow roll", 0.05);
            if (tourStep === '3_SLOWROLL') {
                setTourStep('4_REPORT');
                setMessages(prev => [...prev, {
                    sender: 'bot',
                    text: `Fantastic! The vector runout has been subtracted, and your plots are updated to show the true dynamic amplitude.\n\nFor our final step, let's compile our diagnostic findings! Click the 'Generate AI Report' button (or 'Generate AI PDF Report' in the toolbar on the upper right side).`,
                    timestamp: new Date()
                }]);
                setMemory(prev => ({ ...prev, affinity: (prev.affinity || 0) + 1 }));
            }
        };

        const handleReportGenerated = () => {
            adjustLocalWeight("report", 0.05);
            if (tourStep === '4_REPORT') {
                setTourStep(null);
                setMessages(prev => [...prev, {
                    sender: 'bot',
                    text: `Incredible! Your comprehensive AI Diagnostics report has been compiled and is ready for export. You've completed the tour and are now fully calibrated as a machinery analyst!\n\nHigh-five, partner! 🤝`,
                    timestamp: new Date()
                }]);
                setMemory(prev => ({ ...prev, affinity: (prev.affinity || 0) + 5 }));
            }
        };

        window.addEventListener('rody_file_loaded', handleFileLoaded);
        window.addEventListener('rody_iso_toggled', handleIsoToggled);
        window.addEventListener('rody_slowroll_subtracted', handleSlowRollSubtracted);
        window.addEventListener('rody_report_generated', handleReportGenerated);

        return () => {
            window.removeEventListener('rody_file_loaded', handleFileLoaded);
            window.removeEventListener('rody_iso_toggled', handleIsoToggled);
            window.removeEventListener('rody_slowroll_subtracted', handleSlowRollSubtracted);
            window.removeEventListener('rody_report_generated', handleReportGenerated);
        };
    }, [tourStep]);

    useEffect(() => {
        if (mode === 'tab') {
            setIsOpen(true);
        }
    }, [mode]);
    
    // Persistent buddy memory
    const [memory, setMemory] = useState(() => {
        try {
            const saved = localStorage.getItem('rody_memory');
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
            localStorage.setItem('rody_memory', JSON.stringify(memory));
        } catch (e) {
            console.error(e);
        }
    }, [memory]);

    // Initial greeting based on memory
    useEffect(() => {
        let greeting = "Hey there! I'm RoDy, your diagnostics co-pilot. ";
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

    const handleFeedback = (msgIndex, scoreType) => {
        setMessages(prev => prev.map((msg, i) => {
            if (i === msgIndex) {
                const targetKey = msg.topicKey;
                if (targetKey) {
                    try {
                        const saved = localStorage.getItem('rody_weights');
                        const localWeights = saved ? JSON.parse(saved) : {};
                        const currentW = localWeights[targetKey] || 0;
                        if (scoreType === 'positive') {
                            localWeights[targetKey] = Math.min(2.0, currentW + 0.1);
                        } else {
                            localWeights[targetKey] = Math.max(-0.8, currentW - 0.2);
                        }
                        localStorage.setItem('rody_weights', JSON.stringify(localWeights));
                    } catch (e) {
                        console.error("Failed to save local weights:", e);
                    }
                }
                return { ...msg, feedback: scoreType };
            }
            return msg;
        }));
    };

    const handleSend = async (textToSend) => {
        const queryText = textToSend || input;
        if (!queryText.trim()) return;

        if (queryText.trim().toLowerCase() === '/sentry' || queryText.trim().toLowerCase() === '/sentry-debug') {
            const userMsg = { sender: 'user', text: queryText, timestamp: new Date() };
            const botResponse = {
                sender: 'bot',
                text: "Here is your test button to trigger a frontend Sentry exception. Click it to throw an unhandled Error:",
                isSentryTest: true,
                timestamp: new Date()
            };
            setMessages([...messages, userMsg, botResponse]);
            setInput('');
            return;
        }

        // Save message
        const userMsg = { sender: 'user', text: queryText, timestamp: new Date() };
        
        // Cache messages state array with current message appended
        const currentMessagesList = [...messages, userMsg];
        setMessages(currentMessagesList);
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
            nameExtracted = nameExtracted.charAt(0).toUpperCase() + nameExtracted.slice(1);
            nextMemory.userName = nameExtracted;
        }

        setMemory(nextMemory);
        setIsTyping(true);

        // Retrieve fresh token from supabase to avoid session expiration issues
        let freshToken = token;
        try {
            const sessionRes = await supabase.auth.getSession();
            if (sessionRes.data.session?.access_token) {
                freshToken = sessionRes.data.session.access_token;
            }
        } catch (tokenErr) {
            console.warn("Could not retrieve fresh token in HelpBot:", tokenErr);
        }

        const apiBase = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '';
        
        // Build chat history of last 10 messages for conversational context
        const chatHistory = currentMessagesList
            .filter(msg => msg.text)
            .slice(-10)
            .map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: msg.text
            }));

        try {
            const response = await fetch(`${apiBase}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${freshToken}`
                },
                body: JSON.stringify({
                    message: queryText,
                    history: chatHistory.slice(0, -1) // slice out the last message which we pass in "message" body field
                })
            });

            if (!response.ok) {
                throw new Error(`Chat API request failed: ${response.status}`);
            }

            const data = await response.json();
            const replyText = data.reply;

            setMessages(prev => [...prev, { sender: 'bot', text: replyText, timestamp: new Date() }]);
            
            // Narrate answer out loud if speaker is unmuted
            if (voiceEnabled) {
                speakText(replyText);
            }

        } catch (chatErr) {
            console.warn("Co-pilot chat request failed, falling back to local KB:", chatErr);
            // Local fallback
            let replyText = "";
            let topicKey = "";
            if (nameExtracted) {
                replyText = `Awesome! I'll remember that, ${nameExtracted}. Nice to partner up! Let me know if you need help uploading telemetry data or managing subscriptions.`;
            } else {
                const localResponse = getBuddyResponse(queryText, nextMemory);
                replyText = localResponse.answer;
                topicKey = localResponse.topicKey;
            }

            setMessages(prev => [...prev, { sender: 'bot', text: replyText, topicKey: topicKey, timestamp: new Date() }]);
            if (voiceEnabled) {
                speakText(replyText);
            }
        } finally {
            setIsTyping(false);
        }
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
            return {
                answer: "I am not authorized to disclose confidential system credentials, backend connection strings, database keys, or API tokens. Let's keep our session safe and focus on workspace analysis features!",
                topicKey: ""
            };
        }

        // Check dictionary using Cosine Similarity classifier
        const localKnowledgeRaw = localStorage.getItem('rody_local_knowledge');
        let localKnowledge = [];
        if (localKnowledgeRaw) {
            try {
                localKnowledge = JSON.parse(localKnowledgeRaw);
            } catch (e) {}
        }
        
        const activeVocab = new Set(BUDDY_VOCAB);
        localKnowledge.forEach(entry => {
            entry.keywords.forEach(kw => {
                tokenize(kw).forEach(t => activeVocab.add(t));
            });
        });
        
        const queryTokens = tokenize(query);
        const queryVec = getVector(queryTokens, activeVocab);
        
        let bestEntry = null;
        let highestSim = 0;

        // Load local reinforcement learning weights
        let localWeights = {};
        try {
            const saved = localStorage.getItem('rody_weights');
            localWeights = saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.error("Failed to load local weights:", e);
        }

        const activeKnowledgeList = [...BUDDY_KNOWLEDGE, ...localKnowledge];
        activeKnowledgeList.forEach(entry => {
            // Build document vector from all keywords combined
            const docTokens = [];
            entry.keywords.forEach(kw => {
                tokenize(kw).forEach(t => docTokens.push(t));
            });
            const docVec = getVector(docTokens, activeVocab);
            
            let sim = getCosineSimilarity(queryVec, docVec);
            
            // Adjust score by local feedback weight mapping
            const entryKey = entry.keywords[0];
            const weightVal = localWeights[entryKey] || 0;
            sim *= (1 + weightVal);

            if (sim > highestSim) {
                highestSim = sim;
                bestEntry = entry;
            }
        });

        // Similarity threshold boundary (e.g. 0.15)
        if (bestEntry && highestSim > 0.15) {
            let suffix = "";
            if (currentMemory.affinity >= 15) {
                suffix = `\n\n(P.S. We've compiled a lot of data together, partner. High-five! 🤝)`;
            } else if (currentMemory.affinity === 8) {
                suffix = `\n\n(By the way, you're getting really good at this. Co-pilot affinity calibrated!)`;
            }
            return {
                answer: bestEntry.answer + suffix,
                topicKey: bestEntry.keywords[0]
            };
        }

        // Generic friendly co-pilot responses
        if (currentMemory.userName) {
            return {
                answer: `I'm not fully sure about that one, ${currentMemory.userName}. But I can teach you about loading CSV data, runout slow-roll subtraction, checking ISO vibration bands, or upgrading to our Premium Analyst plan. What should we look at?`,
                topicKey: ""
            };
        }
        return {
            answer: "I didn't quite catch that topic. I can guide you through account setups, dynamic probe configurations, ISO vibration levels, or subscription checkout. Let me know what you need!",
            topicKey: ""
        };
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
                    id="rody-toggle-btn"
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
                    height: '100%',
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
                    {mode !== 'tab' && (
                        <div style={{
                            padding: '14px 18px',
                            background: '#2563eb',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexShrink: 0
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {/* Glowing robot avatar */}
                                <div style={{ position: 'relative', width: '34px', height: '34px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
                                    <FiActivity size={18} style={{ color: '#60a5fa' }} />
                                    <span style={{ position: 'absolute', bottom: 0, right: 0, width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', border: '2px solid #2563eb' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.88rem', fontWeight: 800 }}>RoDy</div>
                                    <div style={{ fontSize: '0.65rem', opacity: 0.85, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        {getRelationshipLabel()}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button
                                    onClick={toggleVoicePlayback}
                                    style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', padding: '4px', opacity: 0.9 }}
                                    title={voiceEnabled ? "Mute voice response" : "Unmute voice response"}
                                >
                                    {voiceEnabled ? <FiVolume2 size={16} /> : <FiVolumeX size={16} />}
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', display: 'flex' }}
                                >
                                    <FiX />
                                </button>
                            </div>
                        </div>
                    )}

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
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                                    maxWidth: '82%',
                                    gap: '4px'
                                }}
                            >
                                <div
                                    style={{
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
                                    {msg.isSentryTest && (
                                        <button
                                            onClick={() => {
                                                throw new Error("Rotordyn Frontend Verification Error: Break the world!");
                                            }}
                                            style={{
                                                display: 'block',
                                                marginTop: '8px',
                                                padding: '6px 12px',
                                                fontSize: '0.8rem',
                                                fontWeight: 'bold',
                                                color: 'white',
                                                backgroundColor: '#ef4444',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            💥 Break the world
                                        </button>
                                    )}
                                </div>
                                
                                {msg.sender === 'bot' && msg.topicKey && (
                                    <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-start', paddingLeft: '4px', marginTop: '2px', alignItems: 'center' }}>
                                        {!msg.feedback ? (
                                            <>
                                                <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Was this helpful?</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleFeedback(index, 'positive')}
                                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', padding: '2px', color: '#64748b' }}
                                                    title="Yes, helpful"
                                                >
                                                    👍
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleFeedback(index, 'negative')}
                                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', padding: '2px', color: '#64748b' }}
                                                    title="No, unhelpful"
                                                >
                                                    👎
                                                </button>
                                            </>
                                        ) : (
                                            <span style={{ fontSize: '0.65rem', color: msg.feedback === 'positive' ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                                {msg.feedback === 'positive' ? '👍 Calibrated!' : '👎 Calibrated!'}
                                            </span>
                                        )}
                                    </div>
                                )}
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
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>RoDy is thinking...</span>
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
                        scrollbarWidth: 'none',
                        flexShrink: 0
                    }}>
                        {PREDEFINED_QUESTIONS.map((q, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    if (q.category === 'tour') {
                                        startGuidedTour();
                                    } else {
                                        handleSend(q.text);
                                    }
                                }}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: '30px',
                                    border: '1px solid #cbd5e1',
                                    backgroundColor: '#ffffff',
                                    color: '#475569',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    flexShrink: 0
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
                        className="helpbot-form"
                        style={{
                            padding: '12px 14px',
                            borderTop: '1px solid #e2e8f0',
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'center',
                            backgroundColor: '#ffffff',
                            flexShrink: 0
                        }}
                    >
                        {isListening ? (
                            <div style={{
                                flexGrow: 1,
                                height: '34px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                                borderRadius: '30px',
                                border: '1px dashed #ef4444'
                            }}>
                                <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 700, marginRight: '6px', fontFamily: 'inherit' }}>Listening</span>
                                <div style={{ width: '3px', height: '10px', backgroundColor: '#ef4444', borderRadius: '3px', animation: 'waveGrow 0.5s ease-in-out infinite alternate' }}></div>
                                <div style={{ width: '3px', height: '16px', backgroundColor: '#ef4444', borderRadius: '3px', animation: 'waveGrow 0.5s ease-in-out infinite alternate 0.15s' }}></div>
                                <div style={{ width: '3px', height: '8px', backgroundColor: '#ef4444', borderRadius: '3px', animation: 'waveGrow 0.5s ease-in-out infinite alternate 0.3s' }}></div>
                                <div style={{ width: '3px', height: '14px', backgroundColor: '#ef4444', borderRadius: '3px', animation: 'waveGrow 0.5s ease-in-out infinite alternate 0.45s' }}></div>
                                <style>{`
                                    @keyframes waveGrow {
                                        0% { transform: scaleY(0.4); }
                                        100% { transform: scaleY(1.2); }
                                    }
                                `}</style>
                            </div>
                        ) : (
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask RoDy co-pilot..."
                                className="helpbot-input"
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
                        )}
                        
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
                        
                        {/* Voice Playback Toggle inside the row */}
                        <button
                            type="button"
                            onClick={toggleVoicePlayback}
                            style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: voiceEnabled ? '#2563eb' : '#f1f5f9',
                                color: voiceEnabled ? 'white' : '#475569',
                                transition: 'all 0.2s ease',
                                flexShrink: 0
                            }}
                            title={voiceEnabled ? "Mute voice playback" : "Unmute voice playback"}
                        >
                            {voiceEnabled ? <FiVolume2 size={14} /> : <FiVolumeX size={14} />}
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
