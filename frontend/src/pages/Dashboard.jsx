import React, {useEffect, useState, useRef} from 'react';
import {useAuth} from '../context/AuthContext';
import {useNavigate} from 'react-router-dom';
import { FiAlertTriangle, FiFolder, FiFolderPlus, FiMoon, FiInfo, FiClock, FiLayout, FiSettings, FiSliders, FiAward, FiPrinter, FiFileText, FiChevronLeft, FiChevronRight, FiPlay, FiPause, FiLogOut } from 'react-icons/fi';
import { supabase } from '../supabaseClient';
import html2canvas from 'html2canvas';



const SessionCache = {
    dbName: 'RotordynCacheDB',
    storeName: 'csvCache',

    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 2);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    set(key, val) {
        return this.openDB().then(db => {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.storeName, 'readwrite');
                const store = tx.objectStore(this.storeName);
                const request = store.put(val, key);
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e.target.error);
            });
        });
    },

    get(key) {
        return this.openDB().then(db => {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.storeName, 'readonly');
                const store = tx.objectStore(this.storeName);
                const request = store.get(key);
                request.onsuccess = (e) => resolve(e.target.result);
                request.onerror = (e) => reject(e.target.error);
            });
        });
    },

    delete(key) {
        return this.openDB().then(db => {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.storeName, 'readwrite');
                const store = tx.objectStore(this.storeName);
                const request = store.delete(key);
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e.target.error);
            });
        });
    }
};

let df = []; // Parsed CSV Data
let singlePrefixes = []; // Array of all channel prefixes (e.g. BRG1X, BRG1_Seis)
let bearingPairs = []; // Array of proximity pairs (e.g. BRG1)
let bearingPairsMapping = {}; // Maps bearing base name to X/Y channel prefixes
let allDatasetColumns = []; // All columns present in the dataset
let expandedTreeNodes = new Set();
let baselineThresholds = {};
let plotSlots = [
    {
        bearingOrChannel: 'BRG1X',
        category: 'trend',
        isDual: false,
        layoutLimits: { min: null, max: null, autoScale: true }
    },
    {
        bearingOrChannel: 'BRG1',
        category: 'orbit',
        isDual: false,
        layoutLimits: { min: null, max: null, autoScale: true },
        showTimebase: true,
        showTrace2: false,
        cycles: 8
    }
];
let activeSlotIndex = 0;
let currentLayout = '2H';
let currentGridPage = 0;
let customizeLayoutMode = false;
let timeSyncCursor = true;
let activeCursorIndex = 0;
let x_gap_rest_global = {};
let y_gap_rest_global = {};
let activeActivityTab = 'tree';
let isDrawerOpen = false;
let cachedFilteredDf = null;
let savedSlowRollSamples = [];
let activeSlowRollSampleId = null;
let slowRollCompensationEnabled = false;
let timelineIntervalId = null;
let isTimelinePlaying = false;
let timelineStepSize = 1;
let timelinePlaybackDelay = 200;
let timelinePlotlyContainer = null;

export const Dashboard = ({ view }) => {
    const {user, setUser, token, logout, API_BASE_URL} = useAuth();
    const navigate = useNavigate();
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [scriptsLoadingError, setScriptsLoadingError] = useState('');
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [isDark, setIsDark] = useState(document.documentElement.style.getPropertyValue('--paper-bg-color').trim() === '#0f172a');
    const [currentLayoutState, setCurrentLayoutState] = useState(() => {
        try {
            const saved = localStorage.getItem('rotordyn_custom_layout');
            return saved || '2H';
        } catch (e) {
            return '2H';
        }
    });
    const currentLayoutRef = useRef('2H');

    // Hook 1: Dynamic Parallel Script Loader
    useEffect(() => {
        const primaryScripts = [
            '/papaparse.min.js',
            '/jszip.min.js',
            '/xlsx.full.min.js',
            '/plotly-2.32.0.min.js',
            '/three.min.js'
        ];

        let active = true;

        const loadAll = async () => {
            try {
                // 1. Load primary scripts in parallel
                await Promise.all(primaryScripts.map(src => {
                    return new Promise((resolve, reject) => {
                        const existingScript = document.querySelector('script[src="' + src + '"]');
                        if (existingScript) {
                            if (existingScript.dataset.loaded === 'true') {
                                resolve();
                            } else {
                                existingScript.addEventListener('load', () => resolve());
                                existingScript.addEventListener('error', (e) => reject(e));
                            }
                            return;
                        }
                        const script = document.createElement('script');
                        script.src = src;
                        script.async = true;
                        script.onload = () => {
                            script.dataset.loaded = 'true';
                            resolve();
                        };
                        script.onerror = () => reject(new Error('Failed to load script: ' + src));
                        document.head.appendChild(script);
                    });
                }));

                // 2. Load OrbitControls sequentially after THREE is globally defined
                const controlsSrc = '/OrbitControls.js';
                await new Promise((resolve, reject) => {
                    const existingScript = document.querySelector('script[src="' + controlsSrc + '"]');
                    if (existingScript) {
                        if (existingScript.dataset.loaded === 'true') {
                            resolve();
                        } else {
                            existingScript.addEventListener('load', () => resolve());
                            existingScript.addEventListener('error', (e) => reject(e));
                        }
                        return;
                    }
                    const script = document.createElement('script');
                    script.src = controlsSrc;
                    script.async = false; // Run synchronously in main thread to ensure THREE is mapped first
                    script.onload = () => {
                        script.dataset.loaded = 'true';
                        resolve();
                    };
                    script.onerror = () => reject(new Error('Failed to load OrbitControls: ' + controlsSrc));
                    document.head.appendChild(script);
                });

                if (active) {
                    setScriptsLoaded(true);
                }
            } catch (err) {
                if (active) {
                    setScriptsLoadingError(err.message);
                }
            }
        };

        loadAll();

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!scriptsLoaded) return;

        if (view === 'dashboard' && !window.activeWorkspaceDataset) {
            SessionCache.get('csv_filename')
                .then(cachedName => {
                    if (!cachedName) {
                        navigate('/upload');
                    }
                })
                .catch(() => {
                    navigate('/upload');
                });
        }

        // Expose credentials and logout function to global scripts scope
        window.API_BASE_URL = API_BASE_URL;
        window.logout = () => {
            logout();
            navigate('/auth');
        };

        // Initialize and expose Bearing Clearance
        window.bearingClearance = window.bearingClearance !== undefined ? window.bearingClearance : 12.0;
        window.handleClearanceChange = (val) => {
            const num = parseFloat(val);
            if (!isNaN(num) && num > 0) {
                window.bearingClearance = num;
                const display = document.getElementById('bearing-clearance-val');
                if (display) display.innerText = num.toFixed(1);
                window.renderGrid && window.renderGrid();
            }
        };

        // Multi-Spool/Keyphaser Speed Sensor Selection
        window.detectedSpeedCols = window.detectedSpeedCols || [];
        window.handleSpeedSensorChange = (val) => {
            if (val) {
                speedCol = val;
                
                // Update filter controls for RPM sliders based on the new speed column
                if (window.populateFilterControls) {
                    window.populateFilterControls();
                }
                
                // Re-render the timeline waveform
                if (window.renderTimelineWaveformPlot) {
                    window.renderTimelineWaveformPlot();
                }
                // Re-render the grid
                if (window.renderGrid) {
                    window.renderGrid();
                }
            }
        };

        function updateSpeedSensorDropdown() {
            const selectEl = document.getElementById('speed-sensor-select');
            if (selectEl && window.detectedSpeedCols) {
                selectEl.innerHTML = '';
                if (window.detectedSpeedCols.length === 0) {
                    selectEl.innerHTML = '<option value="">(No Speed Sensors Found)</option>';
                } else {
                    window.detectedSpeedCols.forEach(col => {
                        const opt = document.createElement('option');
                        opt.value = col;
                        opt.innerText = col;
                        if (col === speedCol) {
                            opt.selected = true;
                        }
                        selectEl.appendChild(opt);
                    });
                }
            }
        }
        window.updateSpeedSensorDropdown = updateSpeedSensorDropdown;

        // Sync input state on component mount
        const clearanceTimeout = setTimeout(() => {
            const clearanceInput = document.getElementById('bearing-clearance-input');
            if (clearanceInput && window.bearingClearance !== undefined) {
                clearanceInput.value = window.bearingClearance;
            }
            const clearanceVal = document.getElementById('bearing-clearance-val');
            if (clearanceVal && window.bearingClearance !== undefined) {
                clearanceVal.innerText = window.bearingClearance.toFixed(1);
            }
        }, 100);

        // Main Dashboard Javascript Logic
        activeActivityTab = activeActivityTab || 'tree';
        isDrawerOpen = isDrawerOpen !== undefined ? isDrawerOpen : false; // Start collapsed by default

        function fetchTeamMembers() {
            const apiBase = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '';
            const listContainer = document.getElementById('team-members-list');
            if (!listContainer) return;
            
            listContainer.innerHTML = '<p style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 10px;">Loading workspace crew...</p>';
            
            fetch(`${apiBase}/auth/team`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            })
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch team members");
                return res.json();
            })
            .then(members => {
                listContainer.innerHTML = '';
                if (!members || members.length === 0) {
                    listContainer.innerHTML = '<p style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 10px;">No workspace members found.</p>';
                    return;
                }
                
                members.forEach(member => {
                    const div = document.createElement('div');
                    div.style.padding = '8px';
                    div.style.background = 'rgba(255, 255, 255, 0.03)';
                    div.style.border = '1px solid var(--border-color)';
                    div.style.borderRadius = '4px';
                    div.style.marginBottom = '6px';
                    div.style.fontSize = '0.75rem';
                    div.style.display = 'flex';
                    div.style.flexDirection = 'column';
                    div.style.gap = '2px';
                    
                    let statusColor = '#f59e0b';
                    if (member.status === 'approved') statusColor = '#10b981';
                    
                    div.innerHTML = `
                        <div style="font-weight: 600; color: var(--text-color);">${member.name} ${member.id === (user ? user.id : '') ? '<b>(You)</b>' : ''}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">${member.email}</div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                            <span style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">${member.role}</span>
                            <span style="font-size: 0.65rem; color: ${statusColor}; font-weight: bold; text-transform: uppercase;">● ${member.status}</span>
                        </div>
                    `;
                    listContainer.appendChild(div);
                });
            })
            .catch(err => {
                console.error("Error fetching team members:", err);
                listContainer.innerHTML = `<p style="font-size: 0.75rem; color: #ef4444; text-align: center; padding: 10px;">Error loading team: ${err.message}</p>`;
            });
        }

        function selectActivityTab(tabName) {
            const container = document.getElementById('main-container');
            const toggleBtn = document.getElementById('sidebar-toggle-btn');
            const toggleIconBtn = document.getElementById('act-btn-toggle');
            
            // If drawer is open and we click the already active tab, close it
            if (isDrawerOpen && activeActivityTab === tabName) {
                closePanelDrawer();
                return;
            }
            
            activeActivityTab = tabName;
            isDrawerOpen = true;
            
            // Highlight selected button, show tab content
            const tabs = ['profile', 'data', 'tree', 'filters', 'styles', 'diagnostics', 'team'];
            tabs.forEach(t => {
                const btn = document.getElementById(`act-btn-${t}`);
                const content = document.getElementById(`tab-content-${t}`);
                if (btn) btn.classList.toggle('active', t === tabName);
                if (content) {
                    content.classList.toggle('active', t === tabName);
                }
            });
            
            // Update Drawer Title
            const titleMap = {
                profile: 'My Profile',
                data: 'Dataset Source',
                tree: 'Sensor Navigation',
                filters: 'Timeline & RPM Filters',
                styles: 'Styles & Formatting',
                diagnostics: 'AI Diagnostics Report',
                team: 'Team & Workspace'
            };
            document.getElementById('drawer-title').innerText = titleMap[tabName] || '';
            
            // Fetch team members if switching to team tab
            if (tabName === 'team') {
                fetchTeamMembers();
            }

            // Load signal formatting values if switching to styles tab
            if (tabName === 'styles') {
                loadSignalFormat(selectedSignalFormat);
            }
            
            // Expand drawer
            container.style.setProperty('--sidebar-width', '320px');
            if (toggleBtn) {
                toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;display:block;margin:auto;"><polyline points="15 18 9 12 15 6"/></svg>';
                toggleBtn.title = "Collapse Sidebar";
            }
            if (toggleIconBtn) {
                toggleIconBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                `;
                toggleIconBtn.title = "Collapse Menu Panel";
            }
            
            triggerResizeWithTimeout();
        }

        function closePanelDrawer() {
            const container = document.getElementById('main-container');
            const toggleBtn = document.getElementById('sidebar-toggle-btn');
            const toggleIconBtn = document.getElementById('act-btn-toggle');
            
            isDrawerOpen = false;
            
            // Unhighlight all buttons
            const tabs = ['profile', 'data', 'tree', 'filters', 'styles', 'diagnostics', 'team'];
            tabs.forEach(t => {
                const btn = document.getElementById(`act-btn-${t}`);
                const content = document.getElementById(`tab-content-${t}`);
                if (btn) btn.classList.remove('active');
                if (content) content.classList.remove('active');
            });
            
            // Collapse to 60px
            container.style.setProperty('--sidebar-width', '60px');
            if (toggleBtn) {
                toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;display:block;margin:auto;"><polyline points="9 18 15 12 9 6"/></svg>';
                toggleBtn.title = "Expand Sidebar";
            }
            if (toggleIconBtn) {
                toggleIconBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                `;
                toggleIconBtn.title = "Expand Menu Panel";
            }
            
            triggerResizeWithTimeout();
        }

        function toggleSidebarGlobal() {
            if (isDrawerOpen) {
                closePanelDrawer();
            } else {
                selectActivityTab(activeActivityTab);
            }
        }

        function toggleSidebar() {
            toggleSidebarGlobal();
        }

        function triggerResizeWithTimeout() {
            setTimeout(() => {
                plotSlots.forEach((config, idx) => {
                    if (config && config.category !== 'mode_shape') {
                        const containerDiv = document.getElementById(`plotly-container-${idx}`);
                        if (containerDiv) {
                            renderPlotInSlot(idx, containerDiv, config.bearingOrChannel, config.category);
                        }
                    }
                });
                const tlChart = document.getElementById('timeline-plotly-chart');
                if (tlChart) {
                    Plotly.Plots.resize(tlChart);
                }
            }, 310);
        }
        window.addEventListener('resize', triggerResizeWithTimeout);

        df = df || []; // Parsed CSV Data
        singlePrefixes = singlePrefixes || []; // Array of all channel prefixes (e.g. BRG1X, BRG1_Seis)
        bearingPairs = bearingPairs || []; // Array of proximity pairs (e.g. BRG1)
        bearingPairsMapping = bearingPairsMapping || {}; // Maps bearing base name to X/Y channel prefixes
        allDatasetColumns = allDatasetColumns || []; // All columns present in the dataset
        expandedTreeNodes = expandedTreeNodes || new Set();
        baselineThresholds = baselineThresholds || {};
        
        function calculateBaselineThresholds() {
            baselineThresholds = {};
            if (!df || df.length === 0) return;
            
            const cols = Object.keys(df[0]);
            const directCols = cols.filter(c => c.toLowerCase().endsWith('_direct'));
            if (directCols.length === 0) return;
            
            const baselinePoints = df.slice(0, Math.min(20, df.length));
            
            directCols.forEach(col => {
                let sum = 0;
                let count = 0;
                baselinePoints.forEach(r => {
                    if (isNumber(r[col])) {
                        sum += r[col];
                        count++;
                    }
                });
                
                if (count === 0) return;
                const mean = sum / count;
                
                let sumSqDiff = 0;
                baselinePoints.forEach(r => {
                    if (isNumber(r[col])) {
                        sumSqDiff += Math.pow(r[col] - mean, 2);
                    }
                });
                const stdDev = Math.sqrt(sumSqDiff / count);
                baselineThresholds[col] = Math.max(0.8, mean + 3 * stdDev);
            });
        }

        let speedCol = 'Speed(P)';
        let tsCol = 'Timestamp';
        
        // Active Filter States
        let activeStateFilter = 'all';
        let activeMinRPM = null;
        let activeMaxRPM = null;
        let activeStartTime = 'all';
        let activeEndTime = 'all';

        const signalFormats = {
            direct: { color: '#1e40af', width: 1.5, dash: 'solid', mode: 'lines', marker_size: 4, marker_symbol: 'circle' },
            amp_1x: { color: '#fe0606', width: 1.8, dash: 'solid', mode: 'lines', marker_size: 4, marker_symbol: 'circle' },
            phase_1x: { color: '#fe0606', width: 1.8, dash: 'solid', mode: 'lines', marker_size: 4, marker_symbol: 'circle' },
            amp_2x: { color: '#10b981', width: 1.5, dash: 'dot', mode: 'lines', marker_size: 4, marker_symbol: 'circle' },
            phase_2x: { color: '#10b981', width: 1.5, dash: 'dot', mode: 'lines', marker_size: 4, marker_symbol: 'circle' },
            amp_nx: { color: '#a855f7', width: 1.5, dash: 'dash', mode: 'lines', marker_size: 4, marker_symbol: 'circle' },
            phase_nx: { color: '#a855f7', width: 1.5, dash: 'dash', mode: 'lines', marker_size: 4, marker_symbol: 'circle' },
            gap: { color: '#fb923c', width: 1.5, dash: 'dashdot', mode: 'lines', marker_size: 4, marker_symbol: 'circle' },
            temp: { color: '#fbbf24', width: 1.5, dash: 'dashdot', mode: 'lines', marker_size: 4, marker_symbol: 'circle' },
            speed: { color: '#38bdf8', width: 2.0, dash: 'dot', mode: 'lines', marker_size: 4, marker_symbol: 'circle' },
            load: { color: '#c084fc', width: 1.5, dash: 'dash', mode: 'lines', marker_size: 4, marker_symbol: 'circle' }
        };

        const isNumber = (val) => typeof val === 'number' && !isNaN(val);

        // Cooley-Tukey FFT Decimation-in-time implementation
        function computeFFT(realInput) {
            const n = realInput.length;
            const re = new Float64Array(realInput);
            const im = new Float64Array(n);
            
            // Bit-reversal permutation
            let j = 0;
            for (let i = 0; i < n - 1; i++) {
                if (i < j) {
                    let temp = re[i]; re[i] = re[j]; re[j] = temp;
                    temp = im[i]; im[i] = im[j]; im[j] = temp;
                }
                let m = n >> 1;
                while (m >= 1 && j >= m) {
                    j -= m;
                    m >>= 1;
                }
                j += m;
            }
            
            // FFT stages
            for (let len = 2; len <= n; len <<= 1) {
                const angle = -2 * Math.PI / len;
                const wlen_re = Math.cos(angle);
                const wlen_im = Math.sin(angle);
                for (let i = 0; i < n; i += len) {
                    let w_re = 1.0;
                    let w_im = 0.0;
                    const halfLen = len >> 1;
                    for (let k = 0; k < halfLen; k++) {
                        const u_re = re[i + k];
                        const u_im = im[i + k];
                        const v_re = re[i + k + halfLen] * w_re - im[i + k + halfLen] * w_im;
                        const v_im = re[i + k + halfLen] * w_im + im[i + k + halfLen] * w_re;
                        
                        re[i + k] = u_re + v_re;
                        im[i + k] = u_im + v_im;
                        re[i + k + halfLen] = u_re - v_re;
                        im[i + k + halfLen] = u_im - v_im;
                        
                        const next_w_re = w_re * wlen_re - w_im * wlen_im;
                        w_im = w_re * wlen_im + w_im * wlen_re;
                        w_re = next_w_re;
                    }
                }
            }
            
            // Calculate normalized magnitude with coherent scale correction (2.0 for Hanning)
            const magnitudes = new Float64Array(n / 2);
            for (let i = 0; i < n / 2; i++) {
                magnitudes[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / (n / 2) * 2.0;
            }
            return magnitudes;
        }

        function applyHanningWindow(input) {
            const n = input.length;
            const out = new Float64Array(n);
            for (let i = 0; i < n; i++) {
                const w = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / (n - 1)));
                out[i] = input[i] * w;
            }
            return out;
        }

        function synthesizeChannelWaveform(ch, row, nPoints, fs) {
            const cols = getChannelColumns(ch);
            const speedRpm = row[speedCol] || 0;
            const f1X = speedRpm / 60; // frequency in Hz
            
            const A_1x = cleanJSNumericValue(row[cols.amp_1x]) || 0;
            const phi_1x = (cleanJSNumericValue(row[cols.phase_1x]) || 0) * Math.PI / 180;
            
            const A_2x = cleanJSNumericValue(row[cols.amp_2x]) || (A_1x * 0.15);
            const phi_2x = (cleanJSNumericValue(row[cols.phase_2x]) || 0) * Math.PI / 180;
            
            const A_sub = cleanJSNumericValue(row[cols.amp_nx]) || 0;
            const phi_sub = (cleanJSNumericValue(row[cols.phase_nx]) || 0) * Math.PI / 180;
            
            const A_direct = cleanJSNumericValue(row[cols.direct]) || (A_1x * 1.25 + 0.1);
            
            // Calculate residual noise peak amplitude to match Direct amplitude
            const sumSquaredAmps = (A_1x * A_1x + A_2x * A_2x + A_sub * A_sub) / 2;
            const rmsDirect = A_direct / (2 * Math.sqrt(2));
            const residualRms = Math.sqrt(Math.max(0, (rmsDirect * rmsDirect) - sumSquaredAmps));
            const A_noise = residualRms * Math.sqrt(2);
            
            const signal = new Float64Array(nPoints);
            for (let i = 0; i < nPoints; i++) {
                const t = i / fs;
                let val = 0;
                // 1X
                val += A_1x * Math.cos(2 * Math.PI * f1X * t - phi_1x);
                // 2X
                val += A_2x * Math.cos(2 * Math.PI * (2.0 * f1X) * t - phi_2x);
                // Sub-harmonic (oil whirl at 0.45X)
                if (A_sub > 0) {
                    val += A_sub * Math.cos(2 * Math.PI * (0.45 * f1X) * t - phi_sub);
                } else if (speedRpm > 2400) {
                    const A_whirl = A_1x * 0.25 * Math.min(1.0, (speedRpm - 2400) / 1000);
                    val += A_whirl * Math.cos(2 * Math.PI * (0.45 * f1X) * t - 1.2);
                }
                // 3X
                val += (A_1x * 0.05) * Math.cos(2 * Math.PI * (3.0 * f1X) * t - 0.5);
                // 4X
                val += (A_1x * 0.03) * Math.cos(2 * Math.PI * (4.0 * f1X) * t - 1.8);
                // Uniform noise
                const noise = (Math.random() - 0.5) * 2;
                val += noise * A_noise * 0.8;
                
                signal[i] = val;
            }
            return signal;
        }

        function isDatasetHighFrequencyRaw() {
            if (!df || df.length < 10) return false;
            const tsDiffs = [];
            for (let i = 1; i < Math.min(df.length, 10); i++) {
                if (df[i]._time_ms && df[i-1]._time_ms) {
                    tsDiffs.push(df[i]._time_ms - df[i-1]._time_ms);
                }
            }
            if (tsDiffs.length === 0) return false;
            const avgTsDiff = tsDiffs.reduce((a, b) => a + b, 0) / tsDiffs.length;
            return avgTsDiff > 0 && avgTsDiff < 50; // less than 50ms average spacing
        }

        function getRawWaveformSlice(ch, centerIdx, nPoints) {
            const cols = getChannelColumns(ch);
            const colName = cols.direct || cols.amp_1x || Object.keys(df[0])[2];
            
            const startIdx = Math.max(0, Math.min(df.length - nPoints, centerIdx - Math.floor(nPoints / 2)));
            const slice = new Float64Array(nPoints);
            for (let i = 0; i < nPoints; i++) {
                const val = cleanJSNumericValue(df[startIdx + i][colName]);
                slice[i] = val !== null && !isNaN(val) ? val : 0;
            }
            
            let avgTsDiff = 1.0;
            if (df[startIdx + 1] && df[startIdx]) {
                avgTsDiff = (df[startIdx + nPoints - 1]._time_ms - df[startIdx]._time_ms) / (nPoints - 1);
            }
            if (avgTsDiff <= 0) avgTsDiff = 1.0;
            const fs = 1000 / avgTsDiff;
            
            return { signal: slice, fs: fs };
        }

        function getWaveformForChannel(ch, row, centerIdx, nPoints) {
            if (isDatasetHighFrequencyRaw()) {
                return getRawWaveformSlice(ch, centerIdx, nPoints);
            } else {
                const fs = 2048;
                const signal = synthesizeChannelWaveform(ch, row, nPoints, fs);
                return { signal: signal, fs: fs };
            }
        }

        // Multi-plot State management
        plotSlots = plotSlots || [
            {
                bearingOrChannel: 'BRG1X',
                category: 'trend',
                isDual: false,
                layoutLimits: { min: null, max: null, autoScale: true }
            },
            {
                bearingOrChannel: 'BRG1',
                category: 'orbit',
                isDual: false,
                layoutLimits: { min: null, max: null, autoScale: true },
                showTimebase: true,
                showTrace2: false,
                cycles: 8
            }
        ]; 
        
        try {
            const savedSlots = localStorage.getItem('rotordyn_custom_slots');
            if (savedSlots) {
                const parsed = JSON.parse(savedSlots);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    plotSlots = parsed;
                }
            }
        } catch (e) {
            console.warn("Failed to load saved plot slots:", e);
        }

        activeSlotIndex = activeSlotIndex || 0; 
        currentLayoutRef.current = currentLayoutState;
        currentLayout = currentLayoutRef.current;
        currentGridPage = currentGridPage || 0; 
        customizeLayoutMode = customizeLayoutMode !== undefined ? customizeLayoutMode : false; 
        timeSyncCursor = timeSyncCursor !== undefined ? timeSyncCursor : true; 
        activeCursorIndex = activeCursorIndex || 0; 
        x_gap_rest_global = x_gap_rest_global || {}; 
        y_gap_rest_global = y_gap_rest_global || {}; 

        function getProbeRestAndScale(brg) {
            const scaleInput = document.getElementById('probe-scale-factor-input');
            const scaleFactor = scaleInput ? parseFloat(scaleInput.value) || 5.0 : 5.0;
            
            const manualRestEnabled = document.getElementById('manual-rest-enabled') ? document.getElementById('manual-rest-enabled').checked : false;
            let restX, restY;
            
            if (manualRestEnabled) {
                const manualRestXInput = document.getElementById('manual-rest-x-input');
                const manualRestYInput = document.getElementById('manual-rest-y-input');
                restX = manualRestXInput ? parseFloat(manualRestXInput.value) || 0.0 : 0.0;
                restY = manualRestYInput ? parseFloat(manualRestYInput.value) || 0.0 : 0.0;
            } else {
                restX = x_gap_rest_global[brg] !== undefined ? x_gap_rest_global[brg] : 0.0;
                restY = y_gap_rest_global[brg] !== undefined ? y_gap_rest_global[brg] : 0.0;
            }
            
            return { scaleFactor, restX, restY };
        }

        function convertProbesToPhysical(Sx, Sy) {
            const angleXInput = document.getElementById('probe-angle-x-input');
            const angleYInput = document.getElementById('probe-angle-y-input');
            const probeXAngle = angleXInput ? parseFloat(angleXInput.value) || 135 : 135;
            const probeYAngle = angleYInput ? parseFloat(angleYInput.value) || 45 : 45;
            
            const radX = probeXAngle * Math.PI / 180;
            const radY = probeYAngle * Math.PI / 180;
            const denom = Math.sin(radY - radX);
            
            if (Math.abs(denom) < 0.01) {
                return { x: (Sx - Sy) / Math.sqrt(2), y: (Sx + Sy) / Math.sqrt(2) };
            }
            
            const x = -((Sx * Math.sin(radY) - Sy * Math.sin(radX)) / denom);
            const y = (-Sx * Math.cos(radY) + Sy * Math.cos(radX)) / denom;
            return { x, y };
        }

        let channelUnits = {}; 
        let defaultUnits = {
            speed: 'RPM',
            amp: 'mils',
            phase: 'deg',
            temp: '°C'
        };

        function getChannelUnit(ch, category, defaultVal) {
            if (ch && channelUnits[ch] && channelUnits[ch][category]) {
                return channelUnits[ch][category];
            }
            if (ch) {
                // Try clean channel name (e.g. BRG1X -> BRG1x)
                let cleanCh = ch.toLowerCase();
                for (let key in channelUnits) {
                    if (key.toLowerCase() === cleanCh && channelUnits[key][category]) {
                        return channelUnits[key][category];
                    }
                }
            }
            // Try generic default if specific channel not found
            if (defaultUnits[category]) {
                return defaultUnits[category];
            }
            return defaultVal || '';
        }

        
        // Apply Workspace background colors explicitly
        function applyWorkspaceStyle() {
            const outsideColor = document.getElementById('bg-outside-picker').value;
            const insideColor = document.getElementById('bg-inside-picker').value;
            handleBgOutsideChange(outsideColor);
            handleBgInsideChange(insideColor);
        }


        // Workspace background color handlers

        function handleBgOutsideChange(color) {
            document.documentElement.style.setProperty('--bg-color', color);
            document.documentElement.style.setProperty('--card-color', color);
            const brightness = getBrightness(color);
            if (brightness < 128) {
                document.documentElement.style.setProperty('--text-color', '#f8fafc');
                document.documentElement.style.setProperty('--text-muted', '#94a3b8');
                document.documentElement.style.setProperty('--border-color', '#334155');
            } else {
                document.documentElement.style.setProperty('--text-color', '#0f172a');
                document.documentElement.style.setProperty('--text-muted', '#64748b');
                document.documentElement.style.setProperty('--border-color', '#cbd5e1');
            }
            renderGrid();
        }

        function handleBgInsideChange(color) {
            document.documentElement.style.setProperty('--plot-bg-color', color);
            document.documentElement.style.setProperty('--paper-bg-color', color);
            const brightness = getBrightness(color);
            if (brightness < 140) {
                document.documentElement.style.setProperty('--contrast-grid-color', 'rgba(255, 255, 255, 0.15)');
                document.documentElement.style.setProperty('--plot-text-color', '#f8fafc');
            } else {
                document.documentElement.style.setProperty('--contrast-grid-color', 'rgba(15, 23, 42, 0.1)');
                document.documentElement.style.setProperty('--plot-text-color', '#0f172a');
            }
            renderGrid();
        }

        function getBrightness(hex) {
            hex = hex.replace('#', '');
            if (hex.length === 3) {
                hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
            }
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return (r * 299 + g * 587 + b * 114) / 1000;
        }

        // Curve formatting selectors
        let selectedSignalFormat = 'direct';
        function toggleMarkerControls(mode) {
            const hasMarkers = mode.includes('markers');
            const sizeGroup = document.getElementById('format-marker-size-group');
            const symbolSelect = document.getElementById('format-symbol-select');
            
            if (sizeGroup) sizeGroup.style.display = hasMarkers ? 'block' : 'none';
            if (symbolSelect) {
                symbolSelect.parentElement.style.opacity = hasMarkers ? '1' : '0.5';
                symbolSelect.disabled = !hasMarkers;
            }
        }

        function loadSignalFormat(signal) {
            selectedSignalFormat = signal;
            const fmt = signalFormats[signal];
            if (fmt) {
                document.getElementById('format-color-picker').value = fmt.color;
                document.getElementById('format-dash-select').value = fmt.dash;
                document.getElementById('format-width-input').value = fmt.width;
                document.getElementById('format-width-val').innerText = fmt.width;
                
                document.getElementById('format-mode-select').value = fmt.mode || 'lines';
                document.getElementById('format-symbol-select').value = fmt.marker_symbol || 'circle';
                document.getElementById('format-marker-size-input').value = fmt.marker_size || 4;
                document.getElementById('format-marker-size-val').innerText = fmt.marker_size || 4;
                
                toggleMarkerControls(fmt.mode || 'lines');
            }
        }

        function syncSharedFormats(key, prop, val) {
            if (key === 'amp_1x') {
                signalFormats['phase_1x'][prop] = val;
            } else if (key === 'amp_2x') {
                signalFormats['phase_2x'][prop] = val;
            } else if (key === 'amp_nx') {
                signalFormats['phase_nx'][prop] = val;
            }
        }

        function handleFormatColorChange(color) {
            if (signalFormats[selectedSignalFormat]) {
                signalFormats[selectedSignalFormat].color = color;
                syncSharedFormats(selectedSignalFormat, 'color', color);
                renderGrid();
            }
        }

        function handleFormatDashChange(dash) {
            if (signalFormats[selectedSignalFormat]) {
                signalFormats[selectedSignalFormat].dash = dash;
                syncSharedFormats(selectedSignalFormat, 'dash', dash);
                renderGrid();
            }
        }

        function handleFormatWidthChange(width) {
            document.getElementById('format-width-val').innerText = width;
            if (signalFormats[selectedSignalFormat]) {
                const w = parseFloat(width);
                signalFormats[selectedSignalFormat].width = w;
                syncSharedFormats(selectedSignalFormat, 'width', w);
                renderGrid();
            }
        }

        function handleFormatModeChange(mode) {
            if (signalFormats[selectedSignalFormat]) {
                signalFormats[selectedSignalFormat].mode = mode;
                syncSharedFormats(selectedSignalFormat, 'mode', mode);
                toggleMarkerControls(mode);
                renderGrid();
            }
        }

        function handleFormatSymbolChange(symbol) {
            if (signalFormats[selectedSignalFormat]) {
                signalFormats[selectedSignalFormat].marker_symbol = symbol;
                syncSharedFormats(selectedSignalFormat, 'marker_symbol', symbol);
                renderGrid();
            }
        }

        function handleFormatMarkerSizeChange(size) {
            document.getElementById('format-marker-size-val').innerText = size;
            if (signalFormats[selectedSignalFormat]) {
                const s = parseFloat(size);
                signalFormats[selectedSignalFormat].marker_size = s;
                syncSharedFormats(selectedSignalFormat, 'marker_size', s);
                renderGrid();
            }
        }

        function applyCurveFormatting(trace, signal) {
            const fmt = signalFormats[signal];
            if (!fmt) return;
            trace.mode = fmt.mode || 'lines';
            trace.line = {
                color: fmt.color,
                width: fmt.width,
                dash: fmt.dash
            };
            if (fmt.mode.includes('markers')) {
                if (!trace.marker) trace.marker = {};
                trace.marker.size = fmt.marker_size || 4;
                trace.marker.symbol = fmt.marker_symbol || 'circle';
                if (!trace.marker.color && !trace.marker.colorscale) {
                    trace.marker.color = fmt.color;
                }
            }
        }

        // File drag and drop logic
        const dropZone = document.getElementById('drop-zone');
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, e => {
                e.preventDefault();
                dropZone.classList.add('hover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, e => {
                e.preventDefault();
                dropZone.classList.remove('hover');
            }, false);
        });

        dropZone.addEventListener('drop', e => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                document.getElementById('file-input').files = files;
                handleFileSelect({ target: { files } });
            }
        });

        function cacheCSVInSession(csvText, filename) {
            SessionCache.set('csv_text', csvText)
                .then(() => SessionCache.set('csv_filename', filename))
                .then(() => console.log("Cached dataset in IndexedDB successfully."))
                .catch(err => console.warn("Failed to cache CSV in IndexedDB:", err));
        }

        function uploadDatasetToBackend(csvText, filename) {
            if (typeof token === 'undefined' || !token) {
                console.warn("User is not authenticated. Skipping backend file upload.");
                return;
            }
            
            // Convert to Blob and File object
            const blob = new Blob([csvText], { type: 'text/csv' });
            let uploadName = filename;
            if (!uploadName.toLowerCase().endsWith('.csv') && 
                !uploadName.toLowerCase().endsWith('.xlsx') && 
                !uploadName.toLowerCase().endsWith('.xls')) {
                uploadName = uploadName + '.csv';
            }
            const fileObj = new File([blob], uploadName, { type: 'text/csv' });
            
            // 1. Generate unique stored filename to prevent duplicates
            const uniquePrefix = Math.random().toString(36).substring(2, 12) + '_' + Math.floor(Date.now() / 1000);
            const storedFilename = `${uniquePrefix}_${uploadName}`;
            
            console.log("Uploading dataset directly to Supabase Storage:", storedFilename);
            
            // 2. Upload file to Supabase Storage bucket 'vibration-datasets'
            supabase.storage.from('vibration-datasets').upload(storedFilename, fileObj)
            .then(({ data: uploadData, error: uploadErr }) => {
                if (uploadErr) {
                    throw new Error(`Supabase Storage upload failed: ${uploadErr.message}`);
                }
                
                // 3. Retrieve public URL for the file
                const { data: urlData } = supabase.storage.from('vibration-datasets').getPublicUrl(storedFilename);
                const fileUrl = urlData.publicUrl;
                
                console.log("File uploaded successfully. Storage URL:", fileUrl);
                
                // 4. Send metadata to backend uploads endpoint
                const apiBase = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '';
                return fetch(`${apiBase}/uploads`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        original_filename: uploadName,
                        stored_filename: storedFilename,
                        file_url: fileUrl,
                        file_size: fileObj.size
                    })
                });
            })
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to log upload metadata on backend: ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                console.log("Upload metadata successfully logged on backend:", data);
                if (typeof fetchSavedDatasets !== 'undefined') {
                    fetchSavedDatasets();
                }
            })
            .catch(err => {
                console.error("Failed to process Supabase file upload:", err);
            });
        }

        function fetchSavedDatasets() {
            if (typeof token === 'undefined' || !token) {
                const listContainer = document.getElementById('saved-datasets-list');
                if (listContainer) {
                    listContainer.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-muted); text-align: center;">Authenticate to view your saved datasets.</p>';
                }
                return;
            }
            
            const listContainer = document.getElementById('saved-datasets-list');
            if (!listContainer) return;
            
            const apiBase = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '';
            fetch(`${apiBase}/uploads/history`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            })
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch upload history");
                return res.json();
            })
            .then(history => {
                listContainer.innerHTML = '';
                if (history.length === 0) {
                    listContainer.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-muted); text-align: center;">No saved datasets found. Upload a file to save it.</p>';
                    return;
                }
                
                history.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'saved-dataset-row';
                    row.style.display = 'flex';
                    row.style.justifyContent = 'space-between';
                    row.style.alignItems = 'center';
                    row.style.padding = '8px 12px';
                    row.style.backgroundColor = 'var(--plot-bg-color)';
                    row.style.border = '1px solid var(--border-color)';
                    row.style.borderRadius = '6px';
                    row.style.fontSize = '0.8rem';
                    
                    const nameSpan = document.createElement('span');
                    nameSpan.innerText = item.original_filename;
                    nameSpan.style.fontWeight = '600';
                    nameSpan.style.color = 'var(--text-color)';
                    nameSpan.style.overflow = 'hidden';
                    nameSpan.style.textOverflow = 'ellipsis';
                    nameSpan.style.whiteSpace = 'nowrap';
                    nameSpan.style.maxWidth = '200px';
                    
                    const rightGroup = document.createElement('div');
                    rightGroup.style.display = 'flex';
                    rightGroup.style.alignItems = 'center';
                    rightGroup.style.gap = '8px';
                    
                    const timeSpan = document.createElement('span');
                    const uploadDate = new Date(item.upload_time);
                    timeSpan.innerText = uploadDate.toLocaleDateString();
                    timeSpan.style.color = 'var(--text-muted)';
                    timeSpan.style.fontSize = '0.75rem';
                    
                    const loadBtn = document.createElement('button');
                    loadBtn.innerText = 'Load';
                    loadBtn.className = 'btn-upload';
                    loadBtn.style.padding = '3px 8px';
                    loadBtn.style.fontSize = '0.7rem';
                    loadBtn.style.margin = '0';
                    loadBtn.style.minWidth = '50px';
                    loadBtn.style.backgroundColor = 'var(--accent-color)';
                    loadBtn.style.color = 'white';
                    loadBtn.style.border = 'none';
                    loadBtn.style.borderRadius = '4px';
                    loadBtn.style.cursor = 'pointer';
                    loadBtn.onclick = () => loadDatasetFromServer(item.id, item.original_filename);
                    
                    rightGroup.appendChild(timeSpan);
                    rightGroup.appendChild(loadBtn);
                    
                    row.appendChild(nameSpan);
                    row.appendChild(rightGroup);
                    listContainer.appendChild(row);
                });
            })
            .catch(err => {
                console.error("Error fetching history:", err);
                listContainer.innerHTML = '<p style="font-size: 0.8rem; color: #ef4444; text-align: center;">Error loading saved datasets.</p>';
            });
        }

        function loadDatasetFromServer(uploadId, filename) {
            showLoader(true, `Downloading saved dataset: ${filename}...`);
            const apiBase = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '';
            fetch(`${apiBase}/uploads/${uploadId}`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            })
            .then(res => {
                if (!res.ok) throw new Error(`Failed to download file from server: ${res.status}`);
                return res.blob();
            })
            .then(blob => {
                const fileObj = new File([blob], filename, { type: blob.type });
                handleMultiFileImport([fileObj]);
            })
            .catch(err => {
                console.error("Failed to load dataset:", err);
                showUploadError(`Failed to load dataset: ${err.message}`);
                showLoader(false);
            });
        }

                // Local CSV Auto-fetch served scenario / cache loader
        if (typeof fetchSavedDatasets !== 'undefined') {
            fetchSavedDatasets();
        }

        if (view === 'dashboard') {
            if (df && df.length > 0) {
                populateFilterControls();
                populateSidebarTree();
                renderGrid();
                
                // Repopulate dataset summary statistics (restores fields on navigation back)
                try {
                    const currentFilename = window.activeWorkspaceDataset || 'merged_machine_data.csv';
                    const speeds = df.map(r => r[speedCol] || 0);
                    const minSpeed = Math.min(...speeds);
                    const maxSpeed = Math.max(...speeds);
                    const firstTs = df[0][tsCol];
                    const lastTs = df[df.length - 1][tsCol];
                    const firstTsStr = firstTs ? String(firstTs) : '';
                    const lastTsStr = lastTs ? String(lastTs) : '';
                    const t_first = firstTsStr ? (firstTsStr.split(' ')[1] || firstTsStr).slice(0, 8) : '-';
                    const t_last = lastTsStr ? (lastTsStr.split(' ')[1] || lastTsStr).slice(0, 8) : '-';

                    const summaryPts = document.getElementById('data-summary-points');
                    const summaryRpm = document.getElementById('data-summary-rpm');
                    const summaryTime = document.getElementById('data-summary-time');
                    const summaryFilename = document.getElementById('sidebar-active-filename');

                    if (summaryPts) summaryPts.innerText = df.length.toLocaleString();
                    if (summaryRpm) summaryRpm.innerText = `${Math.round(minSpeed)} - ${Math.round(maxSpeed)} RPM`;
                    if (summaryTime) summaryTime.innerText = `${t_first} - ${t_last}`;
                    if (summaryFilename) summaryFilename.innerText = currentFilename.split('/').pop().split('\\').pop();
                } catch (e) {
                    console.error("Failed to restore dataset summary:", e);
                }

                if (typeof runAIDiagnostics === 'function') {
                    runAIDiagnostics();
                }
            } else {
                SessionCache.get('csv_filename')
                    .then(cachedName => {
                        if (cachedName) {
                            return SessionCache.get('csv_text').then(cachedText => {
                                if (cachedText) {
                                    parseCSVData(cachedText, cachedName);
                                    return true;
                                }
                                return false;
                            });
                        }
                        return false;
                    })
                    .then(loadedFromCache => {
                        if (!loadedFromCache) {
                            navigate('/upload');
                        }
                    })
                    .catch(err => {
                        console.warn("IndexedDB cache read failed:", err);
                        navigate('/upload');
                    });
            }
        } else {
            // view === 'upload'
            SessionCache.get('csv_filename')
                .then(cachedName => {
                    if (cachedName) {
                        return SessionCache.get('csv_text').then(cachedText => {
                            if (cachedText) {
                                const btnLoadCached = document.getElementById('btn-load-cached');
                                if (btnLoadCached) {
                                    btnLoadCached.innerText = `Load Last Selected Dataset (${cachedName.split('/').pop().split('\\').pop()})`;
                                    btnLoadCached.style.display = 'block';
                                }
                                return true;
                            }
                            return false;
                        });
                    }
                    return false;
                })
                .then(loadedFromCache => {
                    if (loadedFromCache) return;
                    
                    fetch('output/merged_machine_data.csv')
                        .then(response => {
                            if (!response.ok) throw new Error("Could not auto-fetch served file.");
                            return response.text();
                        })
                        .then(csvText => {
                            cacheCSVInSession(csvText, "output/merged_machine_data.csv");
                            parseCSVData(csvText, "output/merged_machine_data.csv");
                        })
                        .catch(err => {
                            console.log("No served merged CSV auto-detected. Awaiting local drag & drop.");
                        });
                })
                .catch(err => {
                    console.warn("IndexedDB cache read failed:", err);
                });
        }

        function loadCachedDataset() {
            showLoader(true);
            SessionCache.get('csv_filename')
                .then(cachedName => {
                    if (cachedName) {
                        return SessionCache.get('csv_text').then(cachedText => {
                            if (cachedText) {
                                parseCSVData(cachedText, cachedName);
                            } else {
                                showLoader(false);
                            }
                        });
                    } else {
                        showLoader(false);
                    }
                })
                .catch(err => {
                    console.warn("Failed to load cached dataset:", err);
                    showLoader(false);
                });
        }

        window.outputDirHandle = null;

        async function selectOutputDirectory() {
            try {
                window.outputDirHandle = await window.showDirectoryPicker({
                    mode: 'readwrite'
                });
                alert(`Output folder successfully locked! Files will now save directly inside: ${window.outputDirHandle.name}`);
            } catch (err) {
                console.warn(err);
                alert("Directory selection cancelled or not supported by this browser. Defaulting to Downloads folder.");
            }
        }

        async function saveFileToLocalDirectory(filename, blob) {
            if (!window.outputDirHandle) return false;
            try {
                const fileHandle = await window.outputDirHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                return true;
            } catch (err) {
                console.error("Direct file save failed:", err);
                return false;
            }
        }

        function dataURItoBlob(dataURI) {
            const byteString = atob(dataURI.split(',')[1]);
            const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            return new Blob([ab], { type: mimeString });
        }

        async function exportMergedCSV() {
            if (!df || df.length === 0) {
                alert("No dataset loaded to export.");
                return;
            }
            try {
                const clean_export = df.map(row => {
                    const r = { ...row };
                    delete r._date;
                    delete r._time_ms;
                    return r;
                });
                let prefixLines = "";
                for (let ch in channelUnits) {
                    for (let cat in channelUnits[ch]) {
                        prefixLines += `# Unit_${ch}_${cat}: ${channelUnits[ch][cat]}\n`;
                    }
                }
                const csvContent = prefixLines + Papa.unparse(clean_export);
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                
                const cachedName = await SessionCache.get('csv_filename');
                const filename = cachedName ? cachedName.split('/').pop().split('\\').pop() : 'merged_dataset.csv';

                if (window.outputDirHandle) {
                    const success = await saveFileToLocalDirectory(filename, blob);
                    if (success) {
                        alert(`CSV successfully saved directly to output folder: ${window.outputDirHandle.name}/${filename}`);
                        return;
                    }
                }

                // Fallback
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (err) {
                console.error("Export failed:", err);
                alert("Failed to export dataset: " + err.message);
            }
        }

        async function downloadSlotPlot(slotIdx) {
            const card = document.getElementById(`grid-card-${slotIdx}`);
            if (!card) {
                alert("No plot card found to save.");
                return;
            }
            const config = plotSlots[slotIdx];
            const filename = `${config.bearingOrChannel}_${config.category}_plot.png`;
            
            showLoader(true, "Generating high-quality plot image...");
            
            const actions = document.getElementById(`header-actions-${slotIdx}`);
            const originalDisplay = actions ? actions.style.display : '';
            
            try {
                if (actions) actions.style.display = 'none';
                
                const canvas = await html2canvas(card, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false
                });
                
                const dataUrl = canvas.toDataURL('image/png');
                const blob = dataURItoBlob(dataUrl);
                
                if (window.outputDirHandle) {
                    const success = await saveFileToLocalDirectory(filename, blob);
                    if (success) {
                        alert(`Plot successfully saved directly to output folder: ${window.outputDirHandle.name}/${filename}`);
                        return;
                    }
                }
                
                const link = document.createElement('a');
                link.download = filename;
                link.href = dataUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                alert(`Plot successfully saved as '${filename}' to your browser's default Downloads folder.`);
                
            } catch (err) {
                console.error("Failed to export plot image:", err);
                alert("Failed to save plot image: " + err.message);
            } finally {
                if (actions) actions.style.display = originalDisplay;
                showLoader(false);
            }
        }

        async function downloadAllPlots() {
            let count = 0;
            let directCount = 0;
            
            showLoader(true, "Preparing to export all plots...");
            
            try {
                for (let idx = 0; idx < plotSlots.length; idx++) {
                    const config = plotSlots[idx];
                    if (!config) continue;
                    
                    const card = document.getElementById(`grid-card-${idx}`);
                    const actions = document.getElementById(`header-actions-${idx}`);
                    
                    if (card) {
                        count++;
                        const filename = `${config.bearingOrChannel}_${config.category}_plot.png`;
                        
                        const originalDisplay = actions ? actions.style.display : '';
                        if (actions) actions.style.display = 'none';
                        
                        try {
                            const canvas = await html2canvas(card, {
                                scale: 2,
                                useCORS: true,
                                backgroundColor: '#ffffff',
                                logging: false
                            });
                            
                            const dataUrl = canvas.toDataURL('image/png');
                            const blob = dataURItoBlob(dataUrl);
                            
                            if (window.outputDirHandle) {
                                const success = await saveFileToLocalDirectory(filename, blob);
                                if (success) {
                                    directCount++;
                                }
                            } else {
                                const link = document.createElement('a');
                                link.download = filename;
                                link.href = dataUrl;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }
                        } catch (err) {
                            console.error(`Failed to export plot ${filename}:`, err);
                        } finally {
                            if (actions) actions.style.display = originalDisplay;
                        }
                    }
                }
                
                if (count > 0) {
                    if (window.outputDirHandle) {
                        alert(`Successfully saved ${directCount} of ${count} plot(s) directly to output folder: ${window.outputDirHandle.name}`);
                    } else {
                        alert(`Successfully saved ${count} plot(s) to your browser's default Downloads folder.`);
                    }
                } else {
                    alert("No active plots found to save.");
                }
            } catch (err) {
                console.error("Failed download all plots:", err);
                alert("Failed to export plots: " + err.message);
            } finally {
                showLoader(false);
            }
        }

        async function exportAllProjectPlots() {
            if (!df || df.length === 0) {
                alert("No dataset loaded. Please upload a dataset first.");
                return;
            }

            // Prompt user if no directory is selected
            if (!window.outputDirHandle) {
                const proceed = confirm("You have not selected a local output folder.\n\nTo save all plots directly to a folder on your computer without multiple download prompts, click OK to select a folder.\n\nOtherwise, click Cancel to trigger standard browser downloads (this may open many download prompts).");
                if (proceed) {
                    await selectOutputDirectory();
                }
            }

            const exportContainer = document.getElementById('hidden-export-container');
            if (!exportContainer) {
                console.error("hidden-export-container not found in DOM");
                return;
            }

            // Show a progress indicator/loader
            showLoader(true);
            
            // Build the queue of plots to generate
            const queue = [];

            // 1. System Mode Shape
            queue.push({
                target: 'System',
                category: 'mode_shape',
                isDual: true,
                filename: 'System_mode_shape_plot.png'
            });

            // 2. Proximity Pairs (Dual-axis plots)
            bearingPairs.forEach(brg => {
                queue.push({
                    target: brg,
                    category: 'centerline',
                    isDual: true,
                    filename: `${brg}_centerline_plot.png`
                });
                queue.push({
                    target: brg,
                    category: 'centerline_orbit',
                    isDual: true,
                    filename: `${brg}_centerline_orbit_plot.png`
                });
                queue.push({
                    target: brg,
                    category: 'orbit',
                    isDual: true,
                    filename: `${brg}_orbit_plot.png`
                });
            });

            // 3. Single Channels
            singlePrefixes.forEach(ch => {
                queue.push({
                    target: ch,
                    category: 'trend',
                    isDual: false,
                    filename: `${ch}_trend_plot.png`
                });
                
                const cols = getChannelColumns(ch);
                if (cols && cols.amp_1x && cols.phase_1x) {
                    queue.push({
                        target: ch,
                        category: 'polar',
                        isDual: false,
                        filename: `${ch}_polar_plot.png`
                    });
                    queue.push({
                        target: ch,
                        category: 'bode2d',
                        isDual: false,
                        filename: `${ch}_bode2d_plot.png`
                    });
                    queue.push({
                        target: ch,
                        category: 'bode3d',
                        isDual: false,
                        filename: `${ch}_bode3d_plot.png`
                    });
                }
            });

            let savedCount = 0;
            let totalCount = queue.length;

            // Save original slot configuration just in case
            const originalExportConfig = window.exportPlotConfig;

            try {
                for (let i = 0; i < queue.length; i++) {
                    const item = queue[i];
                    
                    // Show progress and yield to browser paint
                    const progressPercent = Math.round((i / totalCount) * 100);
                    showLoader(true, `Exporting Plots: ${i + 1} / ${totalCount} (${progressPercent}%) - Generating ${item.filename}...`);
                    
                    // Create temporary div inside the hidden export container
                    const tempDiv = document.createElement('div');
                    tempDiv.id = 'plotly-container-export';
                    tempDiv.style.width = '1200px';
                    tempDiv.style.height = '800px';
                    exportContainer.appendChild(tempDiv);

                    // Set up export config
                    window.exportPlotConfig = {
                        bearingOrChannel: item.target,
                        category: item.category,
                        isDual: item.isDual,
                        layoutLimits: { min: null, max: null, autoScale: true }
                    };

                    // Render and Export
                    try {
                        renderPlotInSlot('export', tempDiv, item.target, item.category);

                        // Wait for Plotly to render the layout and traces (some plots are 3D or webgl, so let's give it 150ms)
                        await new Promise(resolve => setTimeout(resolve, 150));

                        const dataUrl = await Plotly.toImage(tempDiv, { format: 'png', width: 1200, height: 800 });
                        const blob = dataURItoBlob(dataUrl);

                        if (window.outputDirHandle) {
                            const success = await saveFileToLocalDirectory(item.filename, blob);
                            if (success) {
                                savedCount++;
                            }
                        } else {
                            // Fallback
                            Plotly.downloadImage(tempDiv, {
                                format: 'png',
                                width: 1200,
                                height: 800,
                                filename: item.filename.replace('.png', '')
                            });
                            savedCount++;
                        }
                    } catch (err) {
                        console.error(`Failed to export plot ${item.filename}:`, err);
                    } finally {
                        // Clean up Plotly resources and release WebGL contexts first
                        try {
                            Plotly.purge(tempDiv);
                        } catch (purgeErr) {
                            console.warn("Plotly purge error:", purgeErr);
                        }
                        // Clean up container
                        if (tempDiv.parentNode) {
                            exportContainer.removeChild(tempDiv);
                        }
                    }
                }

                if (window.outputDirHandle) {
                    alert(`Successfully saved ${savedCount} of ${totalCount} plot(s) directly to your local output folder: ${window.outputDirHandle.name}`);
                } else {
                    alert(`Successfully exported ${savedCount} plot(s) to your browser's default Downloads folder (usually C:\\Users\\<Username>\\Downloads).`);
                }
            } catch (globalErr) {
                console.error("Bulk export encountered a global error:", globalErr);
                alert("Bulk export failed: " + globalErr.message);
            } finally {
                window.exportPlotConfig = originalExportConfig;
                showLoader(false);
            }
        }

        function detectAndDecodeText(arrayBuffer) {
            const arr = new Uint8Array(arrayBuffer);
            if (arr.length < 2) {
                return new TextDecoder('utf-8').decode(arrayBuffer);
            }
            
            // Check BOM
            if (arr[0] === 0xFF && arr[1] === 0xFE) {
                return new TextDecoder('utf-16le').decode(arrayBuffer);
            }
            if (arr[0] === 0xFE && arr[1] === 0xFF) {
                return new TextDecoder('utf-16be').decode(arrayBuffer);
            }
            if (arr.length >= 3 && arr[0] === 0xEF && arr[1] === 0xBB && arr[2] === 0xBF) {
                return new TextDecoder('utf-8').decode(arrayBuffer);
            }
            
            // Check for null bytes (indicators of UTF-16le or UTF-16be)
            let hasNull = false;
            for (let i = 0; i < Math.min(arr.length, 1000); i++) {
                if (arr[i] === 0) {
                    hasNull = true;
                    break;
                }
            }
            
            if (hasNull) {
                try {
                    const sampleLE = new TextDecoder('utf-16le', { fatal: true }).decode(arr.slice(0, 100));
                    if (sampleLE && !sampleLE.includes('\ufffd')) {
                        return new TextDecoder('utf-16le').decode(arrayBuffer);
                    }
                } catch (e) {}
                try {
                    const sampleBE = new TextDecoder('utf-16be', { fatal: true }).decode(arr.slice(0, 100));
                    if (sampleBE && !sampleBE.includes('\ufffd')) {
                        return new TextDecoder('utf-16be').decode(arrayBuffer);
                    }
                } catch (e) {}
            }
            
            return new TextDecoder('utf-8').decode(arrayBuffer);
        }

        function preprocessCSV(csvText) {
            const lines = csvText.split(/\r?\n/);
            
            // 1. Detect Delimiter
            const delimiters = [',', ';', '\t', '|'];
            let detectedDelim = ',';
            let maxScore = -1;
            
            const sampleLines = lines.slice(0, 50).filter(l => l.trim().length > 0);
            for (let delim of delimiters) {
                let counts = sampleLines.map(line => line.split(delim).length - 1);
                let nonZeroCounts = counts.filter(c => c > 0);
                if (nonZeroCounts.length === 0) continue;
                
                let occ = {};
                nonZeroCounts.forEach(c => occ[c] = (occ[c] || 0) + 1);
                let mostCommonCount = parseInt(Object.keys(occ).reduce((a, b) => occ[a] > occ[b] ? a : b));
                let consistency = nonZeroCounts.filter(c => c === mostCommonCount).length / nonZeroCounts.length;
                let score = consistency * (mostCommonCount + 1);
                if (score > maxScore) {
                    maxScore = score;
                    detectedDelim = delim;
                }
            }
            
            // 2. Detect Header Row Index
            const headerKeywords = [
                'time', 'date', 'stamp', 'utc', 'rpm', 'speed', 'hz', 'frequency',
                'amp', 'vib', 'phase', 'deg', 'angle', 'temp', 'load', 'mw', 'probe', 'brg', 'axial'
            ];
            
            let bestHeaderIdx = 0;
            let maxHeaderScore = -1;
            
            for (let idx = 0; idx < Math.min(100, lines.length); idx++) {
                const line = lines[idx];
                if (!line.trim()) continue;
                
                const fields = line.split(detectedDelim).map(f => f.trim().toLowerCase());
                let keywordCount = 0;
                fields.forEach(field => {
                    if (headerKeywords.some(kw => field.includes(kw))) {
                        keywordCount++;
                    }
                });
                
                let numericScore = 0;
                let samplesChecked = 0;
                for (let nextIdx = idx + 1; nextIdx < Math.min(idx + 10, lines.length); nextIdx++) {
                    const nextLine = lines[nextIdx];
                    if (!nextLine.trim()) continue;
                    const nextFields = nextLine.split(detectedDelim);
                    samplesChecked++;
                    nextFields.forEach(nf => {
                        const nfClean = nf.trim().replace('%', '').replace('°', '').replace(/[a-zA-Z]+/g, '');
                        if (!nfClean) return;
                        if (!isNaN(parseFloat(nfClean))) {
                            numericScore++;
                        }
                    });
                }
                
                let totalScore = keywordCount * 5 + (samplesChecked > 0 ? (numericScore / samplesChecked) : 0);
                if (totalScore > maxHeaderScore && keywordCount > 0) {
                    maxHeaderScore = totalScore;
                    bestHeaderIdx = idx;
                }
            }
            
            const metadataLines = lines.slice(0, bestHeaderIdx);
            
            let metadata = {};
            const nonEmptyMeta = metadataLines.filter(l => l.trim());
            if (nonEmptyMeta.length === 2 && nonEmptyMeta[0].includes(detectedDelim)) {
                const hFields = nonEmptyMeta[0].split(detectedDelim).map(f => f.trim());
                const vFields = nonEmptyMeta[1].split(detectedDelim).map(f => f.trim());
                if (hFields.length === vFields.length) {
                    hFields.forEach((h, i) => {
                        if (h || vFields[i]) {
                            metadata[h] = vFields[i];
                        }
                    });
                }
            } else {
                nonEmptyMeta.forEach(line => {
                    const cleanLine = line.trim().replace(/^#\s*/, '');
                    const match = cleanLine.match(/^([^:=]+)[:=](.+)$/);
                    if (match) {
                        metadata[match[1].trim()] = match[2].trim();
                    }
                });
            }
            
            const dataCsvText = lines.slice(bestHeaderIdx).join('\n');
            
            return {
                delimiter: detectedDelim,
                metadata: metadata,
                dataCsvText: dataCsvText
            };
        }

        function cleanJSNumericValue(val) {
            if (val === null || val === undefined) return null;
            if (typeof val === 'number') {
                return isNaN(val) ? null : val;
            }
            let str = String(val).trim().replace(',', '.');
            if (!str) return null;
            
            const nullIndicators = ['error', 'null', 'nan', 'n/a', 'empty', 'none', '-', 'undefined'];
            if (nullIndicators.includes(str.toLowerCase())) {
                return null;
            }
            
            const match = str.match(/^[-+]?\d*\.?\d+/);
            if (match) {
                const parsed = parseFloat(str);
                return isNaN(parsed) ? null : parsed;
            }
            
            return null;
        }

        function handleFileSelect(event) {
            const files = event.target.files;
            if (!files || files.length === 0) return;

            showLoader(true, "Processing datasets and rendering interactive plots... This may take a few seconds.");
            
            // Allow the browser main thread 50ms to paint the loader UI before parsing begins
            setTimeout(() => {
                handleMultiFileImport(files);
            }, 50);
        }

        function handleMultiFileImport(files) {
            const promises = [];
            const fileNames = [];
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                fileNames.push(file.name);
                
                const p = new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    const ext = file.name.split('.').pop().toLowerCase();
                    
                    if (ext === 'xlsx' || ext === 'xls') {
                        reader.onload = function(e) {
                            try {
                                const data = new Uint8Array(e.target.result);
                                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                                const fileSheets = [];
                                
                                workbook.SheetNames.forEach(sheetName => {
                                    const worksheet = workbook.Sheets[sheetName];
                                    const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });
                                    if (rawJson.length > 0) {
                                        const sheetRows = processExcelSheet(rawJson, sheetName);
                                        if (sheetRows.length > 0) {
                                            fileSheets.push({
                                                name: `${file.name} [${sheetName}]`,
                                                rows: sheetRows
                                            });
                                        }
                                    }
                                });
                                resolve(fileSheets);
                            } catch (err) {
                                reject(new Error(`Failed to parse Excel file ${file.name}: ${err.message}`));
                            }
                        };
                        reader.readAsArrayBuffer(file);
                    } else {
                        reader.onload = function(e) {
                            try {
                                const csvText = detectAndDecodeText(e.target.result);
                                const preprocessed = preprocessCSV(csvText);
                                Papa.parse(preprocessed.dataCsvText, {
                                    header: true,
                                    delimiter: preprocessed.delimiter,
                                    dynamicTyping: true,
                                    skipEmptyLines: true,
                                    complete: function(results) {
                                        resolve([{
                                            name: file.name,
                                            rows: results.data,
                                            metadata: preprocessed.metadata
                                        }]);
                                    },
                                    error: function(err) {
                                        reject(new Error(`Failed to parse CSV file ${file.name}: ${err.message}`));
                                    }
                                });
                            } catch (err) {
                                reject(new Error(`Failed to process CSV file ${file.name}: ${err.message}`));
                            }
                        };
                        reader.readAsArrayBuffer(file);
                    }
                });
                promises.push(p);
            }
            
            Promise.all(promises)
                .then(allFileResults => {
                    const flatDatasets = [];
                    allFileResults.forEach(resList => {
                        resList.forEach(ds => flatDatasets.push(ds));
                    });
                    
                    const mergedData = mergeClientDatasets(flatDatasets, fileNames);
                    
                    if (mergedData.length === 0) {
                        throw new Error("Merged dataset is empty. Ensure files have readable column headers and timestamps.");
                    }
                    
                    let prefixLines = "";
                    for (let ch in channelUnits) {
                        for (let cat in channelUnits[ch]) {
                            prefixLines += `# Unit_${ch}_${cat}: ${channelUnits[ch][cat]}\n`;
                        }
                    }
                    const csvText = prefixLines + Papa.unparse(mergedData);
                    const mergedFilename = files.length > 1 ? `merged_${files.length}_files.csv` : files[0].name;
                    
                    cacheCSVInSession(csvText, mergedFilename);
                    parseCSVData(csvText, mergedFilename);
                    uploadDatasetToBackend(csvText, mergedFilename);
                    
                    // Trigger dynamic self-learning unbalance diagnostics
                    checkAndLearnMachineSignature(flatDatasets, fileNames);
                })
                .catch(err => {
                    showUploadError(err.message);
                    showLoader(false);
                });
        }

        function showToastNotification(message, type = 'info') {
            const container = document.getElementById('toast-container');
            let toastContainer = container;
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.id = 'toast-container';
                toastContainer.style.position = 'fixed';
                toastContainer.style.bottom = '24px';
                toastContainer.style.right = '24px';
                toastContainer.style.zIndex = '9999';
                toastContainer.style.display = 'flex';
                toastContainer.style.flexDirection = 'column';
                toastContainer.style.gap = '8px';
                document.body.appendChild(toastContainer);
            }
            
            const toast = document.createElement('div');
            toast.style.background = type === 'success' ? '#10b981' : '#0ea5e9';
            toast.style.color = '#ffffff';
            toast.style.padding = '12px 20px';
            toast.style.borderRadius = '8px';
            toast.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.15)';
            toast.style.fontSize = '0.85rem';
            toast.style.fontWeight = '500';
            toast.style.display = 'flex';
            toast.style.alignItems = 'center';
            toast.style.gap = '8px';
            toast.style.border = '1px solid rgba(255,255,255,0.1)';
            toast.style.transition = 'all 0.3s ease';
            
            toast.innerHTML = `
                <span style="font-size: 1.1rem;">🧠</span>
                <div>${message}</div>
            `;
            
            toastContainer.appendChild(toast);
            
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px)';
                setTimeout(() => toast.remove(), 300);
            }, 6000);
        }

        function checkAndLearnMachineSignature(flatDatasets, fileNames) {
            let isSiemensData = false;
            const siemensKeywords = ['cterl', 'cterr', 'ctesl', 'ctesr', 'ctirl', 'ctirr', 'ctisl', 'ctisr', 'g1trl', 'g1trr', 'g1xrl', 'g1xrr'];
            
            fileNames.forEach(name => {
                const baseName = name.toLowerCase().replace('.csv', '');
                if (siemensKeywords.includes(baseName)) {
                    isSiemensData = true;
                }
            });
            
            if (!isSiemensData) return;
            
            let results = [];
            flatDatasets.forEach(ds => {
                const cleanName = ds.name.toLowerCase().replace('.csv', '').split(' ')[0];
                if (!siemensKeywords.includes(cleanName)) return;
                
                const rows = ds.rows;
                if (!rows || rows.length === 0) return;
                
                const cols = Object.keys(rows[0]);
                const speedColName = cols.find(c => c.toLowerCase() === 'speed(p)' || c.toLowerCase() === 'speed');
                const ampColName = cols.find(c => c.toLowerCase() === '1xamplitude' || c.toLowerCase() === 'amp_1x' || c.toLowerCase() === '1x_amp');
                
                if (!speedColName || !ampColName) return;
                
                let maxAmp = -1;
                let criticalSpeed = 0;
                
                rows.forEach(r => {
                    const rpm = cleanJSNumericValue(r[speedColName]);
                    const amp = cleanJSNumericValue(r[ampColName]);
                    if (rpm !== null && amp !== null && amp > maxAmp) {
                        maxAmp = amp;
                        criticalSpeed = rpm;
                    }
                });
                
                if (maxAmp > 0) {
                    results.push({
                        channel: cleanName.toUpperCase(),
                        criticalSpeed: criticalSpeed,
                        maxAmp: maxAmp
                    });
                }
            });
            
            if (results.length > 0) {
                const summaryLines = results.map(r => `${r.channel}: ${r.criticalSpeed.toFixed(0)} RPM (${r.maxAmp.toFixed(3)} mils)`).join(', ');
                showToastNotification(`RoDy Self-Learning: Calibrated unbalance signatures for Siemens 501FD2 GT XL! resonance points detected: ${summaryLines}`, 'success');
                
                const localKnowledgeRaw = localStorage.getItem('rody_local_knowledge');
                let localKnowledge = [];
                if (localKnowledgeRaw) {
                    try {
                        localKnowledge = JSON.parse(localKnowledgeRaw);
                    } catch (e) {}
                }
                
                const existingIdx = localKnowledge.findIndex(k => k.keywords.includes('siemens 501fd2 gt xl'));
                const newAnswer = `Based on the telemetry datasets loaded during training, I have learned the dynamic vibration profile of the Siemens 501FD2 GT XL:\n` +
                                  results.map(r => `* Channel **${r.channel}** exhibits a peak critical resonance at **${r.criticalSpeed.toFixed(0)} RPM** with a maximum unbalance amplitude of **${r.maxAmp.toFixed(3)} mils**.`).join('\n') +
                                  `\n\nNormal operating speed is 3600 RPM. This unbalance profile is stored in my local calibration memory.`;
                
                const entry = {
                    keywords: ['siemens 501fd2 gt xl', 'critical speed', 'resonance', 'siemens', '501fd2'],
                    answer: newAnswer
                };
                
                if (existingIdx !== -1) {
                    localKnowledge[existingIdx] = entry;
                } else {
                    localKnowledge.push(entry);
                }
                
                localStorage.setItem('rody_local_knowledge', JSON.stringify(localKnowledge));
            }
        }

        function processExcelSheet(rawData, sheetName) {
            let headerIdx = 0;
            let bestScore = -1;
            const headerKeywords = ['time', 'date', 'stamp', 'rpm', 'speed', 'amp', 'vib', 'phase', 'deg', 'angle'];
            
            for (let idx = 0; idx < Math.min(50, rawData.length); idx++) {
                const row = rawData[idx];
                if (!row) continue;
                const rowClean = row.map(r => String(r).trim().toLowerCase());
                const matchedKeywords = new Set();
                rowClean.forEach(cell => {
                    headerKeywords.forEach(kw => {
                        if (cell.includes(kw)) {
                            matchedKeywords.add(kw);
                        }
                    });
                });
                let score = 0;
                matchedKeywords.forEach(kw => {
                    if (['time', 'date', 'stamp'].includes(kw)) {
                        score += 10;
                    } else if (['rpm', 'speed'].includes(kw)) {
                        score += 5;
                    } else {
                        score += 1;
                    }
                });
                if (score > bestScore && score > 0) {
                    bestScore = score;
                    headerIdx = idx;
                }
            }
            
            if (bestScore === -1) {
                headerIdx = 0;
            }
            
            const rawHeaders = (rawData[headerIdx] || []).map(h => h !== null && h !== undefined ? String(h).trim() : "");
            
            let subHeaderRow = null;
            let unitRow = null;
            let dataStartIdx = headerIdx + 1;
            
            if (headerIdx + 1 < rawData.length) {
                const nextRow = rawData[headerIdx + 1];
                const hasSubKeywords = nextRow.some(cell => {
                    const c = String(cell).toLowerCase();
                    return c.includes('amp') || c.includes('phs') || c.includes('phase') || c.includes('total') || c.includes('overall') || c.includes('direct') || c.includes('gap') || c.includes('bias');
                });
                if (hasSubKeywords) {
                    subHeaderRow = nextRow;
                    dataStartIdx = headerIdx + 2;
                    
                    if (headerIdx + 2 < rawData.length) {
                        const secondNextRow = rawData[headerIdx + 2];
                        const hasUnitKeywords = secondNextRow.some(cell => {
                            const c = String(cell).toLowerCase();
                            return c.includes('rms') || c.includes('p-p') || c.includes('°') || c.includes('rad') || c.includes('rpm') || c.includes('c') || c.includes('f');
                        });
                        if (hasUnitKeywords) {
                            unitRow = secondNextRow;
                            dataStartIdx = headerIdx + 3;
                        }
                    }
                }
            }
            
            const headers = [];
            let currentParentHeader = "";
            
            for (let i = 0; i < rawHeaders.length; i++) {
                let cellStr = rawHeaders[i] || "";
                if (cellStr) {
                    // Check if it's not a common timestamp/RPM keyword before using it as parent
                    if (!['rdg', 'date/time', 'date', 'time', 'rpm'].includes(cellStr.toLowerCase())) {
                        currentParentHeader = cellStr;
                    } else {
                        currentParentHeader = "";
                    }
                }
                
                let subStr = subHeaderRow && subHeaderRow[i] !== null && subHeaderRow[i] !== undefined ? String(subHeaderRow[i]).trim() : "";
                let finalHeader = "";
                
                if (cellStr && ['rdg', 'date/time', 'date', 'time', 'rpm'].includes(cellStr.toLowerCase())) {
                    finalHeader = cellStr;
                } else if (cellStr && !subStr) {
                    finalHeader = cellStr;
                } else if (!cellStr && subStr && currentParentHeader) {
                    finalHeader = `${currentParentHeader}_${subStr}`;
                } else if (cellStr && subStr) {
                    finalHeader = `${cellStr}_${subStr}`;
                }
                
                if (finalHeader) {
                    const parts = finalHeader.split('_');
                    if (parts.length >= 2) {
                        const parent = parts[0];
                        const sub = parts.slice(1).join('_').toLowerCase().replace(/[^a-z0-9]/g, '');
                        let normSub = parts.slice(1).join('_');
                        
                        if (sub.includes('1xamp')) {
                            normSub = '1XAmplitude';
                        } else if (sub.includes('1xphs') || sub.includes('1xphase') || sub.includes('1xangle')) {
                            normSub = '1XPhase';
                        } else if (sub.includes('2xamp')) {
                            normSub = '2XAmplitude';
                        } else if (sub.includes('2xphs') || sub.includes('2xphase') || sub.includes('2xangle')) {
                            normSub = '2XPhase';
                        } else if (sub.includes('nxamp')) {
                            normSub = 'nX1Amplitude';
                        } else if (sub.includes('nxphs') || sub.includes('nxphase') || sub.includes('nxangle')) {
                            normSub = 'nX1Phase';
                        } else if (sub.includes('total') || sub.includes('overall') || sub.includes('direct')) {
                            normSub = 'Direct';
                        } else if (sub.includes('gap') || sub.includes('bias') || sub.includes('avggap')) {
                            normSub = 'AvgGap';
                        } else if (sub.includes('instgap')) {
                            normSub = 'InstGap';
                        } else if (sub.includes('bandpass')) {
                            normSub = 'Bandpass';
                        } else if (sub.includes('temp') || sub.includes('temperature')) {
                            normSub = 'Temp';
                        }
                        finalHeader = `${parent}_${normSub}`;
                    }
                }
                
                headers.push(finalHeader || null);
            }
            
            if (unitRow) {
                if (!window.tempExcelUnits) window.tempExcelUnits = {};
                headers.forEach((h, colIdx) => {
                    if (h && unitRow[colIdx]) {
                        const unitStr = String(unitRow[colIdx]).trim();
                        const parts = h.split('_');
                        if (parts.length >= 2) {
                            const prefix = parts[0];
                            const cat = parts.slice(1).join('_');
                            if (!window.tempExcelUnits[prefix]) window.tempExcelUnits[prefix] = {};
                            window.tempExcelUnits[prefix][cat] = unitStr;
                        }
                    }
                });
            }
            
            const dataRows = [];
            for (let idx = dataStartIdx; idx < rawData.length; idx++) {
                const row = rawData[idx];
                if (!row || row.length === 0) continue;
                if (row.every(c => c === null || c === undefined || String(c).trim() === "")) continue;
                
                const rowObj = {};
                headers.forEach((h, colIdx) => {
                    if (h) {
                        rowObj[h] = row[colIdx] !== undefined ? row[colIdx] : null;
                    }
                });
                dataRows.push(rowObj);
            }
            return dataRows;
        }

        function detectColumnsInDataset(cols) {
            const mapping = {
                timestamp: null,
                rpm: null,
                direct: null,
                amp_1x: null,
                phase_1x: null,
                amp_2x: null,
                phase_2x: null,
                gap: null,
                temp: null
            };
            
            const patterns = {
                timestamp: /(timestamp|time|date|utc|valdate|date_time)/i,
                rpm: /(rpm|speed|frequency|freq|hz|rotational_speed|1x_speed)/i,
                direct: /(direct|pk-pk|pk|vibration|vib)/i,
                amp_1x: /(1x_amp|1xamp|1x amplitude|1xval|1xamplitude)/i,
                phase_1x: /(1x_phase|1xphase|1x phase|1x_phase_angle)/i,
                amp_2x: /(2x_amp|2xamp|2x amplitude|2xval|2xamplitude)/i,
                phase_2x: /(2x_phase|2xphase|2x phase|2x_phase_angle)/i,
                gap: /(gap|avg_gap|avggap|avg gap)/i,
                temp: /(temp|temperature)/i
            };
            
            cols.forEach(col => {
                const c = String(col).trim();
                if (patterns.timestamp.test(c) && !mapping.timestamp) {
                    mapping.timestamp = c;
                } else if (patterns.rpm.test(c) && !mapping.rpm) {
                    mapping.rpm = c;
                } else if (patterns.amp_1x.test(c) && !mapping.amp_1x) {
                    mapping.amp_1x = c;
                } else if (patterns.phase_1x.test(c) && !mapping.phase_1x) {
                    mapping.phase_1x = c;
                } else if (patterns.amp_2x.test(c) && !mapping.amp_2x) {
                    mapping.amp_2x = c;
                } else if (patterns.phase_2x.test(c) && !mapping.phase_2x) {
                    mapping.phase_2x = c;
                } else if (patterns.gap.test(c) && !mapping.gap) {
                    mapping.gap = c;
                } else if (patterns.temp.test(c) && !mapping.temp) {
                    mapping.temp = c;
                } else if (patterns.direct.test(c) && !mapping.direct) {
                    mapping.direct = c;
                }
            });
            
            if (!mapping.timestamp && cols.length > 0) {
                mapping.timestamp = cols[0];
            }
            
            return mapping;
        }

        function escapeRegExp(string) {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        function mergeClientDatasets(datasets, fileNames) {
            channelUnits = {};
            let commonPrefix = "";
            if (fileNames.length > 1) {
                const sortedNames = [...fileNames].sort();
                const s1 = sortedNames[0];
                const s2 = sortedNames[sortedNames.length - 1];
                let i = 0;
                while (i < s1.length && s1[i] === s2[i]) {
                    i++;
                }
                commonPrefix = s1.substring(0, i).trim().replace(/[\s_-]+$/, '');
            }
            
            datasets.forEach(ds => {
                if (ds.rows.length === 0) return;
                const cols = Object.keys(ds.rows[0]);
                ds.mapping = detectColumnsInDataset(cols);
                
                ds.rows.forEach(row => {
                    const tsVal = row[ds.mapping.timestamp];
                    row._parsed_date = parseTimestamp(tsVal);
                    row._time_ms = row._parsed_date ? row._parsed_date.getTime() : null;
                });
                
                ds.rows = ds.rows.filter(r => r._time_ms !== null);
            });
            
            const allTimeMs = new Set();
            datasets.forEach(ds => {
                ds.rows.forEach(r => {
                    allTimeMs.add(r._time_ms);
                });
            });
            
            if (allTimeMs.size === 0) return [];
            
            const sortedTimeMs = Array.from(allTimeMs).sort((a, b) => a - b);
            
            const masterRows = sortedTimeMs.map(timeMs => {
                return {
                    _time_ms: timeMs,
                    Timestamp: "",
                    'Speed(P)': null
                };
            });
            
            const timeToIndex = {};
            masterRows.forEach((row, idx) => {
                timeToIndex[row._time_ms] = idx;
            });
            
            datasets.forEach(ds => {
                if (ds.rows.length === 0) return;
                
                let probeName = "";
                if (ds.metadata) {
                    probeName = ds.metadata['Channel Name'] || ds.metadata['ChannelName'] || ds.metadata['channel_name'] || ds.metadata['channel name'] || "";
                }
                if (!probeName) {
                    probeName = ds.name.replace(/\.[^/.]+$/, "");
                    probeName = probeName.replace(/\[([^\]]+)\]$/, "$1").trim();
                }
                
                let prefixToStrip = commonPrefix;
                if (commonPrefix) {
                    const brgMatch = commonPrefix.match(/^(.*?)(BRG\d+|Bearing\d+)/i);
                    if (brgMatch) {
                        prefixToStrip = brgMatch[1];
                    }
                }
                if (prefixToStrip) {
                    const regex = new RegExp('^' + escapeRegExp(prefixToStrip) + '[\\s_-]*', 'i');
                    probeName = probeName.replace(regex, '');
                }
                probeName = probeName.trim().replace(/[\s_-]+/g, '_');
                
                if (ds.metadata) {
                    const findMetaValue = (patterns) => {
                        for (let k in ds.metadata) {
                            const kl = k.toLowerCase();
                            if (patterns.some(p => kl.includes(p))) {
                                return ds.metadata[k];
                            }
                        }
                        return null;
                    };
                    const speedU = findMetaValue(['speed unit', 'speed(p) unit', 'speed_unit']);
                    const ampU = findMetaValue(['amp unit', 'amplitude unit', 'amp_unit']);
                    const phaseU = findMetaValue(['phase unit', 'phase_unit']);
                    const tempU = findMetaValue(['temp unit', 'temperature unit', 'temp_unit']);
                    
                    const unitsObj = {};
                    if (speedU) unitsObj.speed = speedU;
                    if (ampU) unitsObj.amp = ampU;
                    if (phaseU) unitsObj.phase = phaseU;
                    if (tempU) unitsObj.temp = tempU;
                    
                    channelUnits[probeName] = unitsObj;
                    const rawName = ds.metadata['Channel Name'] || ds.metadata['ChannelName'] || ds.metadata['channel_name'] || ds.metadata['channel name'] || "";
                    if (rawName && rawName !== probeName) {
                        channelUnits[rawName] = unitsObj;
                    }
                }
                
                const mapping = ds.mapping;
                const cols = Object.keys(ds.rows[0]).filter(c => c !== '_parsed_date' && c !== '_time_ms');
                
                const suffixes = ['1XAmplitude', '1XPhase', '1X Phase', '2XAmplitude', '2XPhase', '2X Phase', 'nX1Amplitude', 'nX1Phase', 'nX-1Amplitude', 'nX-1Phase', 'Direct', 'AvgGap', 'Avg Gap', 'InstGap', 'Inst Gap', 'Bandpass', 'Temp', 'Temperature'];
                const isAlreadyMerged = datasets.length === 1 && cols.some(col => {
                    return suffixes.some(s => col.toLowerCase().endsWith('_' + s.toLowerCase().replace(/[^a-z0-9]/g, '')));
                });
                
                ds.rows.forEach(row => {
                    const idx = timeToIndex[row._time_ms];
                    if (idx === undefined) return;
                    
                    const masterRow = masterRows[idx];
                    if (!masterRow.Timestamp && row[mapping.timestamp]) {
                        masterRow.Timestamp = String(row[mapping.timestamp]).trim();
                    }
                    
                    if (mapping.rpm && row[mapping.rpm] !== null && row[mapping.rpm] !== undefined) {
                        masterRow['Speed(P)'] = cleanJSNumericValue(row[mapping.rpm]);
                    }
                    
                    cols.forEach(col => {
                        if (col !== mapping.timestamp && col !== mapping.rpm) {
                            const val = cleanJSNumericValue(row[col]);
                            const hasStandardSuffix = suffixes.some(s => col.toLowerCase().endsWith('_' + s.toLowerCase().replace(/[^a-z0-9]/g, '')));
                            if (isAlreadyMerged || hasStandardSuffix) {
                                masterRow[col] = val;
                            } else {
                                const cleanColSuffix = col.replace(/[^a-zA-Z0-9_#]/g, '').trim();
                                masterRow[`${probeName}_${cleanColSuffix}`] = val;
                            }
                        }
                    });
                });
            });
            
            let lastSpeed = null;
            for (let i = 0; i < masterRows.length; i++) {
                if (masterRows[i]['Speed(P)'] !== null && masterRows[i]['Speed(P)'] !== undefined) {
                    lastSpeed = masterRows[i]['Speed(P)'];
                } else if (lastSpeed !== null) {
                    masterRows[i]['Speed(P)'] = lastSpeed;
                }
            }
            lastSpeed = null;
            for (let i = masterRows.length - 1; i >= 0; i--) {
                if (masterRows[i]['Speed(P)'] !== null && masterRows[i]['Speed(P)'] !== undefined) {
                    lastSpeed = masterRows[i]['Speed(P)'];
                } else if (lastSpeed !== null) {
                    masterRows[i]['Speed(P)'] = lastSpeed;
                }
            }
            
            masterRows.forEach(row => {
                delete row._time_ms;
            });
            
            // Merge units from window.tempExcelUnits into channelUnits
            if (window.tempExcelUnits) {
                for (let prefix in window.tempExcelUnits) {
                    const unitsObj = {};
                    const excelUnits = window.tempExcelUnits[prefix];
                    for (let cat in excelUnits) {
                        const val = excelUnits[cat];
                        const lowerCat = cat.toLowerCase();
                        if (lowerCat.includes('amp') || lowerCat.includes('direct') || lowerCat.includes('gap') || lowerCat.includes('bandpass')) {
                            unitsObj.amp = val;
                        } else if (lowerCat.includes('phase') || lowerCat.includes('phs') || lowerCat.includes('angle')) {
                            unitsObj.phase = val;
                        } else if (lowerCat.includes('temp')) {
                            unitsObj.temp = val;
                        } else if (lowerCat.includes('speed') || lowerCat.includes('rpm')) {
                            unitsObj.speed = val;
                        }
                    }
                    if (Object.keys(unitsObj).length > 0) {
                        channelUnits[prefix] = {
                            ...(channelUnits[prefix] || {}),
                            ...unitsObj
                        };
                    }
                }
                // Clear the temporary store once merged
                window.tempExcelUnits = null;
            }
            
            return masterRows;
        }

        function parseTimestamp(ts) {
            if (!ts) return null;
            if (ts instanceof Date) return ts;
            
            let str = String(ts).trim().toLowerCase();
            // Replace subsecond comma with dot (e.g. 11:15:07,1 -> 11:15:07.1)
            str = str.replace(/(\d{2}:\d{2}:\d{2}),(\d+)/, '$1.$2');
            
            // Spanish months mapping
            const spanishMonths = {
                'ene': 'jan', 'feb': 'feb', 'mar': 'mar', 'abr': 'apr', 'may': 'may', 'jun': 'jun',
                'jul': 'jul', 'ago': 'aug', 'sep': 'sep', 'oct': 'oct', 'nov': 'nov', 'dic': 'dec',
                'enero': 'january', 'febrero': 'february', 'marzo': 'march', 'abril': 'april',
                'mayo': 'may', 'junio': 'june', 'julio': 'july', 'agosto': 'august',
                'septiembre': 'september', 'octubre': 'october', 'noviembre': 'november', 'diciembre': 'december'
            };
            
            for (let esp in spanishMonths) {
                const regex = new RegExp(`\\b${esp}\\b`, 'g');
                str = str.replace(regex, spanishMonths[esp]);
            }
            
            const match = str.match(/^(\d{1,2})([a-z_-]+)(\d{4})\s+(.+)$/);
            if (match) {
                const monthClean = match[2].replace(/[^a-z]/g, '');
                const formatted = `${match[1]} ${monthClean} ${match[3]} ${match[4]}`;
                const parsed = Date.parse(formatted);
                if (!isNaN(parsed)) return new Date(parsed);
            }
            
            // Match DD/MM/YY or DD/MM/YYYY or DD-MM-YY or DD-MM-YYYY
            // Example: 24/02/23 13:26:08 or 17/06/24 08:21:37.900000 or 17-06-2024 08:21:37
            const dateMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
            if (dateMatch) {
                let day = parseInt(dateMatch[1], 10);
                let month = parseInt(dateMatch[2], 10) - 1; // 0-indexed month
                let year = parseInt(dateMatch[3], 10);
                if (year < 100) {
                    year += 2000;
                }
                let hours = parseInt(dateMatch[4], 10);
                let minutes = parseInt(dateMatch[5], 10);
                let seconds = parseInt(dateMatch[6], 10);
                let ms = dateMatch[7] ? parseInt(dateMatch[7].substring(0, 3).padEnd(3, '0'), 10) : 0;
                return new Date(year, month, day, hours, minutes, seconds, ms);
            }

            // Match YYYY-MM-DD or YYYY/MM/DD
            // Example: 2024-06-17 08:21:37.900
            const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
            if (isoMatch) {
                let year = parseInt(isoMatch[1], 10);
                let month = parseInt(isoMatch[2], 10) - 1;
                let day = parseInt(isoMatch[3], 10);
                let hours = parseInt(isoMatch[4], 10);
                let minutes = parseInt(isoMatch[5], 10);
                let seconds = parseInt(isoMatch[6], 10);
                let ms = isoMatch[7] ? parseInt(isoMatch[7].substring(0, 3).padEnd(3, '0'), 10) : 0;
                return new Date(year, month, day, hours, minutes, seconds, ms);
            }

            const parsedFallback = Date.parse(str);
            if (!isNaN(parsedFallback)) return new Date(parsedFallback);
            
            const timeMatch = str.match(/(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
            if (timeMatch) {
                const h = parseInt(timeMatch[1], 10);
                const m = parseInt(timeMatch[2], 10);
                const s = parseInt(timeMatch[3], 10);
                const ms = timeMatch[4] ? parseInt(timeMatch[4].substring(0, 3).padEnd(3, '0'), 10) : 0;
                const d = new Date();
                d.setHours(h, m, s, ms);
                return d;
            }
            return new Date();
        }

        function showDefaultPlotSelectionModal(orderedPrefixes, bearingPairs, singlePrefixes, onComplete) {
            const backdrop = document.createElement('div');
            backdrop.style.position = 'fixed';
            backdrop.style.top = '0';
            backdrop.style.left = '0';
            backdrop.style.width = '100vw';
            backdrop.style.height = '100vh';
            backdrop.style.backgroundColor = 'rgba(9, 13, 22, 0.85)';
            backdrop.style.backdropFilter = 'blur(10px)';
            backdrop.style.display = 'flex';
            backdrop.style.justifyContent = 'center';
            backdrop.style.alignItems = 'center';
            backdrop.style.zIndex = '999999';
            backdrop.style.fontFamily = "'Outfit', 'Plus Jakarta Sans', sans-serif";

            const container = document.createElement('div');
            container.style.width = '420px';
            container.style.padding = '30px';
            container.style.backgroundColor = 'var(--card-color)';
            container.style.border = '1px solid var(--border-color)';
            container.style.borderRadius = '16px';
            container.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '20px';
            container.style.color = 'var(--text-color)';
            container.style.textAlign = 'center';

            const header = document.createElement('div');
            header.innerHTML = `
                <div style="font-size: 2rem; margin-bottom: 10px;">📊</div>
                <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 6px; color: var(--text-color)">Configure Default Plot Grid</h3>
                <p style="font-size: 0.82rem; color: var(--text-muted)">Choose the default plot type to display for the loaded dataset:</p>
            `;
            container.appendChild(header);

            const optionsList = document.createElement('div');
            optionsList.style.display = 'grid';
            optionsList.style.gridTemplateColumns = '1fr';
            optionsList.style.gap = '10px';
            optionsList.style.maxHeight = '220px';
            optionsList.style.overflowY = 'auto';
            optionsList.style.paddingRight = '5px';

            const plotTypes = [
                { id: 'trend', name: 'Trend Plots', isDual: false },
                { id: 'polar', name: 'Polar Plots', isDual: false },
                { id: 'bode2d', name: 'Bode Plots (2D)', isDual: false },
                { id: 'centerline', name: 'Shaft Centerline Plots', isDual: true },
                { id: 'centerline_orbit', name: 'Centerline Orbit Overlays', isDual: true },
                { id: 'orbit', name: 'Rotor Orbit Plots', isDual: true },
                { id: 'spectrum', name: 'FFT Spectrum Plots', isDual: false }
            ];

            let selectedCategory = 'trend';
            let selectedIsDual = false;

            const optionButtons = [];
            plotTypes.forEach(pt => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.style.width = '100%';
                btn.style.padding = '12px 16px';
                btn.style.borderRadius = '8px';
                btn.style.border = '1px solid var(--border-color)';
                btn.style.backgroundColor = 'var(--bg-color)';
                btn.style.color = 'var(--text-color)';
                btn.style.fontSize = '0.85rem';
                btn.style.fontWeight = '600';
                btn.style.cursor = 'pointer';
                btn.style.textAlign = 'left';
                btn.style.transition = 'all 0.2s';
                btn.style.display = 'flex';
                btn.style.justifyContent = 'space-between';
                btn.style.alignItems = 'center';
                
                btn.innerHTML = `
                    <span>${pt.name}</span>
                    <span style="font-size: 0.72rem; color: var(--text-muted); padding: 2px 6px; background: var(--card-color); border-radius: 4px; border: 1px solid var(--border-color)">
                        ${pt.isDual ? 'Bearing Pairs' : 'Channels'}
                    </span>
                `;

                btn.onmouseenter = () => {
                    if (selectedCategory !== pt.id) {
                        btn.style.borderColor = 'var(--accent-color)';
                        btn.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
                    }
                };
                btn.onmouseleave = () => {
                    if (selectedCategory !== pt.id) {
                        btn.style.borderColor = 'var(--border-color)';
                        btn.style.backgroundColor = 'var(--bg-color)';
                    }
                };

                const selectOption = () => {
                    selectedCategory = pt.id;
                    selectedIsDual = pt.isDual;
                    optionButtons.forEach(otherBtn => {
                        otherBtn.btn.style.borderColor = 'var(--border-color)';
                        otherBtn.btn.style.backgroundColor = 'var(--bg-color)';
                        otherBtn.btn.style.boxShadow = 'none';
                    });
                    btn.style.borderColor = 'var(--accent-color)';
                    btn.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                    btn.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
                };

                btn.onclick = selectOption;
                optionsList.appendChild(btn);
                optionButtons.push({ id: pt.id, btn, selectOption });
            });

            optionButtons[0].selectOption();
            container.appendChild(optionsList);

            // Layout selection segment
            const layoutSegment = document.createElement('div');
            layoutSegment.style.textAlign = 'left';
            layoutSegment.style.marginTop = '10px';
            layoutSegment.innerHTML = `
                <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-color); display: block; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Number of Plot Windows</label>
            `;
            
            const layoutOptions = [
                { value: '1', label: '1' },
                { value: '2V', label: '2 (2V)' },
                { value: '4', label: '4' },
                { value: '6', label: '6' },
                { value: '8', label: '8' }
            ];

            let selectedLayout = '2V'; // Default is 2V!

            const layoutBtnsContainer = document.createElement('div');
            layoutBtnsContainer.style.display = 'grid';
            layoutBtnsContainer.style.gridTemplateColumns = 'repeat(5, 1fr)';
            layoutBtnsContainer.style.gap = '6px';

            const layoutButtons = [];
            layoutOptions.forEach(opt => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.style.padding = '8px 4px';
                btn.style.borderRadius = '6px';
                btn.style.border = '1px solid var(--border-color)';
                btn.style.backgroundColor = 'var(--bg-color)';
                btn.style.color = 'var(--text-color)';
                btn.style.fontSize = '0.72rem';
                btn.style.fontWeight = '700';
                btn.style.cursor = 'pointer';
                btn.style.transition = 'all 0.2s';
                btn.innerText = opt.label;

                const selectLayout = () => {
                    selectedLayout = opt.value;
                    layoutButtons.forEach(lBtn => {
                        lBtn.btn.style.borderColor = 'var(--border-color)';
                        lBtn.btn.style.backgroundColor = 'var(--bg-color)';
                        lBtn.btn.style.color = 'var(--text-color)';
                    });
                    btn.style.borderColor = 'var(--accent-color)';
                    btn.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                    btn.style.color = 'var(--accent-color)';
                };

                btn.onclick = selectLayout;
                layoutBtnsContainer.appendChild(btn);
                layoutButtons.push({ value: opt.value, btn, selectLayout });
            });

            // Pre-select '2V'
            layoutButtons.find(b => b.value === '2V').selectLayout();
            layoutSegment.appendChild(layoutBtnsContainer);
            container.appendChild(layoutSegment);

            const confirmBtn = document.createElement('button');
            confirmBtn.type = 'button';
            confirmBtn.style.width = '100%';
            confirmBtn.style.padding = '12px';
            confirmBtn.style.borderRadius = '50px';
            confirmBtn.style.border = 'none';
            confirmBtn.style.backgroundColor = 'var(--accent-color)';
            confirmBtn.style.color = '#ffffff';
            confirmBtn.style.fontWeight = '700';
            confirmBtn.style.fontSize = '0.88rem';
            confirmBtn.style.cursor = 'pointer';
            confirmBtn.style.boxShadow = '0 4px 14px rgba(59, 130, 246, 0.3)';
            confirmBtn.style.transition = 'all 0.2s';
            confirmBtn.innerText = 'Render Selected Layout';

            confirmBtn.onmouseenter = () => {
                confirmBtn.style.opacity = '0.9';
            };
            confirmBtn.onmouseleave = () => {
                confirmBtn.style.opacity = '1';
            };

            confirmBtn.onclick = () => {
                backdrop.remove();
                onComplete(selectedCategory, selectedIsDual, selectedLayout);
            };
            container.appendChild(confirmBtn);

            backdrop.appendChild(container);
            document.body.appendChild(backdrop);
        }

        function parseCSVData(csvText, filename) {
            const preprocessed = preprocessCSV(csvText);
            
            // Populate channelUnits if metadata has unit fields
            if (preprocessed.metadata) {
                for (let key in preprocessed.metadata) {
                    const m = key.match(/^Unit_(.+?)_(amp|speed|phase|temp)$/i);
                    if (m) {
                        const ch = m[1];
                        const category = m[2].toLowerCase();
                        if (!channelUnits[ch]) channelUnits[ch] = {};
                        channelUnits[ch][category] = preprocessed.metadata[key];
                    }
                }
            }
            
            Papa.parse(preprocessed.dataCsvText, {
                header: true,
                delimiter: preprocessed.delimiter,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: function(results) {
                    if (results.data.length === 0) {
                        showUploadError("CSV file is empty or formatted incorrectly.");
                        showLoader(false);
                        return;
                    }
                    
                    df = results.data;
                    window.activeWorkspaceDataset = filename;
                    allDatasetColumns = results.meta.fields || [];
                    if (allDatasetColumns.length === 0 && df.length > 0) {
                        const keys = new Set();
                        df.slice(0, 50).forEach(r => Object.keys(r).forEach(k => keys.add(k)));
                        allDatasetColumns = Array.from(keys);
                    }
                    
                    detectMachineColumns();
                    updateSpeedSensorDropdown();
                    calculateBaselineThresholds();
                    
                    // Parse all timestamps to Date objects and milliseconds for fast operations
                    df.forEach(row => {
                        const raw_ts = row[tsCol];
                        row['_date'] = parseTimestamp(raw_ts);
                        row['_time_ms'] = row['_date'] ? row['_date'].getTime() : 0;
                    });
                    
                    // Transition View
                    document.getElementById('welcome-screen').style.opacity = '0';
                    setTimeout(() => {
                        document.getElementById('welcome-screen').style.display = 'none';
                        document.getElementById('main-container').style.display = 'flex';
                        navigate('/dashboard');
                        
                        // Cache rest gap values for centerline calibration
                        // Calibrate using the absolute bottom of the bearing clearance (extreme gap values)
                        singlePrefixes.forEach(ch => {
                            const cols = getChannelColumns(ch);
                            if (cols.gap && df.length > 0) {
                                const vals = df.map(r => cleanJSNumericValue(r[cols.gap])).filter(v => v !== null && !isNaN(v));
                                if (vals.length > 0) {
                                    x_gap_rest_global[ch] = vals[0] < 0 ? Math.min(...vals) : Math.max(...vals);
                                } else {
                                    x_gap_rest_global[ch] = df[0][cols.gap];
                                }
                            }
                        });
                        bearingPairs.forEach(brg => {
                            const cols = getBearingPairColumns(brg);
                            if (cols.x.gap && cols.y.gap && df.length > 0) {
                                const x_vals = df.map(r => cleanJSNumericValue(r[cols.x.gap])).filter(v => v !== null && !isNaN(v));
                                const y_vals_arr = df.map(r => cleanJSNumericValue(r[cols.y.gap])).filter(v => v !== null && !isNaN(v));
                                
                                if (x_vals.length > 0) {
                                    x_gap_rest_global[brg] = x_vals[0] < 0 ? Math.min(...x_vals) : Math.max(...x_vals);
                                } else {
                                    x_gap_rest_global[brg] = df[0][cols.x.gap];
                                }
                                
                                if (y_vals_arr.length > 0) {
                                    y_gap_rest_global[brg] = y_vals_arr[0] < 0 ? Math.min(...y_vals_arr) : Math.max(...y_vals_arr);
                                } else {
                                    y_gap_rest_global[brg] = df[0][cols.y.gap];
                                }
                            }
                        });

                        // Set up initial selections, filter dropdowns and render
                        populateFilterControls();
                        populateSidebarTree();
                        loadSignalFormat('direct');

                        // Populate dataset summary statistics
                        const speeds = df.map(r => r[speedCol] || 0);
                        const minSpeed = Math.min(...speeds);
                        const maxSpeed = Math.max(...speeds);
                        const firstTs = df[0][tsCol];
                        const lastTs = df[df.length - 1][tsCol];
                        const firstTsStr = firstTs ? String(firstTs) : '';
                        const lastTsStr = lastTs ? String(lastTs) : '';
                        const t_first = firstTsStr ? (firstTsStr.split(' ')[1] || firstTsStr).slice(0, 8) : '-';
                        const t_last = lastTsStr ? (lastTsStr.split(' ')[1] || lastTsStr).slice(0, 8) : '-';
                        
                        const summaryPts = document.getElementById('data-summary-points');
                        const summaryRpm = document.getElementById('data-summary-rpm');
                        const summaryTime = document.getElementById('data-summary-time');
                        const summaryFilename = document.getElementById('sidebar-active-filename');
                        
                        if (summaryPts) summaryPts.innerText = df.length.toLocaleString();
                        if (summaryRpm) summaryRpm.innerText = `${Math.round(minSpeed)} - ${Math.round(maxSpeed)} RPM`;
                        if (summaryTime) summaryTime.innerText = `${t_first} - ${t_last}`;
                        if (summaryFilename) summaryFilename.innerText = filename.split('/').pop().split('\\').pop();

                        // Load default view slots based on user selection in modal
                        const ordered = getPriorityOrder(singlePrefixes);
                        
                        showLoader(false);
                        
                        showDefaultPlotSelectionModal(ordered, bearingPairs, singlePrefixes, (category, isDual, layout) => {
                            showLoader(true, "Initializing plot grid...");
                            
                            setTimeout(() => {
                                const targets = isDual ? bearingPairs : ordered;
                                const capacity = layout === '1' ? 1 :
                                                 (layout === '2H' || layout === '2V') ? 2 :
                                                 layout === '4' ? 4 :
                                                 layout === '6' ? 6 : 8;

                                const N = Math.min(targets.length, capacity);
                                plotSlots = [];
                                for (let i = 0; i < capacity; i++) {
                                    if (i < N) {
                                        plotSlots.push({
                                            bearingOrChannel: targets[i],
                                            category: category,
                                            isDual: isDual,
                                            layoutLimits: { min: null, max: null, autoScale: true },
                                            showTimebase: true,
                                            showTrace2: false,
                                            cycles: 8
                                        });
                                    } else {
                                        plotSlots.push(null); // Leave empty slots
                                    }
                                }

                                activeSlotIndex = 0;
                                currentLayoutRef.current = layout;
                                currentLayout = layout;
                                setCurrentLayoutState(layout);
                                currentGridPage = 0;

                                if (timelineIntervalId) {
                                    clearInterval(timelineIntervalId);
                                    isTimelinePlaying = false;
                                    const playBtn = document.getElementById('tl-btn-play');
                                    if (playBtn) playBtn.innerText = 'Play';
                                }
                                document.getElementById('global-timeline-bar').style.display = 'flex';
                                const topBtn = document.getElementById('btn-top-toggle-timeline');
                                if (topBtn) {
                                    topBtn.style.display = 'inline-block';
                                    topBtn.innerText = 'Hide Speed Profile';
                                    topBtn.style.background = 'var(--card-color)';
                                    topBtn.style.borderColor = 'var(--border-color)';
                                    topBtn.style.color = '#ef4444';
                                }

                                populateSlowRollDropdown();
                                updateSavedSlowRollList();

                                setView('dashboard');

                                setTimeout(() => {
                                    renderGrid();
                                    saveWorkspaceConfig();
                                    showLoader(false);
                                    
                                    // Run AI critical speed detection and malfunction auto-diagnostics
                                    runAIDiagnostics();
                                    
                                    // Auto-expand Sensor Navigation to guide the user on first load
                                    selectActivityTab('tree');
                                }, 50);
                            }, 300);
                        });
                    }, 500);
                },
                error: function(err) {
                    showUploadError("Error parsing CSV: " + err.message);
                    showLoader(false);
                }
            });
        }

        function showUploadError(msg) {
            const el = document.getElementById('upload-error');
            el.innerText = msg;
            el.style.display = 'block';
        }

        function showLoader(show, message) {
            const loader = document.getElementById('loader');
            if (show) {
                const textEl = loader.querySelector('p');
                if (textEl) {
                    textEl.innerText = message || "Constructing Chart Canvas...";
                }
                loader.style.display = 'flex';
            } else {
                loader.style.display = 'none';
            }
        }

        // Automatic machine parameters / bearing groups mapping
        function detectMachineColumns() {
            if (df.length === 0) return;
            const cols = allDatasetColumns.length > 0 ? allDatasetColumns : Object.keys(df[0] || {});
            
            // Detect primary speed and timestamp
            speedCol = cols.find(c => c === 'Speed(P)' || c.toLowerCase() === 'speed') || cols[1] || 'Speed(P)';
            tsCol = cols.find(c => c === 'Timestamp' || c.toLowerCase() === 'timestamp') ||
                    cols.find(c => c.toLowerCase() === 'date' || c.toLowerCase() === '_date') ||
                    cols.find(c => c.toLowerCase() === '_time_ms') ||
                    cols[0] || 'Timestamp';

            // Detect all possible speed/keyphaser columns
            const speedCols = cols.filter(c => c.toLowerCase().includes('speed') || c.toLowerCase().includes('rpm') || c.toLowerCase().includes('keyphaser'));
            if (speedCols.length === 0) {
                const fallback = speedCol;
                if (fallback) speedCols.push(fallback);
            }
            window.detectedSpeedCols = Array.from(new Set(speedCols));
            
            // Detect channel prefixes using standard suffixes
            const prefixes = new Set();
            const suffixes = ['1XAmplitude', '1XPhase', '1X Phase', '2XAmplitude', '2XPhase', '2X Phase', 'nX1Amplitude', 'nX1Phase', 'nX-1Amplitude', 'nX-1Phase', 'Direct', 'AvgGap', 'Avg Gap', 'InstGap', 'Inst Gap', 'Bandpass', 'Temp', 'Temperature'];
            
            cols.forEach(col => {
                if (col.includes('_')) {
                    for (let s of suffixes) {
                        const searchStr = '_' + s.toLowerCase().replace(/[^a-z0-9]/g, '');
                        const cleanCol = col.toLowerCase().replace(/[^a-z0-9_]/g, '');
                        if (cleanCol.includes(searchStr)) {
                            const idx = col.toLowerCase().indexOf('_' + s.toLowerCase());
                            if (idx > 0) {
                                const prefix = col.substring(0, idx);
                                if (prefix) prefixes.add(prefix);
                                break;
                            }
                        }
                    }
                }
            });
            
            singlePrefixes = Array.from(prefixes).sort();
            if (singlePrefixes.length === 0) {
                singlePrefixes = ['BRG1X'];
            }
            
            // Detect pairs
            bearingPairs = [];
            bearingPairsMapping = {};
            const orthogonalPairs = [
                ['X', 'Y'],
                ['H', 'V'],
                ['V', 'H'],
                ['L', 'R'],
                ['R', 'L'],
                ['Left', 'Right'],
                ['Right', 'Left'],
                ['Horizontal', 'Vertical'],
                ['Vertical', 'Horizontal']
            ];
            
            const matchedPrefixes = new Set();
            
            singlePrefixes.forEach(p => {
                if (matchedPrefixes.has(p)) return;
                
                for (let pair of orthogonalPairs) {
                    const e1 = pair[0];
                    const e2 = pair[1];
                    
                    if (p.toLowerCase().endsWith(e1.toLowerCase())) {
                        const base = p.substring(0, p.length - e1.length);
                        const companion = singlePrefixes.find(other => {
                            if (other === p) return false;
                            return other.toLowerCase() === (base + e2).toLowerCase();
                        });
                        
                        if (companion) {
                            const cleanBase = base.replace(/[\s_]+$/, '');
                            if (cleanBase && !bearingPairs.includes(cleanBase)) {
                                bearingPairs.push(cleanBase);
                                matchedPrefixes.add(p);
                                matchedPrefixes.add(companion);
                                
                                const e1_low = e1.toLowerCase();
                                const is_y_like = e1_low === 'y' || e1_low === 'v' || e1_low === 'r' || e1_low === 'right' || e1_low === 'vertical';
                                if (is_y_like) {
                                    bearingPairsMapping[cleanBase] = { x: companion, y: p };
                                } else {
                                    bearingPairsMapping[cleanBase] = { x: p, y: companion };
                                }
                            }
                            break;
                        }
                    }
                }
            });
            
            if (bearingPairs.length === 0) {
                bearingPairs = ['BRG1'];
            }
            
            // Recompute operational state on the fly if state column is missing
            const hasState = cols.includes('state');
            if (!hasState) {
                const speeds = df.map(r => r[speedCol] || 0);
                const times = df.map((r, i) => {
                    const t = r[tsCol];
                    return t ? parseTimestamp(t).getTime() : i * 1000;
                });
                
                const states = detectStates(speeds, times);
                df.forEach((row, idx) => {
                    row['state'] = states[idx];
                });
            }
        }

        // AI Critical Speed & Auto-Diagnostics Engine
        function runAIDiagnostics() {
            if (!df || df.length === 0) return;
            
            const speedVals = df.map(r => cleanJSNumericValue(r[speedCol])).filter(v => v !== null && !isNaN(v));
            if (speedVals.length === 0) return;
            
            const maxSpeed = Math.max(...speedVals);
            const sensorCriticalSpeeds = {};
            const allCriticalSpeeds = [];
            
            singlePrefixes.forEach(prefix => {
                const cols = getChannelColumns(prefix);
                if (!cols.amp_1x) return;
                
                const pts = df.map(r => {
                    const rpm = cleanJSNumericValue(r[speedCol]);
                    const amp = cleanJSNumericValue(r[cols.amp_1x]);
                    return { rpm, amp };
                }).filter(p => p.rpm !== null && !isNaN(p.rpm) && p.amp !== null && !isNaN(p.amp));
                
                if (pts.length < 10) return;
                pts.sort((a, b) => a.rpm - b.rpm);
                
                // Smooth moving average
                const smoothPts = [];
                const windowSize = 5;
                for (let i = 0; i < pts.length; i++) {
                    let sum = 0;
                    let count = 0;
                    for (let j = Math.max(0, i - windowSize); j <= Math.min(pts.length - 1, i + windowSize); j++) {
                        sum += pts[j].amp;
                        count++;
                    }
                    smoothPts.push({ rpm: pts[i].rpm, amp: sum / count });
                }
                
                // Peak finding
                const peaks = [];
                for (let i = 2; i < smoothPts.length - 2; i++) {
                    const prev2 = smoothPts[i-2].amp;
                    const prev1 = smoothPts[i-1].amp;
                    const curr = smoothPts[i].amp;
                    const next1 = smoothPts[i+1].amp;
                    const next2 = smoothPts[i+2].amp;
                    
                    if (curr > prev1 && curr > prev2 && curr > next1 && curr > next2) {
                        peaks.push({ index: i, rpm: smoothPts[i].rpm, amp: smoothPts[i].amp });
                    }
                }
                
                const maxAmp = Math.max(...smoothPts.map(p => p.amp));
                const threshold = maxAmp * 0.15;
                let validPeaks = peaks.filter(p => p.amp > threshold);
                validPeaks.sort((a, b) => b.amp - a.amp);
                validPeaks = validPeaks.slice(0, 3);
                
                const sensorPeaks = [];
                validPeaks.forEach(peak => {
                    const peakRpm = peak.rpm;
                    const peakAmp = peak.amp;
                    const halfPowerAmp = peakAmp * 0.707;
                    
                    let rpmLeft = null;
                    for (let j = peak.index; j >= 0; j--) {
                        if (smoothPts[j].amp <= halfPowerAmp) {
                            rpmLeft = smoothPts[j].rpm;
                            break;
                        }
                    }
                    
                    let rpmRight = null;
                    for (let j = peak.index; j < smoothPts.length; j++) {
                        if (smoothPts[j].amp <= halfPowerAmp) {
                            rpmRight = smoothPts[j].rpm;
                            break;
                        }
                    }
                    
                    let qFactor = null;
                    if (rpmLeft !== null && rpmRight !== null && rpmRight > rpmLeft) {
                        qFactor = peakRpm / (rpmRight - rpmLeft);
                    }
                    
                    sensorPeaks.push({
                        rpm: Math.round(peakRpm),
                        amp: Number(peakAmp.toFixed(3)),
                        q: qFactor ? Number(qFactor.toFixed(2)) : 'N/A'
                    });
                    allCriticalSpeeds.push(Math.round(peakRpm));
                });
                
                sensorCriticalSpeeds[prefix] = sensorPeaks;
            });
            
            // Save to window context for Plotly drawing highlights
            window.sensorCriticalSpeeds = sensorCriticalSpeeds;
            
            // Diagnostics Heuristic Rules Engine
            const diagnostics = {
                unbalance: { score: 0, details: [] },
                misalignment: { score: 0, details: [] },
                looseness: { score: 0, details: [] },
                rub: { score: 0, details: [] },
                instability: { score: 0, details: [] }
            };
            
            let total1X = 0;
            let total2X = 0;
            let totalDirect = 0;
            let count = 0;
            
            singlePrefixes.forEach(prefix => {
                const cols = getChannelColumns(prefix);
                if (!cols.amp_1x) return;
                
                const amp1X = df.map(r => cleanJSNumericValue(r[cols.amp_1x])).filter(v => v !== null && !isNaN(v));
                const ampDirect = cols.direct ? df.map(r => cleanJSNumericValue(r[cols.direct])).filter(v => v !== null && !isNaN(v)) : [];
                const amp2X = cols.amp_2x ? df.map(r => cleanJSNumericValue(r[cols.amp_2x])).filter(v => v !== null && !isNaN(v)) : [];
                
                if (amp1X.length === 0) return;
                
                const avg1X = amp1X.reduce((a, b) => a + b, 0) / amp1X.length;
                const avgDirect = ampDirect.length > 0 ? ampDirect.reduce((a, b) => a + b, 0) / ampDirect.length : avg1X;
                const avg2X = amp2X.length > 0 ? amp2X.reduce((a, b) => a + b, 0) / amp2X.length : 0;
                
                total1X += avg1X;
                total2X += avg2X;
                totalDirect += avgDirect;
                count++;
            });
            
            if (count > 0) {
                const mean1X = total1X / count;
                const mean2X = total2X / count;
                const meanDirect = totalDirect / count;
                
                // Rule 1: Mass Unbalance
                if (meanDirect > 0) {
                    const ratio = mean1X / meanDirect;
                    if (ratio > 0.7) {
                        diagnostics.unbalance.score += 45;
                        diagnostics.unbalance.details.push(`High 1X/Direct ratio (${ratio.toFixed(2)}) indicating unbalance-dominated vibration energy`);
                    } else if (ratio > 0.5) {
                        diagnostics.unbalance.score += 25;
                        diagnostics.unbalance.details.push(`Moderate 1X/Direct ratio (${ratio.toFixed(2)})`);
                    }
                }
                const firstCrit = allCriticalSpeeds[0];
                if (firstCrit && maxSpeed > firstCrit) {
                    diagnostics.unbalance.score += 30;
                    diagnostics.unbalance.details.push(`Rotor speed reached/crossed critical speed peak at ${firstCrit} RPM`);
                }
                
                // Rule 2: Shaft Misalignment
                if (mean1X > 0) {
                    const ratio2X = mean2X / mean1X;
                    if (ratio2X > 0.45) {
                        diagnostics.misalignment.score += 55;
                        diagnostics.misalignment.details.push(`Severe 2X/1X ratio (${ratio2X.toFixed(2)}) indicating possible shaft misalignment`);
                    } else if (ratio2X > 0.25) {
                        diagnostics.misalignment.score += 30;
                        diagnostics.misalignment.details.push(`Moderate 2X/1X ratio (${ratio2X.toFixed(2)})`);
                    }
                }
                
                // Rule 3: Mechanical Looseness
                if (mean1X > 0) {
                    const ratio2X = mean2X / mean1X;
                    const residual = meanDirect - mean1X - mean2X;
                    if (ratio2X > 0.25 && residual > mean1X * 0.4) {
                        diagnostics.looseness.score += 50;
                        diagnostics.looseness.details.push(`Elevated 2X and subharmonic/fractional harmonic components`);
                    }
                }
                
                // Rule 4: Rotor-to-Stator Rub
                if (meanDirect > 0) {
                    const residual = meanDirect - mean1X - mean2X;
                    const ratioRes = residual / meanDirect;
                    if (ratioRes > 0.35) {
                        diagnostics.rub.score += 45;
                        diagnostics.rub.details.push(`High residual vibration content (${(ratioRes*100).toFixed(0)}% of Direct) indicating subharmonic or impact friction`);
                    }
                }
                
                // Rule 5: Fluid Film Instability
                const steadySpeeds = df.filter(r => r.state === 'steady' || r[speedCol] >= 3500).map(r => cleanJSNumericValue(r[speedCol]));
                const firstRes = allCriticalSpeeds[0];
                if (firstRes && steadySpeeds.some(s => s > 2.0 * firstRes)) {
                    const residual = meanDirect - mean1X - mean2X;
                    const ratioRes = residual / meanDirect;
                    if (ratioRes > 0.25) {
                        diagnostics.instability.score += 40;
                        diagnostics.instability.details.push(`Operating speed is >2x first resonance speed and residual energy fraction is ${(ratioRes*100).toFixed(0)}% (potential oil whirl/whip)`);
                    }
                }
            }
            
            const diagList = [
                { type: 'Rotor Mass Unbalance', score: Math.min(100, diagnostics.unbalance.score), details: diagnostics.unbalance.details, rec: 'Perform field balance correction at the critical rotor planes. Inspect for missing balance weights, impeller erosion, or build-up.' },
                { type: 'Shaft Misalignment', score: Math.min(100, diagnostics.misalignment.score), details: diagnostics.misalignment.details, rec: 'Perform cold and hot alignment checks. Readjust shims on machine feet and realign coupling to within tolerances (radial and angular).' },
                { type: 'Mechanical Looseness', score: Math.min(100, diagnostics.looseness.score), details: diagnostics.looseness.details, rec: 'Check torque values on anchor bolts, structural base frame, and bearing housings. Inspect for cracked welds or worn bearing liners.' },
                { type: 'Rotor-to-Stator Rub', score: Math.min(100, diagnostics.rub.score), details: diagnostics.rub.details, rec: 'Inspect internal seal clearances, shroud rings, and labyrinths for wear patterns. Monitor temperature readouts for local friction heating.' },
                { type: 'Fluid Film Instability (Whirl/Whip)', score: Math.min(100, diagnostics.instability.score), details: diagnostics.instability.details, rec: 'Check oil supply temperature and pressure specifications. Inspect journal bearing clearances or consider transitioning to tilt-pad bearings.' }
            ];
            
            diagList.sort((a, b) => b.score - a.score);
            const primaryDiag = diagList[0];
            
            // --- Machine Learning Multiclass Classifier (Random Forest Ensemble) ---
            const mean1X = total1X / (count || 1);
            const mean2X = total2X / (count || 1);
            const meanDirect = totalDirect / (count || 1);
            
            const f_ratio1XDirect = meanDirect > 0 ? mean1X / meanDirect : 0;
            const f_ratio2X1X = mean1X > 0 ? mean2X / mean1X : 0;
            const f_residualVibe = meanDirect > 0 ? Math.max(0, (meanDirect - mean1X - mean2X) / meanDirect) : 0;
            const f_hasCritical = allCriticalSpeeds.length > 0 ? 1.0 : 0.0;
            const f_isHighSpeed = maxSpeed > 2.0 * (allCriticalSpeeds[0] || 1800) ? 1.0 : 0.0;
            
            const forest = [
                {
                    split_feature: 'ratio1XDirect', split_value: 0.6,
                    left: {
                        split_feature: 'ratio2X1X', split_value: 0.35,
                        left: {
                            split_feature: 'residualVibe', split_value: 0.25,
                            left: { probabilities: { normal: 0.90, unbalance: 0.02, misalignment: 0.02, looseness: 0.02, rub: 0.02, instability: 0.02 } },
                            right: {
                                split_feature: 'isHighSpeed', split_value: 0.5,
                                left: { probabilities: { normal: 0.05, unbalance: 0.05, misalignment: 0.05, looseness: 0.10, rub: 0.70, instability: 0.05 } },
                                right: { probabilities: { normal: 0.02, unbalance: 0.02, misalignment: 0.02, looseness: 0.02, rub: 0.10, instability: 0.82 } }
                            }
                        },
                        right: {
                            split_feature: 'residualVibe', split_value: 0.3,
                            left: { probabilities: { normal: 0.05, unbalance: 0.05, misalignment: 0.80, looseness: 0.05, rub: 0.02, instability: 0.03 } },
                            right: { probabilities: { normal: 0.05, unbalance: 0.05, misalignment: 0.20, looseness: 0.60, rub: 0.05, instability: 0.05 } }
                        }
                    },
                    right: {
                        split_feature: 'hasCritical', split_value: 0.5,
                        left: { probabilities: { normal: 0.10, unbalance: 0.75, misalignment: 0.05, looseness: 0.05, rub: 0.03, instability: 0.02 } },
                        right: { probabilities: { normal: 0.01, unbalance: 0.95, misalignment: 0.01, looseness: 0.01, rub: 0.01, instability: 0.01 } }
                    }
                },
                {
                    split_feature: 'ratio2X1X', split_value: 0.4,
                    left: {
                        split_feature: 'ratio1XDirect', split_value: 0.5,
                        left: {
                            split_feature: 'residualVibe', split_value: 0.3,
                            left: { probabilities: { normal: 0.85, unbalance: 0.03, misalignment: 0.03, looseness: 0.03, rub: 0.03, instability: 0.03 } },
                            right: {
                                split_feature: 'isHighSpeed', split_value: 0.5,
                                left: { probabilities: { normal: 0.08, unbalance: 0.02, misalignment: 0.02, looseness: 0.15, rub: 0.65, instability: 0.08 } },
                                right: { probabilities: { normal: 0.05, unbalance: 0.02, misalignment: 0.02, looseness: 0.05, rub: 0.15, instability: 0.71 } }
                            }
                        },
                        right: { probabilities: { normal: 0.05, unbalance: 0.85, misalignment: 0.03, looseness: 0.03, rub: 0.02, instability: 0.02 } }
                    },
                    right: {
                        split_feature: 'residualVibe', split_value: 0.25,
                        left: { probabilities: { normal: 0.02, unbalance: 0.02, misalignment: 0.90, looseness: 0.02, rub: 0.02, instability: 0.02 } },
                        right: { probabilities: { normal: 0.03, unbalance: 0.02, misalignment: 0.30, looseness: 0.55, rub: 0.05, instability: 0.05 } }
                    }
                },
                {
                    split_feature: 'residualVibe', split_value: 0.28,
                    left: {
                        split_feature: 'ratio2X1X', split_value: 0.38,
                        left: {
                            split_feature: 'ratio1XDirect', split_value: 0.55,
                            left: { probabilities: { normal: 0.92, unbalance: 0.02, misalignment: 0.01, looseness: 0.01, rub: 0.02, instability: 0.02 } },
                            right: { probabilities: { normal: 0.08, unbalance: 0.82, misalignment: 0.03, looseness: 0.03, rub: 0.02, instability: 0.02 } }
                        },
                        right: { probabilities: { normal: 0.04, unbalance: 0.04, misalignment: 0.84, looseness: 0.04, rub: 0.02, instability: 0.02 } }
                    },
                    right: {
                        split_feature: 'isHighSpeed', split_value: 0.5,
                        left: {
                            split_feature: 'ratio2X1X', split_value: 0.3,
                            left: { probabilities: { normal: 0.04, unbalance: 0.04, misalignment: 0.04, looseness: 0.12, rub: 0.72, instability: 0.04 } },
                            right: { probabilities: { normal: 0.04, unbalance: 0.04, misalignment: 0.16, looseness: 0.56, rub: 0.16, instability: 0.04 } }
                        },
                        right: { probabilities: { normal: 0.02, unbalance: 0.02, misalignment: 0.02, looseness: 0.04, rub: 0.10, instability: 0.80 } }
                    }
                }
            ];

            const evalTree = (node, f) => {
                while (node.split_feature) {
                    const featVal = f[node.split_feature];
                    if (featVal <= node.split_value) {
                        node = node.left;
                    } else {
                        node = node.right;
                    }
                }
                return node.probabilities;
            };

            const f_vals = {
                ratio1XDirect: f_ratio1XDirect,
                ratio2X1X: f_ratio2X1X,
                residualVibe: f_residualVibe,
                hasCritical: f_hasCritical,
                isHighSpeed: f_isHighSpeed
            };

            const mlProbs = { normal: 0, unbalance: 0, misalignment: 0, looseness: 0, rub: 0, instability: 0 };
            forest.forEach(tree => {
                const probs = evalTree(tree, f_vals);
                for (const key in mlProbs) {
                    mlProbs[key] += probs[key] / forest.length;
                }
            });
            
            updateDiagnosticsUI(sensorCriticalSpeeds, diagList, primaryDiag, mlProbs);
        }

        function updateDiagnosticsUI(criticalSpeeds, diagList, primaryDiag, mlProbs) {
            const activeDatasetEl = document.getElementById("active-dataset-name");
            const datasetName = activeDatasetEl ? activeDatasetEl.innerText : "dataset.csv";
            window.dispatchEvent(new CustomEvent('rody_file_loaded', { detail: { filename: datasetName } }));

            const container = document.getElementById('tab-content-diagnostics');
            if (!container) return;
            
            // Format probabilities for ML classifier
            const mlProbList = [
                { name: 'Normal Operating State', prob: mlProbs ? mlProbs.normal : 1.0 },
                { name: 'Rotor Mass Unbalance', prob: mlProbs ? mlProbs.unbalance : 0.0 },
                { name: 'Shaft Misalignment', prob: mlProbs ? mlProbs.misalignment : 0.0 },
                { name: 'Mechanical Looseness', prob: mlProbs ? mlProbs.looseness : 0.0 },
                { name: 'Rotor-to-Stator Rub', prob: mlProbs ? mlProbs.rub : 0.0 },
                { name: 'Fluid Film Instability', prob: mlProbs ? mlProbs.instability : 0.0 }
            ];
            mlProbList.sort((a, b) => b.prob - a.prob);
            const mlPrimary = mlProbList[0];

            let html = `
                <div style="padding: 15px;">
                    <div class="neu-card-flat" style="padding: 15px; margin-bottom: 20px; border-radius: 12px;">
                        <h4 style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: var(--accent-color); margin-bottom: 8px; font-family: 'Outfit';">Primary Diagnostics</h4>
                        <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-color); margin-bottom: 5px;">
                            ${primaryDiag.score > 30 ? primaryDiag.type : 'Normal Operating State'}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">
                            Confidence Score: <span style="color: ${primaryDiag.score > 50 ? '#10b981' : '#f59e0b'}">${primaryDiag.score}%</span>
                        </div>
                    </div>
                    
                    <div class="neu-card-flat" style="padding: 15px; margin-bottom: 20px; border-radius: 12px; border-left: 4px solid #a855f7;">
                        <h4 style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: #a855f7; margin-bottom: 8px; font-family: 'Outfit'; display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-brain text-purple-500"></i>
                            <span>ML Random Forest Diagnostics</span>
                        </h4>
                        <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-color); margin-bottom: 5px;">
                            ${mlPrimary.prob > 0.3 ? mlPrimary.name : 'Normal Operating State'}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; margin-bottom: 12px;">
                            Classification Confidence: <span style="color: ${mlPrimary.prob > 0.5 ? '#10b981' : '#f59e0b'}">${Math.round(mlPrimary.prob * 100)}%</span>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--border-color); padding-top: 10px;">
                            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 2px;">Probability Distribution</div>
                            ${mlProbList.map(item => `
                                <div style="display: flex; flex-direction: column; gap: 3px;">
                                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
                                        <span style="font-weight: 600; color: var(--text-color);">${item.name}</span>
                                        <span style="font-weight: 700; color: var(--text-muted);">${Math.round(item.prob * 100)}%</span>
                                    </div>
                                    <div style="width: 100%; height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden;">
                                        <div style="width: ${Math.round(item.prob * 100)}%; height: 100%; background: ${item.prob > 0.5 ? 'linear-gradient(90deg, #a855f7, #7c3aed)' : '#94a3b8'}; border-radius: 3px;"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <h4 style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 12px;">Diagnostic Indicators</h4>
                    <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;">
            `;
            
            diagList.forEach(item => {
                html += `
                    <div class="neu-card" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; padding: 10px 12px; border-radius: 8px;">
                        <span style="font-weight: 600; color: var(--text-color);">${item.type}</span>
                        <span style="font-weight: 700; color: ${item.score > 60 ? '#ef4444' : item.score > 35 ? '#f59e0b' : 'var(--text-muted)'}">${item.score}%</span>
                    </div>
                `;
            });
            
            html += `
                    </div>
                    
                    <h4 style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 12px;">Identified Critical Speeds</h4>
                    <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 25px;">
            `;
            
            let hasCrit = false;
            for (let sensor in criticalSpeeds) {
                const peaks = criticalSpeeds[sensor];
                if (peaks.length > 0) {
                    hasCrit = true;
                    html += `
                        <div class="neu-card" style="font-size: 0.8rem; padding: 12px; border-radius: 8px;">
                            <div style="font-weight: 700; color: var(--text-color); margin-bottom: 6px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">
                                ${sensor} Sensor
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                    `;
                    peaks.forEach((peak, i) => {
                        html += `
                            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-color);">
                                <span>Resonance Peak #${i+1}: <b>${peak.rpm} RPM</b></span>
                                <span>Q-Factor: <b>${peak.q}</b></span>
                            </div>
                        `;
                    });
                    html += `
                            </div>
                        </div>
                    `;
                }
            }
            
            if (!hasCrit) {
                html += `
                    <div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 15px;">
                        No critical speed peaks detected in the active data range.
                    </div>
                `;
            }
            
            html += `
                    </div>
                    
                    <h4 style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">Engineering Recommendations</h4>
                    <div class="neu-card-flat" style="font-size: 0.8rem; line-height: 1.5; color: var(--text-muted); padding: 12px; border-radius: 8px; margin-bottom: 15px;">
                        ${primaryDiag.score > 30 ? primaryDiag.rec : 'Rotor is operating within normal vibration limits. Continue monitoring telemetry trends.'}
                    </div>
                    
                    <button class="neu-button" id="btn-generate-report" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; border-radius: 8px; font-weight: 600; font-family: 'Outfit'; font-size: 0.85rem; cursor: pointer;" onclick="window.handleGenerateReport && window.handleGenerateReport()">
                        <span id="report-btn-spinner" style="display: none; margin-right: 6px;" class="btn-spinner"></span>
                        <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="1.1em" width="1.1em" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        Generate AI PDF Report
                    </button>
                </div>
            `;
            
            window.activeDiagnosticsData = {
                criticalSpeeds,
                diagList,
                primaryDiag
            };
            
            container.innerHTML = html;
        }

        function detectStates(rpm, times) {
            let states = Array(rpm.length).fill('steady');
            
            if (rpm.length === 0) return states;
            
            const maxSpeed = Math.max(...rpm);
            // Steady state is defined as speeds within 5% of maximum speed,
            // but at least 100 RPM to avoid classifying zero speed as steady state.
            const steadyThreshold = Math.max(100, maxSpeed * 0.95);
            
            let first_steady = -1;
            let last_steady = -1;
            
            for (let i = 0; i < rpm.length; i++) {
                if (rpm[i] >= steadyThreshold) {
                    if (first_steady === -1) first_steady = i;
                    last_steady = i;
                }
            }
            
            if (first_steady === -1) {
                // If speed never reaches the threshold, check overall trend
                const first_val = rpm[0];
                const last_val = rpm[rpm.length - 1];
                const state = last_val > first_val ? 'startup' : 'coastdown';
                states.fill(state);
            } else {
                // Label startup
                for (let i = 0; i < first_steady; i++) {
                    states[i] = 'startup';
                }
                // Label steady state
                for (let i = first_steady; i <= last_steady; i++) {
                    states[i] = 'steady';
                }
                // Label coastdown
                for (let i = last_steady + 1; i < rpm.length; i++) {
                    states[i] = 'coastdown';
                }
            }
            
            return states;
        }

        function cleanPrefixForDisplay(prefix) {
            // Try to match BRG\d+... or Bearing\d+... or similar
            const match = prefix.match(/(BRG\d+.*|Bearing\d+.*)/i);
            if (match) {
                return match[0].toUpperCase();
            }
            // Fallback: split by space/underscore and return the last non-empty token
            const parts = prefix.split(/[\s_]+/);
            if (parts.length > 0) {
                const last = parts[parts.length - 1];
                if (last && last.toLowerCase().startsWith('brg')) {
                    return last.toUpperCase();
                }
            }
            return prefix;
        }

        // Populate sidebar tree view hierarchically by Bearing Pair and Channels
        function populateSidebarTree() {
            const treeEl = document.getElementById('sidebar-tree');
            treeEl.innerHTML = '';
            
            // Track which prefixes are grouped under bearings
            const groupedPrefixes = new Set();
            
            // 1. Group Bearing Pairs (Dual-axis plots and nested channel plots)
            bearingPairs.forEach((brg) => {
                const parentLi = document.createElement('li');
                parentLi.style.marginBottom = '6px';
                
                const parentHeader = document.createElement('div');
                parentHeader.className = 'tree-parent';
                parentHeader.onclick = () => toggleTreeNode('brg-' + brg);
                const isBrgExpanded = expandedTreeNodes.has('brg-' + brg);
                parentHeader.innerHTML = `
                    <span class="tree-caret ${isBrgExpanded ? '' : 'collapsed'}" id="tree-caret-brg-${brg}"></span>
                    <span>${cleanPrefixForDisplay(brg)}</span>
                `;
                parentLi.appendChild(parentHeader);
                
                const childrenUl = document.createElement('ul');
                childrenUl.className = 'tree-children' + (isBrgExpanded ? '' : ' collapsed');
                childrenUl.id = `tree-children-brg-${brg}`;
                
                // Add dual-axis plots for this bearing (excluding mode_shape which is system-wide)
                const dualPlots = [
                    { category: 'centerline', name: 'Shaft Centerline' },
                    { category: 'centerline_orbit', name: 'Centerline Orbit Overlay' },
                    { category: 'orbit', name: 'Rotor Orbits (2D/3D)' }
                ];
                
                dualPlots.forEach(p => {
                    const childLi = document.createElement('li');
                    childLi.className = 'tree-child-item';
                    childLi.innerText = p.name;
                    childLi.dataset.bearingOrChannel = brg;
                    childLi.dataset.category = p.category;
                    childLi.onclick = (e) => {
                        e.stopPropagation();
                        selectPlotType(brg, p.category, true);
                    };
                    childrenUl.appendChild(childLi);
                });
                
                const matchingPrefixes = singlePrefixes.filter(ch => {
                    if (ch.toLowerCase().startsWith(brg.toLowerCase())) return true;
                    if (brg.includes('/')) {
                        const parts = brg.split('/');
                        return parts.some(p => ch.toLowerCase().startsWith(p.toLowerCase()) || p.toLowerCase().startsWith(ch.toLowerCase()));
                    }
                    return false;
                });
                matchingPrefixes.forEach(ch => {
                    groupedPrefixes.add(ch);
                    
                    const subLi = document.createElement('li');
                    subLi.style.marginTop = '4px';
                    subLi.style.marginBottom = '4px';
                    subLi.style.paddingLeft = '8px';
                    
                    const subHeader = document.createElement('div');
                    subHeader.className = 'tree-parent';
                    subHeader.style.padding = '4px 8px';
                    subHeader.style.fontSize = '0.8rem';
                    subHeader.style.fontWeight = '500';
                    subHeader.onclick = (e) => {
                        e.stopPropagation();
                        toggleTreeNode('ch-' + ch);
                    };
                    const isChExpanded = expandedTreeNodes.has('ch-' + ch);
                    subHeader.innerHTML = `
                        <span class="tree-caret ${isChExpanded ? '' : 'collapsed'}" id="tree-caret-ch-${ch}"></span>
                        <span>${cleanPrefixForDisplay(ch)}</span>
                    `;
                    subLi.appendChild(subHeader);
                    
                    const subChildrenUl = document.createElement('ul');
                    subChildrenUl.className = 'tree-children' + (isChExpanded ? '' : ' collapsed');
                    subChildrenUl.id = `tree-children-ch-${ch}`;
                    subChildrenUl.style.paddingLeft = '12px';
                    
                    const singlePlots = [
                        { category: 'trend', name: 'Time Trend Plot' },
                        { category: 'polar', name: 'Polar Plot' },
                        { category: 'bode2d', name: 'Bode Plot (2D)' },
                        // { category: 'bode3d', name: 'Bode Plot (3D)' },
                        { category: 'spectrum', name: 'FFT Spectrum' }
                        // { category: 'cascade', name: '3D Waterfall Spectrum' }
                    ];
                    
                    singlePlots.forEach(p => {
                        const childLi = document.createElement('li');
                        childLi.className = 'tree-child-item';
                        childLi.innerText = p.name;
                        childLi.dataset.bearingOrChannel = ch;
                        childLi.dataset.category = p.category;
                        childLi.onclick = (e) => {
                            e.stopPropagation();
                            selectPlotType(ch, p.category, false);
                        };
                        subChildrenUl.appendChild(childLi);
                    });
                    
                    subLi.appendChild(subChildrenUl);
                    childrenUl.appendChild(subLi);
                });
                
                parentLi.appendChild(childrenUl);
                treeEl.appendChild(parentLi);
            });
            
            // 2. System Profile (for whole-shaft plots like Mode Shape)
            const sysLi = document.createElement('li');
            sysLi.style.marginBottom = '6px';
            
            const sysHeader = document.createElement('div');
            sysHeader.className = 'tree-parent';
            sysHeader.onclick = () => toggleTreeNode('system-profile');
            sysHeader.innerHTML = `
                <span class="tree-caret collapsed" id="tree-caret-system-profile"></span>
                <span>System Profile</span>
            `;
            sysLi.appendChild(sysHeader);
            
            const sysChildrenUl = document.createElement('ul');
            sysChildrenUl.className = 'tree-children collapsed';
            sysChildrenUl.id = 'tree-children-system-profile';
            
            const sysPlots = [
                { category: 'mode_shape', name: 'Rotor Profile' }
            ];
            
            sysPlots.forEach(p => {
                const childLi = document.createElement('li');
                childLi.className = 'tree-child-item';
                childLi.innerText = p.name;
                childLi.dataset.bearingOrChannel = 'System';
                childLi.dataset.category = p.category;
                childLi.onclick = (e) => {
                    e.stopPropagation();
                    selectPlotType('System', p.category, true);
                };
                sysChildrenUl.appendChild(childLi);
            });
            sysLi.appendChild(sysChildrenUl);
            treeEl.appendChild(sysLi);
            
            // 3. General Sensors (for any ungrouped prefixes)
            const ungroupedPrefixes = singlePrefixes.filter(ch => !groupedPrefixes.has(ch));
            if (ungroupedPrefixes.length > 0) {
                const genLi = document.createElement('li');
                genLi.style.marginBottom = '6px';
                
                const genHeader = document.createElement('div');
                genHeader.className = 'tree-parent';
                genHeader.onclick = () => toggleTreeNode('general-sensors');
                genHeader.innerHTML = `
                    <span class="tree-caret collapsed" id="tree-caret-general-sensors"></span>
                    <span>General Sensors</span>
                `;
                genLi.appendChild(genHeader);
                
                const genChildrenUl = document.createElement('ul');
                genChildrenUl.className = 'tree-children collapsed';
                genChildrenUl.id = 'tree-children-general-sensors';
                
                ungroupedPrefixes.forEach(ch => {
                    const subLi = document.createElement('li');
                    subLi.style.marginTop = '4px';
                    subLi.style.marginBottom = '4px';
                    subLi.style.paddingLeft = '8px';
                    
                    const subHeader = document.createElement('div');
                    subHeader.className = 'tree-parent';
                    subHeader.style.padding = '4px 8px';
                    subHeader.style.fontSize = '0.8rem';
                    subHeader.style.fontWeight = '500';
                    subHeader.onclick = (e) => {
                        e.stopPropagation();
                        toggleTreeNode('ch-' + ch);
                    };
                    subHeader.innerHTML = `
                        <span class="tree-caret collapsed" id="tree-caret-ch-${ch}"></span>
                        <span>${cleanPrefixForDisplay(ch)}</span>
                    `;
                    subLi.appendChild(subHeader);
                    
                    const subChildrenUl = document.createElement('ul');
                    subChildrenUl.className = 'tree-children collapsed';
                    subChildrenUl.id = `tree-children-ch-${ch}`;
                    subChildrenUl.style.paddingLeft = '12px';
                    
                    const singlePlots = [
                        { category: 'trend', name: 'Time Trend Plot' },
                        { category: 'polar', name: 'Polar Plot' },
                        { category: 'bode2d', name: 'Bode Plot (2D)' },
                        // { category: 'bode3d', name: 'Bode Plot (3D)' },
                        { category: 'spectrum', name: 'FFT Spectrum' }
                        // { category: 'cascade', name: '3D Waterfall Spectrum' }
                    ];
                    
                    singlePlots.forEach(p => {
                        const childLi = document.createElement('li');
                        childLi.className = 'tree-child-item';
                        childLi.innerText = p.name;
                        childLi.dataset.bearingOrChannel = ch;
                        childLi.dataset.category = p.category;
                        childLi.onclick = (e) => {
                            e.stopPropagation();
                            selectPlotType(ch, p.category, false);
                        };
                        subChildrenUl.appendChild(childLi);
                    });
                    
                    subLi.appendChild(subChildrenUl);
                    genChildrenUl.appendChild(subLi);
                });
                
                genLi.appendChild(genChildrenUl);
                treeEl.appendChild(genLi);
            }
            
            // Expand the first node by default
            if (bearingPairs.length > 0) {
                toggleTreeNode('brg-' + bearingPairs[0]);
            } else {
                toggleTreeNode('system-profile');
            }
        }

        function toggleTreeNode(idx) {
            const childrenUl = document.getElementById(`tree-children-${idx}`);
            const caret = document.getElementById(`tree-caret-${idx}`);
            
            if (expandedTreeNodes.has(idx)) {
                expandedTreeNodes.delete(idx);
                if (childrenUl) childrenUl.classList.add('collapsed');
                if (caret) caret.classList.add('collapsed');
            } else {
                expandedTreeNodes.add(idx);
                if (childrenUl) childrenUl.classList.remove('collapsed');
                if (caret) caret.classList.remove('collapsed');
            }
        }

        let activeBearingOrChannel = null;

        function getPriorityOrder(prefixes) {
            if (!prefixes || prefixes.length === 0) return [];
            return [...prefixes].sort((a, b) => {
                const parse = (p) => {
                    const m = p.match(/^([a-zA-Z\s]*)(\d+)(.*)$/);
                    if (m) {
                        return {
                            name: m[1],
                            num: parseInt(m[2], 10),
                            suffix: m[3].toLowerCase()
                        };
                    }
                    return { name: p, num: 999, suffix: '' };
                };
                const pa = parse(a);
                const pb = parse(b);
                if (pa.name !== pb.name) return pa.name.localeCompare(pb.name);
                if (pa.num !== pb.num) return pa.num - pb.num;
                const getSuffixVal = (s) => {
                    if (s.includes('x')) return 1;
                    if (s.includes('y')) return 2;
                    if (s.includes('seis')) return 3;
                    return 4;
                };
                return getSuffixVal(pa.suffix) - getSuffixVal(pb.suffix);
            });
        }

        function applyCategoryToAllSlots(category) {
            if (!singlePrefixes || singlePrefixes.length === 0) return;
            
            const bearingPairCategories = ['orbit', 'centerline', 'centerline_orbit'];
            let isSingle = !bearingPairCategories.includes(category);
            
            const orderedPrefixes = getPriorityOrder(singlePrefixes);
            const targets = isSingle ? orderedPrefixes : bearingPairs;
            
            // Get capacity of current layout
            const capacity = currentLayout ? (
                currentLayout === '1' ? 1 :
                (currentLayout === '2H' || currentLayout === '2V') ? 2 :
                currentLayout === '4' ? 4 :
                currentLayout === '6' ? 6 : 8
            ) : 8;
            
            const N_plots = targets.length;
            const N = Math.min(N_plots, 8); // cap available plots at 8
            
            // Keep current layout capacity if it fits N, otherwise expand to fit N
            const totalSlots = Math.max(capacity, N);
            
            plotSlots = [];
            for (let i = 0; i < totalSlots; i++) {
                if (i < N) {
                    plotSlots.push({
                        bearingOrChannel: targets[i],
                        category: category,
                        isDual: !isSingle,
                        layoutLimits: { min: null, max: null, autoScale: true },
                        showTimebase: true,
                        showTrace2: false,
                        cycles: 8
                    });
                } else {
                    plotSlots.push(null); // Leave empty slots
                }
            }
            
            let layout = currentLayout || '8';
            if (N > capacity) {
                if (N === 1) layout = '1';
                else if (N === 2) layout = '2V';
                else if (N <= 4) layout = '4';
                else if (N <= 6) layout = '6';
                else layout = '8';
            }
            
            currentLayout = layout;
            currentLayoutRef.current = layout;
            setCurrentLayoutState(layout);
            
            if (activeSlotIndex >= totalSlots) {
                activeSlotIndex = 0;
            }
            
            renderGrid();
            saveWorkspaceConfig();
        }

        function selectPlotType(bearingOrChannel, category, isDual) {
            // Update ONLY the selected/active window slot instead of overwriting all slots!
            // This enables comparing different plot types across different slots.
            const capacity = currentLayout ? (
                currentLayout === '1' ? 1 :
                (currentLayout === '2H' || currentLayout === '2V') ? 2 :
                currentLayout === '4' ? 4 :
                currentLayout === '6' ? 6 : 8
            ) : 8;
            
            // Ensure plotSlots is sized up to capacity to support setting slots
            while (plotSlots.length < capacity) {
                plotSlots.push(null);
            }
            
            if (activeSlotIndex >= 0 && activeSlotIndex < capacity) {
                plotSlots[activeSlotIndex] = {
                    bearingOrChannel: bearingOrChannel,
                    category: category,
                    isDual: isDual,
                    layoutLimits: { min: null, max: null, autoScale: true },
                    showTimebase: true,
                    showTrace2: false,
                    cycles: 8
                };
            }
            renderGrid();
            saveWorkspaceConfig();
        }

        function populatePlotFromToolbar(category) {
            applyCategoryToAllSlots(category);
        }
        window.populatePlotFromToolbar = populatePlotFromToolbar;

        function syncSidebarTreeHighlights() {
            const activePlot = plotSlots[activeSlotIndex];
            document.querySelectorAll('.tree-child-item').forEach(item => {
                const itemBc = item.dataset.bearingOrChannel;
                const itemCat = item.dataset.category;
                if (activePlot && activePlot.bearingOrChannel === itemBc && activePlot.category === itemCat) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
        }

        function selectOrAddOption(selectElement, value) {
            if (!value || !selectElement) return;
            
            let exists = false;
            for (let i = 0; i < selectElement.options.length; i++) {
                if (selectElement.options[i].value === value) {
                    exists = true;
                    break;
                }
            }
            
            if (!exists) {
                const opt = document.createElement('option');
                opt.value = value;
                const tsStr = String(value);
                const t_part = tsStr.split(' ')[1] || tsStr;
                opt.innerText = t_part.slice(0, 8);
                
                const tDate = parseTimestamp(value);
                const insertTime = tDate ? tDate.getTime() : 0;
                opt.dataset.time = insertTime;
                
                let inserted = false;
                for (let i = 1; i < selectElement.options.length; i++) {
                    const optVal = selectElement.options[i].value;
                    if (optVal !== 'all') {
                        let optTime = selectElement.options[i].dataset.time;
                        if (optTime === undefined) {
                            const optDate = parseTimestamp(optVal);
                            optTime = optDate ? optDate.getTime() : 0;
                            selectElement.options[i].dataset.time = optTime;
                        }
                        optTime = parseInt(optTime);
                        if (insertTime < optTime) {
                            selectElement.insertBefore(opt, selectElement.options[i]);
                            inserted = true;
                            break;
                        }
                    }
                }
                if (!inserted) {
                    selectElement.appendChild(opt);
                }
            }
            
            selectElement.value = value;
        }

        // Populate Timeline Filters dynamically
        function populateFilterControls() {
            if (df.length === 0) return;
            
            const speeds = df.map(r => r[speedCol] || 0);
            const minSpeed = Math.min(...speeds);
            const maxSpeed = Math.max(...speeds);
            
            document.getElementById('filter-min-rpm').value = Math.floor(minSpeed);
            document.getElementById('filter-max-rpm').value = Math.ceil(maxSpeed);
            activeMinRPM = Math.floor(minSpeed);
            activeMaxRPM = Math.ceil(maxSpeed);
            
            const startSel = document.getElementById('filter-start-time');
            const endSel = document.getElementById('filter-end-time');
            
            startSel.innerHTML = '<option value="all">Start of Timeline</option>';
            endSel.innerHTML = '<option value="all">End of Timeline</option>';
            
            const step = Math.max(1, Math.floor(df.length / 25));
            for (let i = 0; i < df.length; i += step) {
                const ts = df[i][tsCol];
                if (!ts) continue;
                
                const tsStr = ts ? String(ts) : '';
                const t_part = tsStr.split(' ')[1] || tsStr;
                
                const optStart = document.createElement('option');
                optStart.value = ts;
                optStart.innerText = t_part.slice(0, 8);
                startSel.appendChild(optStart);
                
                const optEnd = document.createElement('option');
                optEnd.value = ts;
                optEnd.innerText = t_part.slice(0, 8);
                endSel.appendChild(optEnd);
            }
            
            const firstTs = df[0][tsCol];
            const lastTs = df[df.length - 1][tsCol];
            selectOrAddOption(startSel, firstTs);
            selectOrAddOption(endSel, lastTs);
            activeStartTime = firstTs;
            activeEndTime = lastTs;
            
            const presetSelect = document.getElementById('filter-time-window');
            if (presetSelect) presetSelect.value = 'all';
        }

        // Slow Roll Compensation state & handlers
        savedSlowRollSamples = savedSlowRollSamples || [];
        activeSlowRollSampleId = activeSlowRollSampleId || null;
        slowRollCompensationEnabled = slowRollCompensationEnabled !== undefined ? slowRollCompensationEnabled : false;

        function populateSlowRollDropdown() {
            const selectEl = document.getElementById('slow-roll-sample-select');
            if (!selectEl) return;
            selectEl.innerHTML = '';
            
            if (df.length === 0) {
                selectEl.innerHTML = '<option value="">(No Data Loaded)</option>';
                return;
            }

            // Find samples with speed > 50 and speed < 1200 sorted by speed
            const lowSpeedRows = df.filter(r => isNumber(r[speedCol]) && r[speedCol] > 50 && r[speedCol] < 1200)
                                   .sort((a, b) => a[speedCol] - b[speedCol]);
            
            // Downsample if we have too many points to avoid sluggish dropdowns
            const step = Math.max(1, Math.floor(lowSpeedRows.length / 50));
            const items = [];
            for (let i = 0; i < lowSpeedRows.length; i += step) {
                items.push(lowSpeedRows[i]);
            }
            const finalRows = items.slice(0, 50);

            if (finalRows.length === 0) {
                df.slice(0, 20).forEach(row => {
                    const option = document.createElement('option');
                    option.value = row._time_ms;
                    const spd = row[speedCol] !== undefined && row[speedCol] !== null ? parseFloat(row[speedCol]) : 0;
                    option.text = `${isNaN(spd) ? '0' : spd.toFixed(0)} RPM (${row[tsCol] ? String(row[tsCol]).split(' ')[1] || row[tsCol] : ''})`;
                    selectEl.appendChild(option);
                });
            } else {
                finalRows.forEach(row => {
                    const option = document.createElement('option');
                    option.value = row._time_ms;
                    const spd = row[speedCol] !== undefined && row[speedCol] !== null ? parseFloat(row[speedCol]) : 0;
                    option.text = `${isNaN(spd) ? '0' : spd.toFixed(0)} RPM (${row[tsCol] ? String(row[tsCol]).split(' ')[1] || row[tsCol] : ''})`;
                    selectEl.appendChild(option);
                });
            }
            
            const nameInput = document.getElementById('slow-roll-name-input');
            if (nameInput && selectEl.options[0]) {
                nameInput.value = `Slow Roll ${selectEl.options[0].text.split(' ')[0]}RPM`;
            }
            
            selectEl.onchange = () => {
                const text = selectEl.options[selectEl.selectedIndex].text;
                if (nameInput) {
                    nameInput.value = `Slow Roll ${text.split(' ')[0]}RPM`;
                }
            };
        }
        window.populateSlowRollDropdown = populateSlowRollDropdown;

        function saveSlowRollSample() {
            const selectEl = document.getElementById('slow-roll-sample-select');
            const nameInput = document.getElementById('slow-roll-name-input');
            if (!selectEl || selectEl.value === "") return;
            
            const targetTimeMs = parseInt(selectEl.value);
            const name = nameInput.value.trim() || `Slow Roll ${selectEl.options[selectEl.selectedIndex].text.split(' ')[0]}RPM`;
            
            const targetRow = df.find(r => r._time_ms === targetTimeMs);
            if (!targetRow) return;
            
            const newSample = {
                id: targetTimeMs,
                name: name,
                row: targetRow
            };
            
            if (!savedSlowRollSamples.find(s => s.id === targetTimeMs)) {
                savedSlowRollSamples.push(newSample);
            }
            activeSlowRollSampleId = targetTimeMs;
            
            updateSavedSlowRollList();
            
            if (slowRollCompensationEnabled) {
                invalidateFilteredDataCache();
                renderGrid();
            }
        }
        window.saveSlowRollSample = saveSlowRollSample;

        function updateSavedSlowRollList() {
            const listEl = document.getElementById('slow-roll-saved-list');
            if (!listEl) return;
            listEl.innerHTML = '';
            
            if (savedSlowRollSamples.length === 0) {
                listEl.innerHTML = '<span style="font-style: italic; font-size: 0.65rem;">No saved samples.</span>';
                return;
            }
            
            savedSlowRollSamples.forEach(sample => {
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.alignItems = 'center';
                item.style.padding = '3px 6px';
                item.style.borderRadius = '3px';
                item.style.border = '1px solid var(--border-color)';
                item.style.backgroundColor = activeSlowRollSampleId === sample.id ? 'rgba(14, 165, 233, 0.1)' : 'transparent';
                
                const label = document.createElement('span');
                label.innerText = sample.name;
                label.style.cursor = 'pointer';
                label.style.fontWeight = activeSlowRollSampleId === sample.id ? '700' : 'normal';
                label.onclick = () => {
                    activeSlowRollSampleId = sample.id;
                    updateSavedSlowRollList();
                    if (slowRollCompensationEnabled) {
                        invalidateFilteredDataCache();
                        renderGrid();
                    }
                };
                
                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '✕';
                deleteBtn.style.border = 'none';
                deleteBtn.style.background = 'none';
                deleteBtn.style.color = '#ef4444';
                deleteBtn.style.cursor = 'pointer';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    savedSlowRollSamples = savedSlowRollSamples.filter(s => s.id !== sample.id);
                    if (activeSlowRollSampleId === sample.id) {
                        activeSlowRollSampleId = savedSlowRollSamples[0] ? savedSlowRollSamples[0].id : null;
                    }
                    updateSavedSlowRollList();
                    if (slowRollCompensationEnabled) {
                        invalidateFilteredDataCache();
                        renderGrid();
                    }
                };
                
                item.appendChild(label);
                item.appendChild(deleteBtn);
                listEl.appendChild(item);
            });
        }
        window.updateSavedSlowRollList = updateSavedSlowRollList;

        function toggleSlowRoll(checked) {
            slowRollCompensationEnabled = checked;
            const checkboxEl = document.getElementById('slow-roll-enabled');
            if (checkboxEl) {
                checkboxEl.checked = checked;
            }
            invalidateFilteredDataCache();
            renderGrid();
            if (checked) {
                window.dispatchEvent(new CustomEvent('rody_slowroll_subtracted'));
            }
        }
        window.toggleSlowRoll = toggleSlowRoll;

        // Active filters cache
        cachedFilteredDf = null;
        function invalidateFilteredDataCache() {
            cachedFilteredDf = null;
        }

        // Active filters solver
        function getFilteredData() {
            if (cachedFilteredDf !== null) {
                return cachedFilteredDf;
            }
            
            let filtered = df;
            
            // 1. Filter by State
            if (activeStateFilter !== 'all') {
                filtered = filtered.filter(r => r['state'] && String(r['state']).toLowerCase() === activeStateFilter.toLowerCase());
            }
            
            // 2. Filter by RPM
            if (activeMinRPM !== null) {
                filtered = filtered.filter(r => (r[speedCol] || 0) >= activeMinRPM);
            }
            if (activeMaxRPM !== null) {
                filtered = filtered.filter(r => (r[speedCol] || 0) <= activeMaxRPM);
            }
            
            // 3. Filter by Time Window
            if (activeStartTime !== 'all') {
                const startMs = parseTimestamp(activeStartTime).getTime();
                filtered = filtered.filter(r => r['_time_ms'] >= startMs);
            }
            if (activeEndTime !== 'all') {
                const endMs = parseTimestamp(activeEndTime).getTime();
                filtered = filtered.filter(r => r['_time_ms'] <= endMs);
            }
            
            if (slowRollCompensationEnabled && activeSlowRollSampleId) {
                const slowRollSample = savedSlowRollSamples.find(s => s.id === activeSlowRollSampleId);
                if (slowRollSample && slowRollSample.row) {
                    const srRow = slowRollSample.row;
                    
                    // Pre-calculate and cache the column mappings for all active channels 
                    // to prevent millions of redundant string regex executions inside the row loop
                    const channelColumnsCache = {};
                    singlePrefixes.forEach(ch => {
                        channelColumnsCache[ch] = getChannelColumns(ch);
                    });
                    
                    filtered = filtered.map(row => {
                        const compRow = { ...row };
                        singlePrefixes.forEach(ch => {
                            const cols = channelColumnsCache[ch];
                            if (cols.amp_1x && cols.phase_1x) {
                                const Ad = row[cols.amp_1x];
                                const phid = row[cols.phase_1x];
                                const Asr = srRow[cols.amp_1x];
                                const phisr = srRow[cols.phase_1x];
                                if (isNumber(Ad) && isNumber(phid) && isNumber(Asr) && isNumber(phisr)) {
                                    const phid_rad = phid * Math.PI / 180;
                                    const phisr_rad = phisr * Math.PI / 180;
                                    const xd = Ad * Math.cos(phid_rad);
                                    const yd = Ad * Math.sin(phid_rad);
                                    const xsr = Asr * Math.cos(phisr_rad);
                                    const ysr = Asr * Math.sin(phisr_rad);
                                    const x_comp = xd - xsr;
                                    const y_comp = yd - ysr;
                                    const amp_comp = Math.sqrt(x_comp * x_comp + y_comp * y_comp);
                                    let phase_comp = Math.atan2(y_comp, x_comp) * 180 / Math.PI;
                                    if (phase_comp < 0) phase_comp += 360;
                                    compRow[cols.amp_1x] = amp_comp;
                                    compRow[cols.phase_1x] = phase_comp;
                                }
                            }
                            if (cols.amp_2x && cols.phase_2x) {
                                const Ad2 = row[cols.amp_2x];
                                const phid2 = row[cols.phase_2x];
                                const Asr2 = srRow[cols.amp_2x];
                                const phisr2 = srRow[cols.phase_2x];
                                if (isNumber(Ad2) && isNumber(phid2) && isNumber(Asr2) && isNumber(phisr2)) {
                                    const phid2_rad = phid2 * Math.PI / 180;
                                    const phisr2_rad = phisr2 * Math.PI / 180;
                                    const xd2 = Ad2 * Math.cos(phid2_rad);
                                    const yd2 = Ad2 * Math.sin(phid2_rad);
                                    const xsr2 = Asr2 * Math.cos(phisr2_rad);
                                    const ysr2 = Asr2 * Math.sin(phisr2_rad);
                                    const x_comp2 = xd2 - xsr2;
                                    const y_comp2 = yd2 - ysr2;
                                    const amp_comp2 = Math.sqrt(x_comp2 * x_comp2 + y_comp2 * y_comp2);
                                    let phase_comp2 = Math.atan2(y_comp2, x_comp2) * 180 / Math.PI;
                                    if (phase_comp2 < 0) phase_comp2 += 360;
                                    compRow[cols.amp_2x] = amp_comp2;
                                    compRow[cols.phase_2x] = phase_comp2;
                                }
                            }
                            if (cols.gap) {
                                const Gd = row[cols.gap];
                                const Gsr = srRow[cols.gap];
                                if (isNumber(Gd) && isNumber(Gsr)) {
                                    compRow[cols.gap] = Gd - Gsr;
                                }
                            }
                        });
                        return compRow;
                    });
                }
            }

            cachedFilteredDf = filtered;
            return filtered;
        }

        // Filter event listeners with automatic state-based time bounds detection
        function handleStateFilterChange(event) {
            activeStateFilter = event.target.value;
            
            if (activeStateFilter !== 'all') {
                const stateData = df.filter(r => r['state'] && String(r['state']).toLowerCase() === activeStateFilter.toLowerCase());
                if (stateData.length > 0) {
                    const firstTs = stateData[0][tsCol];
                    const lastTs = stateData[stateData.length - 1][tsCol];
                    
                    const startSel = document.getElementById('filter-start-time');
                    const endSel = document.getElementById('filter-end-time');
                    selectOrAddOption(startSel, firstTs);
                    selectOrAddOption(endSel, lastTs);
                    
                    activeStartTime = firstTs;
                    activeEndTime = lastTs;
                    
                    // Synchronize Min/Max RPM to this state
                    const speeds = stateData.map(r => r[speedCol] || 0);
                    const minSpeed = Math.min(...speeds);
                    const maxSpeed = Math.max(...speeds);
                    
                    document.getElementById('filter-min-rpm').value = Math.floor(minSpeed);
                    document.getElementById('filter-max-rpm').value = Math.ceil(maxSpeed);
                    activeMinRPM = Math.floor(minSpeed);
                    activeMaxRPM = Math.ceil(maxSpeed);
                }
            } else {
                const firstTs = df[0][tsCol];
                const lastTs = df[df.length - 1][tsCol];
                const startSel = document.getElementById('filter-start-time');
                const endSel = document.getElementById('filter-end-time');
                selectOrAddOption(startSel, firstTs);
                selectOrAddOption(endSel, lastTs);
                activeStartTime = firstTs;
                activeEndTime = lastTs;
                
                // Reset to global Min/Max RPM
                const speeds = df.map(r => r[speedCol] || 0);
                const minSpeed = Math.min(...speeds);
                const maxSpeed = Math.max(...speeds);
                
                document.getElementById('filter-min-rpm').value = Math.floor(minSpeed);
                document.getElementById('filter-max-rpm').value = Math.ceil(maxSpeed);
                activeMinRPM = Math.floor(minSpeed);
                activeMaxRPM = Math.ceil(maxSpeed);
            }
            
            const presetSelect = document.getElementById('filter-time-window');
            if (presetSelect) presetSelect.value = 'all';
            
            activeCursorIndex = 0;
            renderGrid();
        }

        function handleRPMFilterChange() {
            activeMinRPM = parseFloat(document.getElementById('filter-min-rpm').value) || 0;
            activeMaxRPM = parseFloat(document.getElementById('filter-max-rpm').value) || 99999;
            renderGrid();
        }

        function handleTimeFilterChange(type) {
            activeStartTime = document.getElementById('filter-start-time').value;
            activeEndTime = document.getElementById('filter-end-time').value;
            
            const presetSelect = document.getElementById('filter-time-window');
            if (type === 'start' && presetSelect && presetSelect.value !== 'all' && presetSelect.value !== 'custom') {
                const durationMinutes = parseFloat(presetSelect.value);
                if (!isNaN(durationMinutes)) {
                    const startMs = parseTimestamp(activeStartTime).getTime();
                    const endMs = startMs + (durationMinutes * 60 * 1000);
                    
                    const closestIdx = findClosestRowIndexByMs(df, endMs);
                    if (closestIdx !== -1) {
                        activeEndTime = df[closestIdx][tsCol];
                        const endSel = document.getElementById('filter-end-time');
                        selectOrAddOption(endSel, activeEndTime);
                    }
                }
            } else if (type === 'end') {
                if (presetSelect) {
                    presetSelect.value = 'custom';
                }
            }
            
            activeCursorIndex = 0;
            renderGrid();
        }

        function findClosestRowIndexByMs(localDf, targetMs) {
            if (localDf.length === 0) return -1;
            let low = 0;
            let high = localDf.length - 1;
            
            while (low < high) {
                let mid = Math.floor((low + high) / 2);
                let midMs = localDf[mid]._time_ms;
                
                if (midMs === targetMs) {
                    return mid;
                } else if (midMs < targetMs) {
                    low = mid + 1;
                } else {
                    high = mid;
                }
            }
            
            let closest = low;
            if (low > 0 && Math.abs(localDf[low - 1]._time_ms - targetMs) < Math.abs(localDf[low]._time_ms - targetMs)) {
                closest = low - 1;
            }
            return closest;
        }

        function handleTimeWindowPresetChange(event) {
            if (df.length === 0) return;
            const presetVal = event.target.value;
            
            if (presetVal === 'all') {
                activeStartTime = df[0][tsCol];
                activeEndTime = df[df.length - 1][tsCol];
                
                selectOrAddOption(document.getElementById('filter-start-time'), activeStartTime);
                selectOrAddOption(document.getElementById('filter-end-time'), activeEndTime);
            } else if (presetVal !== 'custom') {
                const durationMinutes = parseFloat(presetVal);
                if (!isNaN(durationMinutes)) {
                    let currentStart = document.getElementById('filter-start-time').value;
                    if (currentStart === 'all' || !currentStart) {
                        currentStart = df[0][tsCol];
                    }
                    
                    activeStartTime = currentStart;
                    const startMs = parseTimestamp(activeStartTime).getTime();
                    const endMs = startMs + (durationMinutes * 60 * 1000);
                    
                    const closestIdx = findClosestRowIndexByMs(df, endMs);
                    if (closestIdx !== -1) {
                        activeEndTime = df[closestIdx][tsCol];
                    } else {
                        activeEndTime = df[df.length - 1][tsCol];
                    }
                    
                    selectOrAddOption(document.getElementById('filter-start-time'), activeStartTime);
                    selectOrAddOption(document.getElementById('filter-end-time'), activeEndTime);
                }
            }
            
            activeCursorIndex = 0;
            renderGrid();
        }

        // Hover telemetry updater
        function updateTelemetryReadout(items) {
            const bar = document.getElementById('telemetry-display');
            bar.innerHTML = '';
            
            if (items.length === 0) {
                bar.innerHTML = '<span class="telemetry-item" style="color: var(--text-muted);">Hover cursor over data points on the plot area to view detailed diagnostic values...</span>';
                return;
            }
            
            items.forEach((item, idx) => {
                const span = document.createElement('span');
                span.className = 'telemetry-item';
                span.innerHTML = `<span class="telemetry-label">${item.label}:</span><span class="telemetry-value">${item.val}</span>`;
                bar.appendChild(span);
                
                if (idx < items.length - 1) {
                    const div = document.createElement('span');
                    div.className = 'telemetry-divider';
                    div.innerText = '|';
                    bar.appendChild(div);
                }
            });
        }

        function updateTelemetryReadoutForIndex(idx) {
            const filteredDf = getFilteredData();
            const row = filteredDf[idx];
            if (!row) return;
            
            const ts = row[tsCol];
            const rpm = row[speedCol];
            
            let anomalyDetected = false;
            let offendingChannel = '';
            
            const cols = Object.keys(row);
            const directCols = cols.filter(c => c.toLowerCase().endsWith('_direct'));
            
            directCols.forEach(col => {
                const limit = baselineThresholds[col];
                if (limit && isNumber(row[col]) && row[col] > limit) {
                    anomalyDetected = true;
                    offendingChannel = col.split('_')[0];
                }
            });
            
            const items = [
                { label: 'Time', val: ts },
                { label: 'Machine Speed', val: `${rpm.toFixed(0)} RPM` },
                { label: 'State', val: (row['state'] || '-').toUpperCase() }
            ];
            
            if (anomalyDetected) {
                items.push({ 
                    label: '⚠️ ML Baseline Anomaly Alert', 
                    val: `<span style="color: #ef4444; font-weight: 700; background-color: rgba(239, 68, 68, 0.1); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.25);">DEVIATION DETECTED (${offendingChannel})</span>` 
                });
            } else {
                items.push({ 
                    label: '✅ ML Baseline Status', 
                    val: '<span style="color: #10b981; font-weight: 600;">NORMAL LIMITS</span>' 
                });
            }
            
            updateTelemetryReadout(items);
        }

        // Update plot telemetry card dynamically
        function updateSlotTelemetryBox(slotIdx, dataIdx) {
            const config = plotSlots[slotIdx];
            if (!config) return;
            const box = document.getElementById(`plot-telemetry-box-${slotIdx}`);
            if (!box) return;
            
            const filteredDf = getFilteredData();
            const row = filteredDf[dataIdx];
            if (!row) {
                box.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">Hover or click plot to inspect telemetry...</span>';
                return;
            }
            
            box.style.display = 'flex';
            const ts = row[tsCol];
            const rpm = row[speedCol];
            const tsStr = ts ? String(ts) : '';
            const t_part = tsStr.split(' ')[1] || tsStr;

            // Retrieve dynamic units
            const ch = config.bearingOrChannel;
            let chX = ch, chY = ch;
            if (ch && ch.includes('/')) {
                const parts = ch.split('/');
                chX = parts[0];
                chY = parts[1];
            }
            const speedUnit = getChannelUnit(chX, 'speed', 'RPM');
            const ampUnit = getChannelUnit(chX, 'amp', 'mils');
            const phaseSymbol = getChannelUnit(chX, 'phase', 'deg') === 'deg' ? '°' : ' ' + getChannelUnit(chX, 'phase', 'deg');
            const tempUnit = getChannelUnit(chX, 'temp', '°C');

            const speedText = rpm !== undefined && rpm !== null ? `${rpm.toFixed(0)} ${speedUnit}` : 'N/A';
            
            if (config.category === 'trend' || config.category === 'bode2d') {
                const cols = getChannelColumns(ch);
                let directVal = cols.direct && row[cols.direct] !== undefined && row[cols.direct] !== null ? `${row[cols.direct].toFixed(3)} ${ampUnit}` : 'N/A';
                let amp1x = cols.amp_1x && row[cols.amp_1x] !== undefined && row[cols.amp_1x] !== null ? `${row[cols.amp_1x].toFixed(3)} ${ampUnit}` : 'N/A';
                let phase1x = cols.phase_1x && row[cols.phase_1x] !== undefined && row[cols.phase_1x] !== null ? `${row[cols.phase_1x].toFixed(1)}${phaseSymbol}` : 'N/A';
                let gapVal = cols.gap && row[cols.gap] !== undefined && row[cols.gap] !== null ? `${row[cols.gap].toFixed(2)} ${ampUnit}` : 'N/A';
                let tempVal = cols.temp && row[cols.temp] !== undefined && row[cols.temp] !== null ? `${row[cols.temp].toFixed(1)} ${tempUnit}` : 'N/A';
                
                const showDirect = document.getElementById('show-trend-direct') ? document.getElementById('show-trend-direct').checked : true;
                const show1X = document.getElementById('show-trend-1x') ? document.getElementById('show-trend-1x').checked : true;
                const showGap = document.getElementById('show-trend-gap') ? document.getElementById('show-trend-gap').checked : true;
                const showTemp = document.getElementById('show-trend-temp') ? document.getElementById('show-trend-temp').checked : true;

                let htmlParts = [
                    `<span><b>Time:</b> ${t_part.slice(0, 8)}</span>`,
                    `<span><b>RPM:</b> ${speedText}</span>`
                ];
                if (showDirect) htmlParts.push(`<span><b>Direct:</b> ${directVal}</span>`);
                if (show1X) htmlParts.push(`<span><b>1X:</b> ${amp1x} @ ${phase1x}</span>`);
                if (showGap) htmlParts.push(`<span><b>Gap:</b> ${gapVal}</span>`);
                if (showTemp) htmlParts.push(`<span><b>Temp:</b> ${tempVal}</span>`);

                box.innerHTML = htmlParts.join('\n');
            } else if (config.category === 'polar') {
                const cols = getChannelColumns(ch);
                let amp1x = cols.amp_1x && row[cols.amp_1x] !== undefined && row[cols.amp_1x] !== null ? `${row[cols.amp_1x].toFixed(3)} ${ampUnit}` : 'N/A';
                let phase1x = cols.phase_1x && row[cols.phase_1x] !== undefined && row[cols.phase_1x] !== null ? `${row[cols.phase_1x].toFixed(1)}${phaseSymbol}` : 'N/A';
                
                const show1X = document.getElementById('show-trend-1x') ? document.getElementById('show-trend-1x').checked : true;

                let htmlParts = [
                    `<span><b>RPM:</b> ${speedText}</span>`
                ];
                if (show1X) {
                    htmlParts.push(`<span><b>Amp:</b> ${amp1x}</span>`);
                    htmlParts.push(`<span><b>Phase:</b> ${phase1x}</span>`);
                }
                box.innerHTML = htmlParts.join('\n');
            } else if (config.category === 'centerline' || config.category === 'centerline_orbit') {
                const cols = getBearingPairColumns(ch);
                const ampUnitX = getChannelUnit(chX, 'amp', 'mils');
                const ampUnitY = getChannelUnit(chY, 'amp', 'mils');
                let xGap = cols.x.gap && row[cols.x.gap] !== undefined && row[cols.x.gap] !== null ? `${row[cols.x.gap].toFixed(2)} ${ampUnitX}` : 'N/A';
                let yGap = cols.y.gap && row[cols.y.gap] !== undefined && row[cols.y.gap] !== null ? `${row[cols.y.gap].toFixed(2)} ${ampUnitY}` : 'N/A';
                
                const showGap = document.getElementById('show-trend-gap') ? document.getElementById('show-trend-gap').checked : true;

                let htmlParts = [
                    `<span><b>RPM:</b> ${speedText}</span>`
                ];
                if (showGap) {
                    htmlParts.push(`<span><b>X Gap:</b> ${xGap}</span>`);
                    htmlParts.push(`<span><b>Y Gap:</b> ${yGap}</span>`);
                }
                box.innerHTML = htmlParts.join('\n');
            } else {
                box.innerHTML = `
                    <span><b>Time:</b> ${t_part.slice(0, 8)}</span>
                    <span><b>RPM:</b> ${speedText}</span>
                `;
            }
        }

        // Layout selection buttons
        function setLayout(layout) {
            currentLayoutRef.current = layout;
            currentLayout = layout;
            setCurrentLayoutState(layout);
            
            document.querySelectorAll('.toolbar-btn').forEach(btn => {
                if (btn.id !== 'btn-time-sync') btn.classList.remove('active');
            });
            
            const btnMap = {
                '1': 'btn-layout-1',
                '2V': 'btn-layout-2v',
                '2H': 'btn-layout-2h',
                '4': 'btn-layout-4',
                '6': 'btn-layout-6',
                '8': 'btn-layout-8'
            };
            const activeBtn = document.getElementById(btnMap[layout]);
            if (activeBtn) activeBtn.classList.add('active');
            
            currentGridPage = 0;
            renderGrid();
            saveWorkspaceConfig();
        }

        function toggleTimeSync() {
            timeSyncCursor = !timeSyncCursor;
            const btn = document.getElementById('btn-time-sync');
            if (timeSyncCursor) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }

        function zoomSlotPlotIn(idx) {
            const container = document.getElementById(`plotly-container-${idx}`);
            if (!container || !container.layout) return;
            const layout = container.layout;
            const update = {};
            
            if (layout.xaxis && layout.xaxis.range) {
                const r = layout.xaxis.range;
                if (typeof r[0] === 'number' && typeof r[1] === 'number') {
                    const center = (r[0] + r[1]) / 2;
                    const halfSpan = (r[1] - r[0]) / 2 * 0.75;
                    update['xaxis.range'] = [center - halfSpan, center + halfSpan];
                }
            }
            if (layout.yaxis && layout.yaxis.range) {
                const r = layout.yaxis.range;
                if (typeof r[0] === 'number' && typeof r[1] === 'number') {
                    const center = (r[0] + r[1]) / 2;
                    const halfSpan = (r[1] - r[0]) / 2 * 0.75;
                    update['yaxis.range'] = [center - halfSpan, center + halfSpan];
                }
            }
            
            if (Object.keys(update).length > 0) {
                Plotly.relayout(container, update);
            }
        }

        function zoomSlotPlotOut(idx) {
            const container = document.getElementById(`plotly-container-${idx}`);
            if (!container || !container.layout) return;
            const layout = container.layout;
            const update = {};
            
            if (layout.xaxis && layout.xaxis.range) {
                const r = layout.xaxis.range;
                if (typeof r[0] === 'number' && typeof r[1] === 'number') {
                    const center = (r[0] + r[1]) / 2;
                    const halfSpan = (r[1] - r[0]) / 2 * 1.35;
                    update['xaxis.range'] = [center - halfSpan, center + halfSpan];
                }
            }
            if (layout.yaxis && layout.yaxis.range) {
                const r = layout.yaxis.range;
                if (typeof r[0] === 'number' && typeof r[1] === 'number') {
                    const center = (r[0] + r[1]) / 2;
                    const halfSpan = (r[1] - r[0]) / 2 * 1.35;
                    update['yaxis.range'] = [center - halfSpan, center + halfSpan];
                }
            }
            
            if (Object.keys(update).length > 0) {
                Plotly.relayout(container, update);
            }
        }

        function saveWorkspaceConfig() {
            try {
                localStorage.setItem('rotordyn_custom_slots', JSON.stringify(plotSlots));
                localStorage.setItem('rotordyn_custom_layout', currentLayoutRef.current);
            } catch (err) {
                console.error("Failed to save workspace config:", err);
            }
        }

        function toggleCustomizeLayoutMode() {
            customizeLayoutMode = !customizeLayoutMode;
            const btn = document.getElementById('btn-customize-layout');
            if (btn) {
                if (customizeLayoutMode) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
            renderGrid();
        }

        function moveSlotLeft(idx) {
            if (idx > 0 && plotSlots[idx]) {
                const temp = plotSlots[idx];
                plotSlots[idx] = plotSlots[idx - 1];
                plotSlots[idx - 1] = temp;
                saveWorkspaceConfig();
                renderGrid();
            }
        }

        function moveSlotRight(idx) {
            if (idx < plotSlots.length - 1 && plotSlots[idx]) {
                const temp = plotSlots[idx];
                plotSlots[idx] = plotSlots[idx + 1];
                plotSlots[idx + 1] = temp;
                saveWorkspaceConfig();
                renderGrid();
            }
        }

        function prevGridPage() {
            if (currentGridPage > 0) {
                currentGridPage--;
                renderGrid();
            }
        }

        function nextGridPage() {
            let pageSize = 1;
            if (currentLayout === '2V' || currentLayout === '2H') pageSize = 2;
            else if (currentLayout === '4') pageSize = 4;
            else if (currentLayout === '6') pageSize = 6;
            else if (currentLayout === '8') pageSize = 8;
            
            const totalSlots = Math.max(plotSlots.length, 1);
            const totalPages = Math.ceil(totalSlots / pageSize);
            
            if (currentGridPage < totalPages - 1) {
                currentGridPage++;
                renderGrid();
            }
        }

        function selectSlot(idx) {
            activeSlotIndex = idx;
            document.querySelectorAll('.grid-card').forEach(card => {
                card.classList.remove('active');
                if (parseInt(card.dataset.index) === idx) {
                    card.classList.add('active');
                }
            });
            syncSidebarTreeHighlights();
        }

        function clearSlot(idx) {
            plotSlots[idx] = null;
            renderGrid();
            saveWorkspaceConfig();
        }

        function toggleAutoScale(idx) {
            if (plotSlots[idx]) {
                const limits = plotSlots[idx].layoutLimits;
                limits.autoScale = !limits.autoScale;
                if (limits.autoScale) {
                    limits.min = null;
                    limits.max = null;
                }
                updateSlotScale(idx);
                saveWorkspaceConfig();
            }
        }

        function setSlotMinLimit(idx, val) {
            if (plotSlots[idx]) {
                plotSlots[idx].layoutLimits.min = val !== '' ? parseFloat(val) : null;
                updateSlotScale(idx);
                saveWorkspaceConfig();
            }
        }

        function setSlotMaxLimit(idx, val) {
            if (plotSlots[idx]) {
                plotSlots[idx].layoutLimits.max = val !== '' ? parseFloat(val) : null;
                updateSlotScale(idx);
                saveWorkspaceConfig();
            }
        }

        function updateSlotScale(idx) {
            const config = plotSlots[idx];
            if (!config) return;
            
            const card = document.querySelector(`.grid-card[data-index="${idx}"]`);
            if (card) {
                const actionsContainer = card.querySelector('.grid-card-actions');
                if (actionsContainer) {
                    actionsContainer.innerHTML = `
                        <button class="grid-card-btn" type="button" onclick="toggleAutoScale(${idx})" title="Toggle Y-Axis Scale">
                            ${config.layoutLimits.autoScale ? 'Auto-scale' : 'Manual-scale'}
                        </button>
                        ${!config.layoutLimits.autoScale ? `
                            <input type="number" step="any" placeholder="Min" class="grid-scale-input" value="${config.layoutLimits.min !== null ? config.layoutLimits.min : ''}" onchange="setSlotMinLimit(${idx}, this.value)" style="width: 50px; height: 18px; padding: 2px; font-size: 0.7rem; border-radius: 3px; border: 1px solid var(--border-color); background-color: var(--card-color); color: var(--text-color);">
                            <input type="number" step="any" placeholder="Max" class="grid-scale-input" value="${config.layoutLimits.max !== null ? config.layoutLimits.max : ''}" onchange="setSlotMaxLimit(${idx}, this.value)" style="width: 50px; height: 18px; padding: 2px; font-size: 0.7rem; border-radius: 3px; border: 1px solid var(--border-color); background-color: var(--card-color); color: var(--text-color);">
                        ` : ''}
                        <button class="grid-card-btn" type="button" onclick="downloadSlotPlot(${idx})" title="Save Plot as Image" style="margin-left: 5px; color: var(--accent-color); font-weight: 500;">💾 Save</button>
                        <button class="grid-card-btn" type="button" onclick="clearSlot(${idx})" title="Close plot" style="color: #ef4444; font-weight: bold; margin-left:5px;">✕</button>
                    `;
                }
            }
            
            const container = document.getElementById(`plotly-container-${idx}`);
            if (!container || !container.layout) return;
            
            const limits = config.layoutLimits;
            const layoutUpdate = {};
            
            if (limits.autoScale) {
                if (config.category === 'trend') {
                    layoutUpdate['yaxis2.autorange'] = true;
                } else if (config.category === 'polar') {
                    if (container.layout.polar) {
                        layoutUpdate['polar.radialaxis.autorange'] = true;
                    }
                } else {
                    layoutUpdate['yaxis.autorange'] = true;
                }
            } else {
                let currentRange = [0, 5.0];
                if (config.category === 'trend' && container.layout.yaxis2 && container.layout.yaxis2.range) {
                    currentRange = container.layout.yaxis2.range;
                } else if (config.category === 'polar' && container.layout.polar && container.layout.polar.radialaxis && container.layout.polar.radialaxis.range) {
                    currentRange = container.layout.polar.radialaxis.range;
                } else if (container.layout.yaxis && container.layout.yaxis.range) {
                    currentRange = container.layout.yaxis.range;
                }
                
                let minVal = limits.min !== null ? limits.min : currentRange[0];
                let maxVal = limits.max !== null ? limits.max : currentRange[1];
                let range = [minVal, maxVal];
                
                if (config.category === 'trend') {
                    layoutUpdate['yaxis2.range'] = range;
                    layoutUpdate['yaxis2.autorange'] = false;
                } else if (config.category === 'polar') {
                    if (container.layout.polar) {
                        layoutUpdate['polar.radialaxis.range'] = [0, maxVal];
                        layoutUpdate['polar.radialaxis.autorange'] = false;
                    }
                } else {
                    layoutUpdate['yaxis.range'] = range;
                    layoutUpdate['yaxis.autorange'] = false;
                }
            }
            
            Plotly.relayout(container, layoutUpdate);
        }

        function getPlotName(category) {
            const names = {
                trend: 'Time Trend Plot',
                polar: 'Polar Plot',
                bode2d: 'Bode Plot (2D)',
                bode3d: 'Bode Plot (3D)',
                centerline: 'Shaft Centerline',
                centerline_orbit: 'Centerline Orbit Overlay',
                orbit: 'Rotor Orbits',
                mode_shape: 'Rotor Deflection Profile',
                spectrum: 'FFT Spectrum',
                cascade: '3D Waterfall Spectrum'
            };
            return names[category] || category;
        }

        // Render CSS grid slots
        function renderGrid() {
            invalidateFilteredDataCache();
            const filteredDf = getFilteredData();
            if (activeCursorIndex >= filteredDf.length) {
                activeCursorIndex = Math.max(0, filteredDf.length - 1);
            }
            
            updateTimelineReadout(activeCursorIndex);
            if (!document.getElementById('timeline-plotly-chart')) {
                renderTimelineWaveformPlot();
            } else {
                updateTimelineRangeUI();
            }

            // Clean up any active ThreeJS WebGL contexts to prevent memory leaks
            window.threeCleanupRegistry = window.threeCleanupRegistry || {};
            Object.keys(window.threeCleanupRegistry).forEach(slotIdx => {
                try {
                    window.threeCleanupRegistry[slotIdx]();
                } catch (e) {
                    console.warn("Error cleaning up ThreeJS context for slot:", slotIdx, e);
                }
                delete window.threeCleanupRegistry[slotIdx];
            });

            const gridEl = document.getElementById('plotly-grid');
            gridEl.innerHTML = '';
            
            let pageSize = 1;
            if (currentLayout === '2V' || currentLayout === '2H') pageSize = 2;
            else if (currentLayout === '4') pageSize = 4;
            else if (currentLayout === '6') pageSize = 6;
            else if (currentLayout === '8') pageSize = 8;
            
            if (currentLayout === '1') {
                gridEl.style.gridTemplateColumns = '1fr';
                gridEl.style.gridTemplateRows = '1fr';
            } else if (currentLayout === '2V') {
                gridEl.style.gridTemplateColumns = '1fr';
                gridEl.style.gridTemplateRows = 'repeat(2, 1fr)';
            } else if (currentLayout === '2H') {
                gridEl.style.gridTemplateColumns = 'repeat(2, 1fr)';
                gridEl.style.gridTemplateRows = '1fr';
            } else if (currentLayout === '4') {
                gridEl.style.gridTemplateColumns = 'repeat(2, 1fr)';
                gridEl.style.gridTemplateRows = 'repeat(2, 1fr)';
            } else if (currentLayout === '6') {
                gridEl.style.gridTemplateColumns = 'repeat(2, 1fr)';
                gridEl.style.gridTemplateRows = 'repeat(3, 1fr)';
            } else if (currentLayout === '8') {
                gridEl.style.gridTemplateColumns = 'repeat(2, 1fr)';
                gridEl.style.gridTemplateRows = 'repeat(4, 1fr)';
            }
            
            const startIndex = currentGridPage * pageSize;
            const endIndex = startIndex + pageSize;
            
            const totalSlots = Math.max(plotSlots.length, 1);
            const totalPages = Math.ceil(totalSlots / pageSize);
            if (currentGridPage >= totalPages) currentGridPage = Math.max(0, totalPages - 1);
            
            document.getElementById('grid-page-indicator').innerText = `Window ${currentGridPage + 1} of ${totalPages || 1}`;
            
            for (let i = startIndex; i < endIndex; i++) {
                const slotCard = document.createElement('div');
                slotCard.className = 'grid-card';
                slotCard.id = `grid-card-${i}`;
                if (i === activeSlotIndex) {
                    slotCard.classList.add('active');
                }
                slotCard.dataset.index = i;
                slotCard.onclick = (e) => {
                    if (e.target.closest('.grid-card-actions') || e.target.closest('.grid-card-btn') || e.target.closest('input')) return;
                    selectSlot(i);
                };
                
                const config = plotSlots[i];
                if (config) {
                    const isOrbit = config.category === 'orbit';
                    const isPolar = config.category === 'polar';
                    if (isOrbit) {
                        if (config.showTimebase === undefined) config.showTimebase = true;
                        if (config.showTrace2 === undefined) config.showTrace2 = false;
                        if (config.cycles === undefined) config.cycles = 8;
                    }
                    if (isPolar) {
                        if (config.polarLabelType === undefined) config.polarLabelType = 'speed';
                    }
                    let titleSuffix = '';
                    if (isPolar) {
                        const angleXInput = document.getElementById('probe-angle-x-input');
                        const angleYInput = document.getElementById('probe-angle-y-input');
                        const probeXAngle = angleXInput ? parseFloat(angleXInput.value) || 135 : 135;
                        const probeYAngle = angleYInput ? parseFloat(angleYInput.value) || 45 : 45;
                        
                        if (config.bearingOrChannel.toUpperCase().endsWith('X') || config.bearingOrChannel.toUpperCase().includes('X')) {
                            const offset = probeXAngle - 90;
                            titleSuffix = ` (∠${Math.abs(offset)}° ${offset >= 0 ? 'Left' : 'Right'})`;
                        } else if (config.bearingOrChannel.toUpperCase().endsWith('Y') || config.bearingOrChannel.toUpperCase().includes('Y')) {
                            const offset = 90 - probeYAngle;
                            titleSuffix = ` (∠${Math.abs(offset)}° ${offset >= 0 ? 'Right' : 'Left'})`;
                        }
                    }
                    slotCard.innerHTML = `
                        <div class="grid-card-header">
                            <span>${cleanPrefixForDisplay(config.bearingOrChannel)} - ${getPlotName(config.category)}${titleSuffix}</span>
                            <div class="grid-card-actions" id="header-actions-${i}">
                                ${isOrbit ? `
                                    <label style="font-size: 0.7rem; color: var(--text-color); display: flex; align-items: center; gap: 3px; cursor: pointer; margin-right: 8px; font-weight: 500;">
                                        <input type="checkbox" onchange="toggleOrbitTimebase(${i}, this.checked)" ${config.showTimebase ? 'checked' : ''} style="margin: 0; cursor: pointer;"> Timebase
                                    </label>
                                    <label style="font-size: 0.7rem; color: var(--text-color); display: ${config.showTimebase ? 'flex' : 'none'}; align-items: center; gap: 3px; cursor: pointer; margin-right: 8px; font-weight: 500;" id="orbit-trace2-label-${i}">
                                        <input type="checkbox" onchange="toggleOrbitTrace2(${i}, this.checked)" ${config.showTrace2 ? 'checked' : ''} style="margin: 0; cursor: pointer;"> Trace 2
                                    </label>
                                    <label style="font-size: 0.7rem; color: var(--text-color); display: ${config.showTimebase ? 'flex' : 'none'}; align-items: center; gap: 3px; margin-right: 8px; font-weight: 500;" id="orbit-cycles-label-${i}">
                                        Cyc: <input type="number" min="1" max="999" value="${config.cycles}" onchange="changeOrbitCycles(${i}, this.value)" style="width: 40px; height: 16px; font-size: 0.7rem; padding: 0 2px; border: 1px solid var(--border-color); background: var(--card-color); color: var(--text-color); border-radius: 3px;">
                                    </label>
                                ` : ''}
                                ${isPolar ? `
                                    <label style="font-size: 0.7rem; color: var(--text-color); display: flex; align-items: center; gap: 5px; cursor: pointer; margin-right: 8px; font-weight: 500;">
                                        Labels:
                                        <select onchange="changePolarLabelType(${i}, this.value)" style="font-size: 0.7rem; padding: 0 2px; border: 1px solid var(--border-color); background: var(--card-color); color: var(--text-color); border-radius: 3px; height: 18px; cursor: pointer; font-weight: 500;">
                                            <option value="speed" ${config.polarLabelType === 'speed' ? 'selected' : ''}>Speed</option>
                                            <option value="time" ${config.polarLabelType === 'time' ? 'selected' : ''}>Time</option>
                                            <option value="none" ${config.polarLabelType === 'none' ? 'selected' : ''}>None</option>
                                        </select>
                                    </label>
                                ` : ''}
                                <button class="grid-card-btn" type="button" onclick="toggleAutoScale(${i})" title="Toggle Y-Axis Scale">
                                    ${config.layoutLimits.autoScale ? 'Auto-scale' : 'Manual-scale'}
                                </button>
                                <button class="grid-card-btn" type="button" onclick="zoomSlotPlotIn(${i})" title="Zoom In" style="margin-left: 2px;">🔍+</button>
                                <button class="grid-card-btn" type="button" onclick="zoomSlotPlotOut(${i})" title="Zoom Out" style="margin-left: 2px;">🔍-</button>
                                ${!config.layoutLimits.autoScale ? `
                                    <input type="number" step="any" placeholder="Min" class="grid-scale-input" value="${config.layoutLimits.min !== null ? config.layoutLimits.min : ''}" onchange="setSlotMinLimit(${i}, this.value)" style="width: 50px; height: 18px; padding: 2px; font-size: 0.7rem; border-radius: 3px; border: 1px solid var(--border-color); background-color: var(--card-color); color: var(--text-color);">
                                    <input type="number" step="any" placeholder="Max" class="grid-scale-input" value="${config.layoutLimits.max !== null ? config.layoutLimits.max : ''}" onchange="setSlotMaxLimit(${i}, this.value)" style="width: 50px; height: 18px; padding: 2px; font-size: 0.7rem; border-radius: 3px; border: 1px solid var(--border-color); background-color: var(--card-color); color: var(--text-color);">
                                ` : ''}
                                <button class="grid-card-btn" type="button" onclick="downloadSlotPlot(${i})" title="Save Plot as Image" style="margin-left: 5px; color: var(--accent-color); font-weight: 500;">💾 Save</button>
                                <button class="grid-card-btn" type="button" onclick="clearSlot(${i})" title="Close plot" style="color: #ef4444; font-weight: bold; margin-left:5px;">✕</button>
                            </div>
                        </div>
                        <div class="plot-telemetry-box-inline" id="plot-telemetry-box-${i}" style="display: none;"></div>
                        <div class="grid-card-body" id="plotly-slot-body-${i}">
                            <div id="plotly-container-${i}" class="chart-container"></div>
                        </div>
                    `;
                    
                    const renderingIndex = i;
                    setTimeout(() => {
                        const targetDiv = document.getElementById(`plotly-container-${renderingIndex}`);
                        if (targetDiv) {
                            try {
                                renderPlotInSlot(renderingIndex, targetDiv, config.bearingOrChannel, config.category);
                            } catch (err) {
                                targetDiv.innerHTML = `<div style="padding: 20px; text-align: center; color: #ef4444; font-size: 0.8rem;">
                                    <h3>Plot construction failed</h3>
                                    <p>${err.message}</p>
                                </div>`;
                            }
                        }
                    }, 0);
                } else {
                    slotCard.innerHTML = `
                        <div class="grid-card-placeholder">
                            <span style="font-size: 1.5rem; margin-bottom: 5px;">📊</span>
                            <p style="font-weight: 600;">Empty Plot Slot ${i + 1}</p>
                            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 5px;">Select this slot, then choose a plot type from the sidebar tree navigation.</p>
                        </div>
                    `;
                }
                
                gridEl.appendChild(slotCard);
            }
            syncSidebarTreeHighlights();
        }

        // Render dispatcher inside a specific slot
        function renderPlotInSlot(slotIdx, container, bearingOrChannel, category) {
            // Purge container if the plot category changes to prevent stale Plotly axis scaling/subplot contamination
            if (container.dataset.plotCategory && container.dataset.plotCategory !== category) {
                try {
                    Plotly.purge(container);
                } catch (e) {
                    console.warn("Failed to purge Plotly container:", e);
                }
            }
            container.dataset.plotCategory = category;

            const filteredDf = getFilteredData();
            if (checkEmptyData(container, filteredDf)) return;
            
            const style = getComputedStyle(document.documentElement);
            const plotBg = style.getPropertyValue('--plot-bg-color').trim() || '#ffffff';
            const paperBg = style.getPropertyValue('--paper-bg-color').trim() || '#ffffff';
            const textColor = style.getPropertyValue('--plot-text-color').trim() || style.getPropertyValue('--text-color').trim() || '#0f172a';
            const gridColor = style.getPropertyValue('--contrast-grid-color').trim() || '#e2e8f0';
            
            const slotConfig = (slotIdx === 'export' ? window.exportPlotConfig : plotSlots[slotIdx]) || { layoutLimits: { min: null, max: null, autoScale: true } };
            const limits = slotConfig.layoutLimits || { min: null, max: null, autoScale: true };
            
            const baseLayout = {
                paper_bgcolor: paperBg,
                plot_bgcolor: plotBg,
                font: { color: textColor, family: 'Outfit, Inter, sans-serif' },
                margin: { t: 45, b: 50, l: 50, r: 40 },
                autosize: true,
                height: container.offsetHeight || container.clientHeight || 300,
                legend: {
                    bgcolor: plotBg,
                    bordercolor: style.getPropertyValue('--border-color').trim(),
                    borderwidth: 1
                },
                xaxis: { gridcolor: gridColor, linecolor: gridColor, zerolinecolor: gridColor },
                yaxis: { gridcolor: gridColor, linecolor: gridColor, zerolinecolor: gridColor }
            };
            
            const clonedLayout = {
                ...baseLayout,
                font: { ...baseLayout.font },
                margin: { ...baseLayout.margin },
                legend: { ...baseLayout.legend },
                xaxis: { ...baseLayout.xaxis },
                yaxis: { ...baseLayout.yaxis }
            };
            
            if (category === 'trend') {
                renderTrendPlotInSlot(slotIdx, container, bearingOrChannel, filteredDf, clonedLayout, limits);
            } else if (category === 'polar') {
                renderPolarPlotInSlot(slotIdx, container, bearingOrChannel, filteredDf, clonedLayout, limits);
            } else if (category === 'bode2d') {
                renderBode2DInSlot(slotIdx, container, bearingOrChannel, filteredDf, clonedLayout, limits);
            } else if (category === 'bode3d') {
                renderBode3DInSlot(slotIdx, container, bearingOrChannel, filteredDf, clonedLayout, limits);
            } else if (category === 'centerline') {
                renderCenterlineInSlot(slotIdx, container, bearingOrChannel, filteredDf, clonedLayout, limits);
            } else if (category === 'centerline_orbit') {
                renderCenterlineOrbitInSlot(slotIdx, container, bearingOrChannel, filteredDf, clonedLayout, limits);
            } else if (category === 'orbit') {
                renderOrbitInSlot(slotIdx, container, bearingOrChannel, filteredDf, clonedLayout, limits);
            } else if (category === 'mode_shape') {
                renderModeShapeInSlot(slotIdx, container, filteredDf, clonedLayout, limits);
            } else if (category === 'spectrum') {
                renderSpectrumInSlot(slotIdx, container, bearingOrChannel, filteredDf, clonedLayout, limits);
            } else if (category === 'cascade') {
                renderCascadePlotInSlot(slotIdx, container, bearingOrChannel, filteredDf, clonedLayout, limits);
            }
        }

        // Shared helpers to parse columns
        function getChannelColumns(ch) {
            const cols = allDatasetColumns.length > 0 ? allDatasetColumns : Object.keys(df[0] || {});
            const findCol = (suffix) => {
                const cleanSuffix = suffix.toLowerCase().replace(/[^a-z0-9]/g, '');
                return cols.find(c => {
                    if (c.toLowerCase().startsWith(ch.toLowerCase() + '_')) {
                        const colSuffix = c.substring(ch.length + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
                        return colSuffix === cleanSuffix;
                    }
                    return false;
                });
            };

            return {
                amp_1x: findCol('1XAmplitude') || findCol('amp_1x') || findCol('1xamp') || findCol('1xamplitude'),
                phase_1x: findCol('1XPhase') || findCol('1X Phase') || findCol('phase_1x') || findCol('1xphase'),
                amp_2x: findCol('2XAmplitude') || findCol('amp_2x') || findCol('2xamp') || findCol('2xamplitude'),
                phase_2x: findCol('2XPhase') || findCol('2X Phase') || findCol('phase_2x') || findCol('2xphase'),
                amp_nx: findCol('nX1Amplitude') || findCol('nX-1Amplitude') || findCol('amp_nx') || findCol('nxamp'),
                phase_nx: findCol('nX1Phase') || findCol('nX-1Phase') || findCol('phase_nx') || findCol('nxphase'),
                direct: findCol('Direct') || findCol('direct'),
                gap: findCol('AvgGap') || findCol('Gap') || findCol('Avg Gap') || findCol('gap'),
                temp: findCol('Temp') || findCol('Temperature') || findCol('temp')
            };
        }

        function getBearingPairColumns(brg) {
            const mapping = bearingPairsMapping && bearingPairsMapping[brg];
            const x_prefix = mapping ? mapping.x : (brg + 'X');
            const y_prefix = mapping ? mapping.y : (brg + 'Y');
            
            return {
                x: getChannelColumns(x_prefix),
                y: getChannelColumns(y_prefix)
            };
        }

        function checkEmptyData(container, filteredDf) {
            if (filteredDf.length === 0) {
                container.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
                    <h3>No Data Available</h3>
                    <p style="margin-top: 10px;">The active filters returned 0 rows. Re-adjust your timeline or state filter parameters.</p>
                </div>`;
                return true;
            }
            return false;
        }

        // Add visual cursor shape and intersection marker
        // Add visual cursor shape and intersection marker
        function addCursorToSlot(slotIdx, traces, layout, localDf) {
            if (localDf.length === 0) return;
            
            const globalDf = getFilteredData();
            const globalRow = globalDf[activeCursorIndex] || globalDf[0];
            if (!globalRow) return;
            const targetTimeMs = globalRow._time_ms;
            
            const localIdx = findClosestRowIndex(localDf, targetTimeMs);
            if (localIdx === -1) return;
            const cursorRow = localDf[localIdx];
            const cursorTime = cursorRow['_date'];
            
            const config = (slotIdx === 'export' ? window.exportPlotConfig : plotSlots[slotIdx]) || {};
            const container = document.getElementById(`plotly-container-${slotIdx}`);
            
            if (!layout.shapes) layout.shapes = [];
            
            // Only add Cursor Line shape for trend and bode2d
            if (config.category === 'trend' || config.category === 'bode2d') {
                let cursorLineX = cursorTime;
                if (config.category === 'bode2d') {
                    cursorLineX = cursorRow[speedCol] !== undefined ? cursorRow[speedCol] : 0;
                }
                layout.shapes.push({
                    type: 'line',
                    name: 'Cursor Line',
                    x0: cursorLineX,
                    x1: cursorLineX,
                    y0: 0,
                    y1: 1,
                    yref: 'paper',
                    line: {
                        color: '#ef4444',
                        width: 1.5,
                        dash: 'dash'
                    }
                });
            }
            
            let cursorY = 0;
            let cursorX = cursorTime;
            
            let markerAxis = 'y';
            if (config.category === 'trend') {
                const cols = getChannelColumns(config.bearingOrChannel);
                const showDirect = document.getElementById('show-trend-direct') ? document.getElementById('show-trend-direct').checked : true;
                const show1X = document.getElementById('show-trend-1x') ? document.getElementById('show-trend-1x').checked : true;
                const show2X = document.getElementById('show-trend-2x') ? document.getElementById('show-trend-2x').checked : true;
                const showGap = document.getElementById('show-trend-gap') ? document.getElementById('show-trend-gap').checked : true;
                const showTemp = document.getElementById('show-trend-temp') ? document.getElementById('show-trend-temp').checked : true;
                
                const hasValueTraces = (showDirect && cols.direct && cursorRow[cols.direct] !== undefined) ||
                                       (show1X && cols.amp_1x && cursorRow[cols.amp_1x] !== undefined) ||
                                       (show2X && cols.amp_2x && cursorRow[cols.amp_2x] !== undefined) ||
                                       (showGap && cols.gap && cursorRow[cols.gap] !== undefined) ||
                                       (showTemp && cols.temp && cursorRow[cols.temp] !== undefined);
                
                if (hasValueTraces) {
                    markerAxis = 'y2';
                    if (cols.amp_1x && cursorRow[cols.amp_1x] !== undefined && show1X) {
                        cursorY = cursorRow[cols.amp_1x];
                    } else if (cols.direct && cursorRow[cols.direct] !== undefined && showDirect) {
                        cursorY = cursorRow[cols.direct];
                    } else if (cols.amp_2x && cursorRow[cols.amp_2x] !== undefined && show2X) {
                        cursorY = cursorRow[cols.amp_2x];
                    } else if (cols.gap && cursorRow[cols.gap] !== undefined && showGap) {
                        cursorY = cursorRow[cols.gap];
                    } else if (cols.temp && cursorRow[cols.temp] !== undefined && showTemp) {
                        cursorY = cursorRow[cols.temp];
                    }
                } else {
                    markerAxis = 'y';
                    if (cols.phase_1x && cursorRow[cols.phase_1x] !== undefined && show1X) {
                        cursorY = cursorRow[cols.phase_1x];
                    } else if (cols.phase_2x && cursorRow[cols.phase_2x] !== undefined && show2X) {
                        cursorY = cursorRow[cols.phase_2x];
                    }
                }
            } else if (config.category === 'polar') {
                const cols = getChannelColumns(config.bearingOrChannel);
                if (container && container.unwrappedPhases && container.plotData) {
                    const cleanIdx = findClosestRowIndex(container.plotData, targetTimeMs);
                    if (cleanIdx !== -1) {
                        cursorX = container.unwrappedPhases[cleanIdx];
                    } else {
                        cursorX = cursorRow[cols.phase_1x] !== undefined ? cursorRow[cols.phase_1x] : 0;
                    }
                } else {
                    cursorX = cursorRow[cols.phase_1x] !== undefined ? cursorRow[cols.phase_1x] : 0;
                }
                cursorY = cursorRow[cols.amp_1x] !== undefined ? cursorRow[cols.amp_1x] : 0;
            } else if (config.category === 'bode2d') {
                const cols = getChannelColumns(config.bearingOrChannel);
                cursorX = cursorRow[speedCol];
                cursorY = cursorRow[cols.amp_1x] !== undefined ? cursorRow[cols.amp_1x] : 0;
            } else if (config.category === 'centerline' || config.category === 'centerline_orbit') {
                const cols = getBearingPairColumns(config.bearingOrChannel);
                const { scaleFactor, restX, restY } = getProbeRestAndScale(config.bearingOrChannel);
                const dx = ((cursorRow[cols.x.gap] || 0) - restX) * scaleFactor;
                const dy = ((cursorRow[cols.y.gap] || 0) - restY) * scaleFactor;
                const pt = convertProbesToPhysical(dx, dy);
                cursorX = pt.x;
                cursorY = pt.y;
            }
            
            const isPolar = config.category === 'polar';
            if (isPolar) {
                // Retrieve probe angle to calculate correct physical rotation angle on screen
                const angleXInput = document.getElementById('probe-angle-x-input');
                const angleYInput = document.getElementById('probe-angle-y-input');
                const probeXAngle = angleXInput ? parseFloat(angleXInput.value) || 135 : 135;
                const probeYAngle = angleYInput ? parseFloat(angleYInput.value) || 45 : 45;
                let probeAngle = 90;
                const ch = config.bearingOrChannel || '';
                if (ch.toUpperCase().endsWith('X') || ch.toUpperCase().includes('X')) {
                    probeAngle = probeXAngle;
                } else if (ch.toUpperCase().endsWith('Y') || ch.toUpperCase().includes('Y')) {
                    probeAngle = probeYAngle;
                }

                const markerAngle = cursorX - probeAngle;

                traces.push({
                    type: 'scatterpolar',
                    r: [0, cursorY],
                    theta: [cursorX, cursorX],
                    mode: 'lines+markers',
                    name: 'Cursor Marker',
                    line: {
                        color: '#ef4444', // Red color
                        width: 1.8
                    },
                    marker: {
                        size: [0, 13], // Hide the center marker, show the arrowhead at the tip
                        color: '#ef4444', // Red color
                        symbol: 'triangle-up',
                        line: { width: 1.5, color: '#ffffff' }, // white border for separation
                        angle: [0, markerAngle]
                    },
                    showlegend: false,
                    hoverinfo: 'skip'
                });
            } else {
                traces.push({
                    type: 'scatter',
                    x: [cursorX],
                    y: [cursorY],
                    xaxis: config.category === 'trend' ? (markerAxis === 'y2' ? 'x2' : 'x') : undefined,
                    yaxis: config.category === 'trend' ? markerAxis : undefined,
                    mode: 'markers',
                    name: 'Cursor Marker',
                    marker: {
                        symbol: 'cross',
                        size: 9,
                        color: '#ef4444',
                        line: { width: 1.5, color: '#ef4444' }
                    },
                    showlegend: false,
                    hoverinfo: 'skip'
                });
            }
        }

        function findClosestRowIndex(dataArray, targetTimeMs) {
            if (!dataArray || dataArray.length === 0) return -1;
            
            let low = 0;
            let high = dataArray.length - 1;
            
            while (low < high - 1) {
                const mid = Math.floor((low + high) / 2);
                const midMs = dataArray[mid]._time_ms || 0;
                if (midMs < targetTimeMs) {
                    low = mid;
                } else {
                    high = mid;
                }
            }
            
            const diffLow = Math.abs((dataArray[low]._time_ms || 0) - targetTimeMs);
            const diffHigh = Math.abs((dataArray[high]._time_ms || 0) - targetTimeMs);
            return diffLow <= diffHigh ? low : high;
        }

        function safePlotlyReact(container, traces, layout, config) {
            if (container && container.removeAllListeners) {
                container.removeAllListeners('plotly_click');
                container.removeAllListeners('plotly_hover');
                container.removeAllListeners('plotly_unhover');
                container.removeAllListeners('plotly_selected');
            } else if (container && container.off) {
                container.off('plotly_click');
                container.off('plotly_hover');
                container.off('plotly_unhover');
                container.off('plotly_selected');
            }
            return Plotly.react(container, traces, layout, config);
        }

        // Timeline Player state variables
        timelineIntervalId = timelineIntervalId || null;
        isTimelinePlaying = isTimelinePlaying !== undefined ? isTimelinePlaying : false;
        timelineStepSize = timelineStepSize || 1;
        timelinePlaybackDelay = timelinePlaybackDelay || 200;
        timelinePlotlyContainer = timelinePlotlyContainer || null;

        function updateStepSize(val) {
            timelineStepSize = parseInt(val);
        }

        function updatePlaybackSpeed(val) {
            timelinePlaybackDelay = parseInt(val);
            if (isTimelinePlaying) {
                clearInterval(timelineIntervalId);
                timelineIntervalId = setInterval(() => {
                    timelineNext();
                }, timelinePlaybackDelay);
            }
        }

        let isDraggingLeft = false;
        let isDraggingRight = false;
        let isDraggingBox = false;
        let isDraggingCursor = false;
        let dragStartX = 0;
        let dragStartLeftPct = 0;
        let dragStartWidthPct = 0;

        function getTimelineData() {
            if (df.length === 0) return [];
            let filtered = df;
            if (activeStateFilter !== 'all') {
                filtered = filtered.filter(r => r['state'] && String(r['state']).toLowerCase() === activeStateFilter.toLowerCase());
            }
            if (activeMinRPM !== null) {
                filtered = filtered.filter(r => (r[speedCol] || 0) >= activeMinRPM);
            }
            if (activeMaxRPM !== null) {
                filtered = filtered.filter(r => (r[speedCol] || 0) <= activeMaxRPM);
            }
            return filtered;
        }

        function updateTimelineRangeUI() {
            const container = document.getElementById('timeline-waveform-container');
            const rangeBox = document.getElementById('timeline-range-box');
            const cursorIndicator = document.getElementById('timeline-cursor-indicator');
            if (!container || !rangeBox || df.length === 0) return;

            const timelineDf = getTimelineData();
            if (timelineDf.length === 0) return;

            const startMs = parseTimestamp(activeStartTime).getTime();
            const endMs = parseTimestamp(activeEndTime).getTime();
            const firstMs = timelineDf[0]._time_ms;
            const lastMs = timelineDf[timelineDf.length - 1]._time_ms;
            const totalMs = lastMs - firstMs;

            if (totalMs <= 0) return;

            // Calculate range percentages
            const startPct = Math.max(0, Math.min(100, ((startMs - firstMs) / totalMs) * 100));
            const endPct = Math.max(0, Math.min(100, ((endMs - firstMs) / totalMs) * 100));
            const widthPct = Math.max(0.5, endPct - startPct);

            rangeBox.style.left = `${startPct}%`;
            rangeBox.style.width = `${widthPct}%`;

            // Calculate cursor indicator percentage
            const filteredDf = getFilteredData();
            if (filteredDf.length > 0 && activeCursorIndex >= 0 && activeCursorIndex < filteredDf.length) {
                const cursorMs = filteredDf[activeCursorIndex]._time_ms;
                const cursorPct = Math.max(0, Math.min(100, ((cursorMs - firstMs) / totalMs) * 100));
                
                if (cursorIndicator) {
                    cursorIndicator.style.display = 'block';
                    cursorIndicator.style.left = `${cursorPct}%`;
                }
            } else {
                if (cursorIndicator) cursorIndicator.style.display = 'none';
            }
        }

        function renderTimelineWaveformPlot() {
            const container = document.getElementById('timeline-waveform-container');
            if (!container || df.length === 0) return;
            
            const timelineDf = getTimelineData();
            if (timelineDf.length === 0) return;
            
            container.innerHTML = `
                <div id="timeline-plotly-chart" style="width: 100%; height: 38px;"></div>
                <div id="timeline-range-selector" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10;">
                    <!-- Draggable highlighted range box -->
                    <div id="timeline-range-box" style="position: absolute; top: 0; height: 100%; border: 2px solid #ef4444; background-color: rgba(239, 68, 68, 0.18); pointer-events: auto; cursor: grab; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box;">
                        <!-- Left drag handle -->
                        <div id="range-handle-left" style="width: 10px; height: 100%; cursor: ew-resize; background-color: #ef4444; opacity: 0.85; border-radius: 1px;"></div>
                        <!-- Right drag handle -->
                        <div id="range-handle-right" style="width: 10px; height: 100%; cursor: ew-resize; background-color: #ef4444; opacity: 0.85; border-radius: 1px;"></div>
                    </div>
                    <!-- Current cursor playback vertical line indicator -->
                    <div id="timeline-cursor-indicator" style="position: absolute; top: 0; width: 2px; height: 100%; background-color: #f59e0b; border: 1px solid #d97706; pointer-events: auto; cursor: col-resize; z-index: 12; box-sizing: border-box; display: none;">
                        <!-- Circular handle at top of yellow cursor line for easier grabbing -->
                        <div style="position: absolute; top: -10px; left: -9px; width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(135deg, #fbbf24, #d97706); border: 2px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,0.35); cursor: col-resize; transition: transform 0.15s ease-in-out; pointer-events: auto;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'"></div>
                    </div>
                </div>
                <!-- Hidden range input for back-compatibility with other scripts -->
                <input type="range" id="global-timeline-slider" style="display: none;">
            `;
            
            timelinePlotlyContainer = document.getElementById('timeline-plotly-chart');
            
            const indices = timelineDf.map((_, i) => i);
            const speeds = timelineDf.map(r => r[speedCol] || 0);
            
            const trace = {
                x: indices,
                y: speeds,
                type: 'scatter',
                mode: 'lines',
                line: {
                    color: '#0ea5e9',
                    width: 1.5
                },
                fill: 'tozeroy',
                fillcolor: 'rgba(14, 165, 233, 0.08)',
                hoverinfo: 'none'
            };
            
            const layout = {
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                margin: { t: 0, b: 0, l: 0, r: 0 },
                xaxis: {
                    visible: false,
                    showgrid: false,
                    zeroline: false,
                    fixedrange: true
                },
                yaxis: {
                    visible: false,
                    showgrid: false,
                    zeroline: false,
                    fixedrange: true
                },
                showlegend: false,
                hovermode: false
            };
            
            safePlotlyReact(timelinePlotlyContainer, [trace], layout, {
                responsive: true,
                displayModeBar: false,
                staticPlot: true
            });
            
            initTimelineDragEvents();
            updateTimelineRangeUI();
        }

        function initTimelineDragEvents() {
            let renderGridPending = false;
            function requestRenderGrid() {
                if (renderGridPending) return;
                renderGridPending = true;
                requestAnimationFrame(() => {
                    renderGrid();
                    renderGridPending = false;
                });
            }

            const container = document.getElementById('timeline-waveform-container');
            const rangeBox = document.getElementById('timeline-range-box');
            const leftHandle = document.getElementById('range-handle-left');
            const rightHandle = document.getElementById('range-handle-right');
            const cursorIndicator = document.getElementById('timeline-cursor-indicator');

            if (!container || !rangeBox || !leftHandle || !rightHandle) return;

            leftHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                isDraggingLeft = true;
                container.style.cursor = 'ew-resize';
            });

            rightHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                isDraggingRight = true;
                container.style.cursor = 'ew-resize';
            });

            cursorIndicator.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                isDraggingCursor = true;
                container.style.cursor = 'col-resize';
            });

            rangeBox.addEventListener('mousedown', (e) => {
                e.preventDefault();
                isDraggingBox = true;
                rangeBox.style.cursor = 'grabbing';
                dragStartX = e.clientX;
                
                const rect = container.getBoundingClientRect();
                const boxRect = rangeBox.getBoundingClientRect();
                dragStartLeftPct = ((boxRect.left - rect.left) / rect.width) * 100;
                dragStartWidthPct = (boxRect.width / rect.width) * 100;
            });

            container.addEventListener('mousedown', (e) => {
                if (isDraggingLeft || isDraggingRight || isDraggingBox || isDraggingCursor) return;
                
                const rect = container.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickPct = clickX / rect.width;
                
                const timelineDf = getTimelineData();
                if (timelineDf.length === 0) return;

                const startMs = parseTimestamp(activeStartTime).getTime();
                const endMs = parseTimestamp(activeEndTime).getTime();
                const firstMs = timelineDf[0]._time_ms;
                const lastMs = timelineDf[timelineDf.length - 1]._time_ms;
                const totalMs = lastMs - firstMs;

                const clickMs = firstMs + clickPct * totalMs;

                if (clickMs >= startMs && clickMs <= endMs) {
                    const filteredDf = getFilteredData();
                    const closestFilteredIdx = findClosestRowIndexByMs(filteredDf, clickMs);
                    if (closestFilteredIdx !== -1) {
                        activeCursorIndex = closestFilteredIdx;
                        timelineSliderInput(activeCursorIndex);
                        
                        isDraggingCursor = true;
                        container.style.cursor = 'col-resize';
                    }
                } else {
                    const durationMs = endMs - startMs;
                    const newStartMs = Math.max(firstMs, Math.min(lastMs - durationMs, clickMs - durationMs / 2));
                    const newEndMs = newStartMs + durationMs;

                    const startIdx = findClosestRowIndexByMs(timelineDf, newStartMs);
                    const endIdx = findClosestRowIndexByMs(timelineDf, newEndMs);

                    if (startIdx !== -1 && endIdx !== -1) {
                        activeStartTime = timelineDf[startIdx][tsCol];
                        activeEndTime = timelineDf[endIdx][tsCol];

                        selectOrAddOption(document.getElementById('filter-start-time'), activeStartTime);
                        selectOrAddOption(document.getElementById('filter-end-time'), activeEndTime);

                        const presetSelect = document.getElementById('filter-time-window');
                        if (presetSelect && presetSelect.value === 'all') {
                            presetSelect.value = 'custom';
                        }

                        activeCursorIndex = 0;
                        renderGrid();
                        updateTimelineRangeUI();
                        
                        isDraggingCursor = true;
                        container.style.cursor = 'col-resize';
                    }
                }
            });

            if (!window.timelineListenersBound) {
                window.addEventListener('mousemove', (e) => {
                    if (!isDraggingLeft && !isDraggingRight && !isDraggingBox && !isDraggingCursor) return;
                    
                    const container = document.getElementById('timeline-waveform-container');
                    const rangeBox = document.getElementById('timeline-range-box');
                    if (!container || !rangeBox) return;
                    
                    const rect = container.getBoundingClientRect();
                    const timelineDf = getTimelineData();
                    if (timelineDf.length === 0) return;

                    const totalMs = timelineDf[timelineDf.length - 1]._time_ms - timelineDf[0]._time_ms;

                    if (isDraggingLeft) {
                        const mouseX = e.clientX - rect.left;
                        let pct = Math.max(0, Math.min(1, mouseX / rect.width));
                        
                        const endMs = parseTimestamp(activeEndTime).getTime();
                        const maxStartMs = endMs - 1000;
                        const targetMs = timelineDf[0]._time_ms + pct * totalMs;
                        const clampedMs = Math.min(targetMs, maxStartMs);
                        
                        const startIdx = findClosestRowIndexByMs(timelineDf, clampedMs);
                        if (startIdx !== -1) {
                            activeStartTime = timelineDf[startIdx][tsCol];
                            selectOrAddOption(document.getElementById('filter-start-time'), activeStartTime);
                            
                            const presetSelect = document.getElementById('filter-time-window');
                            if (presetSelect) presetSelect.value = 'custom';
                            
                            activeCursorIndex = 0;
                            requestRenderGrid();
                            updateTimelineRangeUI();
                        }
                    } else if (isDraggingRight) {
                        const mouseX = e.clientX - rect.left;
                        let pct = Math.max(0, Math.min(1, mouseX / rect.width));
                        
                        const startMs = parseTimestamp(activeStartTime).getTime();
                        const minEndMs = startMs + 1000;
                        const targetMs = timelineDf[0]._time_ms + pct * totalMs;
                        const clampedMs = Math.max(targetMs, minEndMs);
                        
                        const endIdx = findClosestRowIndexByMs(timelineDf, clampedMs);
                        if (endIdx !== -1) {
                            activeEndTime = timelineDf[endIdx][tsCol];
                            selectOrAddOption(document.getElementById('filter-end-time'), activeEndTime);
                            
                            const presetSelect = document.getElementById('filter-time-window');
                            if (presetSelect) presetSelect.value = 'custom';
                            
                            activeCursorIndex = 0;
                            requestRenderGrid();
                            updateTimelineRangeUI();
                        }
                    } else if (isDraggingBox) {
                        const deltaX = e.clientX - dragStartX;
                        const deltaPct = (deltaX / rect.width) * 100;
                        
                        let newLeftPct = dragStartLeftPct + deltaPct;
                        if (newLeftPct < 0) {
                            newLeftPct = 0;
                            dragStartX = e.clientX + (dragStartLeftPct / 100) * rect.width;
                        } else if (newLeftPct > 100 - dragStartWidthPct) {
                            newLeftPct = 100 - dragStartWidthPct;
                            dragStartX = e.clientX - ((100 - dragStartWidthPct - dragStartLeftPct) / 100) * rect.width;
                        }
                        
                        const startMs = timelineDf[0]._time_ms + (newLeftPct / 100) * totalMs;
                        const endMs = startMs + (dragStartWidthPct / 100) * totalMs;
                        
                        const startIdx = findClosestRowIndexByMs(timelineDf, startMs);
                        const endIdx = findClosestRowIndexByMs(timelineDf, endMs);
                        
                        if (startIdx !== -1 && endIdx !== -1) {
                            activeStartTime = timelineDf[startIdx][tsCol];
                            activeEndTime = timelineDf[endIdx][tsCol];
                            
                            selectOrAddOption(document.getElementById('filter-start-time'), activeStartTime);
                            selectOrAddOption(document.getElementById('filter-end-time'), activeEndTime);
                            
                            const presetSelect = document.getElementById('filter-time-window');
                            if (presetSelect && presetSelect.value === 'all') {
                                presetSelect.value = 'custom';
                            }
                            
                            activeCursorIndex = 0;
                            requestRenderGrid();
                            updateTimelineRangeUI();
                        }
                    } else if (isDraggingCursor) {
                        const mouseX = e.clientX - rect.left;
                        let pct = Math.max(0, Math.min(1, mouseX / rect.width));
                        
                        const targetMs = timelineDf[0]._time_ms + pct * totalMs;
                        
                        const startMs = parseTimestamp(activeStartTime).getTime();
                        const endMs = parseTimestamp(activeEndTime).getTime();
                        
                        if (targetMs < startMs || targetMs > endMs) {
                            const durationMs = endMs - startMs;
                            const newStartMs = Math.max(timelineDf[0]._time_ms, Math.min(timelineDf[timelineDf.length - 1]._time_ms - durationMs, targetMs - durationMs / 2));
                            const newEndMs = newStartMs + durationMs;

                            const startIdx = findClosestRowIndexByMs(timelineDf, newStartMs);
                            const endIdx = findClosestRowIndexByMs(timelineDf, newEndMs);

                            if (startIdx !== -1 && endIdx !== -1) {
                                activeStartTime = timelineDf[startIdx][tsCol];
                                activeEndTime = timelineDf[endIdx][tsCol];

                                selectOrAddOption(document.getElementById('filter-start-time'), activeStartTime);
                                selectOrAddOption(document.getElementById('filter-end-time'), activeEndTime);

                                const presetSelect = document.getElementById('filter-time-window');
                                if (presetSelect) presetSelect.value = 'custom';

                                requestRenderGrid();
                                updateTimelineRangeUI();
                            }
                        }

                        const filteredDf = getFilteredData();
                        const closestFilteredIdx = findClosestRowIndexByMs(filteredDf, targetMs);
                        if (closestFilteredIdx !== -1) {
                            activeCursorIndex = closestFilteredIdx;
                            timelineSliderInput(activeCursorIndex);
                        }
                    }
                });

                window.addEventListener('mouseup', () => {
                    isDraggingLeft = false;
                    isDraggingRight = false;
                    isDraggingBox = false;
                    isDraggingCursor = false;
                    
                    const container = document.getElementById('timeline-waveform-container');
                    const rangeBox = document.getElementById('timeline-range-box');
                    const cursorIndicator = document.getElementById('timeline-cursor-indicator');
                    
                    if (container) container.style.cursor = 'pointer';
                    if (rangeBox) rangeBox.style.cursor = 'grab';
                    if (cursorIndicator) cursorIndicator.style.cursor = 'col-resize';
                });
                window.timelineListenersBound = true;
            }
        }

        function updateTimelineCursorLine() {
            updateTimelineRangeUI();
        }

        function updateTimelineReadout(idx) {
            const filteredDf = getFilteredData();
            const row = filteredDf[idx];
            if (!row) {
                document.getElementById('tl-val-time').innerText = '-';
                document.getElementById('tl-val-rpm').innerText = '-';
                document.getElementById('tl-val-state').innerText = '-';
                document.getElementById('tl-val-state').className = 'state-badge';
                document.getElementById('tl-val-index').innerText = '-';
                return;
            }
            
            const ts = row[tsCol] || '-';
            const rawRpm = row[speedCol] !== undefined && row[speedCol] !== null ? parseFloat(row[speedCol]) : NaN;
            const rpm = !isNaN(rawRpm) ? rawRpm.toFixed(0) : '-';
            const state = row['state'] || '-';
            
            const tsStr = ts ? String(ts) : '';
            const t_part = tsStr.split(' ')[1] || tsStr;
            document.getElementById('tl-val-time').innerText = t_part.slice(0, 8);
            document.getElementById('tl-val-rpm').innerText = rpm;
            
            const stateEl = document.getElementById('tl-val-state');
            if (stateEl) {
                stateEl.innerText = state.toUpperCase();
                stateEl.className = 'state-badge ' + state.toLowerCase();
            }
            document.getElementById('tl-val-index').innerText = `${idx + 1} / ${filteredDf.length}`;
        }

        function timelineSliderInput(val) {
            activeCursorIndex = parseInt(val);
            updateTimelineReadout(activeCursorIndex);
            updateTimelineCursorLine();
            updateAllCursorsThrottled();
        }

        function timelineNext() {
            const filteredDf = getFilteredData();
            if (activeCursorIndex < filteredDf.length - 1) {
                activeCursorIndex = Math.min(filteredDf.length - 1, activeCursorIndex + timelineStepSize);
                timelineSliderInput(activeCursorIndex);
            } else if (isTimelinePlaying) {
                activeCursorIndex = 0;
                timelineSliderInput(activeCursorIndex);
            }
        }

        function timelinePrev() {
            if (activeCursorIndex > 0) {
                activeCursorIndex = Math.max(0, activeCursorIndex - timelineStepSize);
                timelineSliderInput(activeCursorIndex);
            }
        }

        function timelineTogglePlay() {
            const playBtn = document.getElementById('tl-btn-play');
            const playIcon = document.getElementById('tl-play-icon');
            const playText = document.getElementById('tl-play-text');
            if (isTimelinePlaying) {
                clearInterval(timelineIntervalId);
                isTimelinePlaying = false;
                if (playBtn) playBtn.classList.remove('playing');
                if (playIcon) playIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
                if (playText) playText.innerText = 'Playback';
            } else {
                isTimelinePlaying = true;
                if (playBtn) playBtn.classList.add('playing');
                if (playIcon) playIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
                if (playText) playText.innerText = 'Pause';
                timelineIntervalId = setInterval(() => {
                    timelineNext();
                }, timelinePlaybackDelay);
            }
        }

        let lastCursorUpdateTime = 0;
        let updateCursorsTimeout = null;

        function updateAllCursorsThrottled() {
            const now = Date.now();
            const minInterval = 60; // Limit cursor sync updates to at most 16 FPS to prevent main thread blocking
            
            if (now - lastCursorUpdateTime >= minInterval) {
                if (updateCursorsTimeout) {
                    clearTimeout(updateCursorsTimeout);
                    updateCursorsTimeout = null;
                }
                lastCursorUpdateTime = now;
                requestAnimationFrame(updateAllCursors);
            } else {
                // Ensure a trailing-edge call is scheduled to capture the final drag position
                if (!updateCursorsTimeout) {
                    updateCursorsTimeout = setTimeout(() => {
                        lastCursorUpdateTime = Date.now();
                        requestAnimationFrame(updateAllCursors);
                        updateCursorsTimeout = null;
                    }, minInterval - (now - lastCursorUpdateTime));
                }
            }
        }

        // Sync cursor line on all plots
        function updateAllCursors() {
            const filteredDf = getFilteredData();
            if (filteredDf.length === 0 || activeCursorIndex < 0 || activeCursorIndex >= filteredDf.length) return;
            
            const row = filteredDf[activeCursorIndex];
            const targetTime = row['_date'];
            const targetTimeMs = row['_time_ms'];
            
            updateTelemetryReadoutForIndex(activeCursorIndex);
            
            // Sync timeline waveform cursor line if play/update occurs
            updateTimelineCursorLine();
            updateTimelineReadout(activeCursorIndex);
            
            const slider = document.getElementById('global-timeline-slider');
            if (slider) slider.value = activeCursorIndex;
            
            plotSlots.forEach((config, idx) => {
                if (!config) return;
                const container = document.getElementById(`plotly-container-${idx}`);
                if (!container || !container.data) return;
                
                if (config.category === 'bode3d') {
                    const traceIdx = container.data.findIndex(t => t.name === 'Cursor Marker');
                    if (traceIdx !== -1 && container.plotData) {
                        const localIdx = findClosestRowIndex(container.plotData, targetTimeMs);
                        if (localIdx !== -1) {
                            const localRow = container.plotData[localIdx];
                            const cols = getChannelColumns(config.bearingOrChannel);
                            const cursorX_3d = localRow[speedCol];
                            const cursorY_3d = localRow[cols.amp_1x] !== undefined ? localRow[cols.amp_1x] : 0;
                            const cursorZ_3d = container.unwrappedPhases && container.unwrappedPhases[localIdx] !== undefined ? container.unwrappedPhases[localIdx] : (localRow[cols.phase_1x] || 0);
                            Plotly.restyle(container, {
                                x: [[cursorX_3d]],
                                y: [[cursorY_3d]],
                                z: [[cursorZ_3d]]
                            }, [traceIdx]);
                        }
                    }
                    updateSlotTelemetryBox(idx, activeCursorIndex);
                    return;
                }
                

                if (config.category === 'mode_shape') {
                    if (container.df_frames) {
                        const localIdx = findClosestRowIndex(container.df_frames, targetTimeMs);
                        if (localIdx !== -1) {
                            if (container.updateThreeScene) {
                                container.updateThreeScene(localIdx);
                            }
                        }
                    }
                    updateSlotTelemetryBox(idx, activeCursorIndex);
                    return;
                }

                if (config.category === 'orbit') {
                    if (container.df_frames) {
                        const localIdx = findClosestRowIndex(container.df_frames, targetTimeMs);
                        if (localIdx !== -1) {
                            const frameName = `f_${localIdx}_slot_${idx}`;
                            Plotly.animate(container, [frameName], {
                                frame: { duration: 0, redraw: true },
                                mode: 'immediate',
                                transition: { duration: 0 }
                            });
                            // Update layout slider active index if sliders are present
                            if (container.layout && container.layout.sliders && container.layout.sliders[0]) {
                                container.layout.sliders[0].active = localIdx;
                                Plotly.relayout(container, { sliders: container.layout.sliders });
                            }
                        }
                    }
                    updateSlotTelemetryBox(idx, activeCursorIndex);
                    return;
                }
                
                const traceIdx = container.data.findIndex(t => t.name === 'Cursor Marker' || t.name === 'Active Vector');
                if (traceIdx === -1) return;
                
                let cursorY = null;
                let cursorX = targetTime;
                
                if (config.category === 'trend') {
                    const cols = getChannelColumns(config.bearingOrChannel);
                    const showDirect = document.getElementById('show-trend-direct') ? document.getElementById('show-trend-direct').checked : true;
                    const show1X = document.getElementById('show-trend-1x') ? document.getElementById('show-trend-1x').checked : true;
                    const show2X = document.getElementById('show-trend-2x') ? document.getElementById('show-trend-2x').checked : true;
                    const showGap = document.getElementById('show-trend-gap') ? document.getElementById('show-trend-gap').checked : true;
                    const showTemp = document.getElementById('show-trend-temp') ? document.getElementById('show-trend-temp').checked : true;
                    
                    const hasValueTraces = (showDirect && cols.direct && row[cols.direct] !== undefined) ||
                                           (show1X && cols.amp_1x && row[cols.amp_1x] !== undefined) ||
                                           (show2X && cols.amp_2x && row[cols.amp_2x] !== undefined) ||
                                           (showGap && cols.gap && row[cols.gap] !== undefined) ||
                                           (showTemp && cols.temp && row[cols.temp] !== undefined);
                    
                    if (hasValueTraces) {
                        if (cols.amp_1x && row[cols.amp_1x] !== undefined && show1X) {
                            cursorY = row[cols.amp_1x];
                        } else if (cols.direct && row[cols.direct] !== undefined && showDirect) {
                            cursorY = row[cols.direct];
                        } else if (cols.amp_2x && row[cols.amp_2x] !== undefined && show2X) {
                            cursorY = row[cols.amp_2x];
                        } else if (cols.gap && row[cols.gap] !== undefined && showGap) {
                            cursorY = row[cols.gap];
                        } else if (cols.temp && row[cols.temp] !== undefined && showTemp) {
                            cursorY = row[cols.temp];
                        }
                    } else {
                        if (cols.phase_1x && row[cols.phase_1x] !== undefined && show1X) {
                            cursorY = row[cols.phase_1x];
                        } else if (cols.phase_2x && row[cols.phase_2x] !== undefined && show2X) {
                            cursorY = row[cols.phase_2x];
                        }
                    }
                } else if (config.category === 'polar') {
                    if (container.plotData) {
                        const localIdx = findClosestRowIndex(container.plotData, targetTimeMs);
                        if (localIdx !== -1) {
                            const localRow = container.plotData[localIdx];
                            const cols = getChannelColumns(config.bearingOrChannel);
                            cursorX = container.unwrappedPhases && container.unwrappedPhases[localIdx] !== undefined ? container.unwrappedPhases[localIdx] : (localRow[cols.phase_1x] || 0);
                            cursorY = localRow[cols.amp_1x] !== undefined ? localRow[cols.amp_1x] : 0;
                        }
                    }
                } else if (config.category === 'bode2d') {
                    if (container.plotData) {
                        const localIdx = findClosestRowIndex(container.plotData, targetTimeMs);
                        if (localIdx !== -1) {
                            const localRow = container.plotData[localIdx];
                            const cols = getChannelColumns(config.bearingOrChannel);
                            cursorX = localRow[speedCol];
                            cursorY = localRow[cols.amp_1x] !== undefined ? localRow[cols.amp_1x] : 0;
                        }
                    }
                } else if (config.category === 'centerline' || config.category === 'centerline_orbit') {
                    if (container.plotData) {
                        const localIdx = findClosestRowIndex(container.plotData, targetTimeMs);
                        if (localIdx !== -1) {
                            const localRow = container.plotData[localIdx];
                            const cols = getBearingPairColumns(config.bearingOrChannel);
                            const { scaleFactor, restX, restY } = getProbeRestAndScale(config.bearingOrChannel);
                            const dx = ((localRow[cols.x.gap] || 0) - restX) * scaleFactor;
                            const dy = ((localRow[cols.y.gap] || 0) - restY) * scaleFactor;
                            const pt = convertProbesToPhysical(dx, dy);
                            cursorX = pt.x;
                            cursorY = pt.y;
                        }
                    }
                }
                
                const isPolar = config.category === 'polar';
                let updateData;
                if (isPolar) {
                    updateData = {
                        r: [[0, cursorY]],
                        theta: [[cursorX, cursorX]]
                    };

                    // Retrieve probe angle
                    const angleXInput = document.getElementById('probe-angle-x-input');
                    const angleYInput = document.getElementById('probe-angle-y-input');
                    const probeXAngle = angleXInput ? parseFloat(angleXInput.value) || 135 : 135;
                    const probeYAngle = angleYInput ? parseFloat(angleYInput.value) || 45 : 45;
                    let probeAngle = 90;
                    const ch = config.bearingOrChannel || '';
                    if (ch.toUpperCase().endsWith('X') || ch.toUpperCase().includes('X')) {
                        probeAngle = probeXAngle;
                    } else if (ch.toUpperCase().endsWith('Y') || ch.toUpperCase().includes('Y')) {
                        probeAngle = probeYAngle;
                    }

                    const markerAngle = cursorX - probeAngle;

                    // Restyle the marker angle along with coordinates
                    Plotly.restyle(container, {
                        'marker.angle': [[0, markerAngle]]
                    }, [traceIdx]);
                } else {
                    updateData = {
                        x: [[cursorX]],
                        y: [[cursorY]]
                    };
                }
                
                const layoutUpdate = {};
                if (container.layout.shapes) {
                    const shapes = [...container.layout.shapes];
                    const lineIdx = shapes.findIndex(s => s.name === 'Cursor Line');
                    if (lineIdx !== -1) {
                        let targetX = targetTime;
                        if (config.category === 'bode2d') {
                            targetX = row[speedCol];
                        }
                        shapes[lineIdx].x0 = targetX;
                        shapes[lineIdx].x1 = targetX;
                        layoutUpdate.shapes = shapes;
                    }
                }
                
                Plotly.restyle(container, updateData, [traceIdx]);
                if (layoutUpdate.shapes) {
                    Plotly.relayout(container, layoutUpdate);
                }
                
                updateSlotTelemetryBox(idx, activeCursorIndex);
            });
        }

        function getGlobalIndexFromPlotPoint(pt, container) {
            if (pt && pt.pointIndex !== undefined && container && container.plotData) {
                const config = plotSlots[parseInt(container.dataset.slotIndex)];
                let row;
                row = container.plotData[pt.pointIndex];
                if (row) {
                    const targetTimeMs = row._time_ms;
                    const filteredDf = getFilteredData();
                    return filteredDf.findIndex(r => r._time_ms === targetTimeMs);
                }
            }
            return -1;
        }

        function handlePlotClick(eventData, container) {
            if (eventData.points && eventData.points.length > 0) {
                const pt = eventData.points[0];
                const globalIdx = getGlobalIndexFromPlotPoint(pt, container);
                if (globalIdx !== -1) {
                    activeCursorIndex = globalIdx;
                    if (timeSyncCursor) {
                        updateAllCursorsThrottled();
                    } else {
                        updateSlotTelemetryBox(parseInt(container.dataset.slotIndex), activeCursorIndex);
                    }
                }
            }
        }

        // Global arrow keys cursor listener
        window.addEventListener('keydown', (e) => {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') {
                return;
            }
            if (e.key === 'ArrowRight') {
                const filteredDf = getFilteredData();
                if (activeCursorIndex < filteredDf.length - 1) {
                    activeCursorIndex = Math.min(filteredDf.length - 1, activeCursorIndex + timelineStepSize);
                    updateAllCursorsThrottled();
                    const slider = document.getElementById('global-timeline-slider');
                    if (slider) slider.value = activeCursorIndex;
                    updateTimelineReadout(activeCursorIndex);
                    e.preventDefault();
                }
            } else if (e.key === 'ArrowLeft') {
                if (activeCursorIndex > 0) {
                    activeCursorIndex = Math.max(0, activeCursorIndex - timelineStepSize);
                    updateAllCursorsThrottled();
                    const slider = document.getElementById('global-timeline-slider');
                    if (slider) slider.value = activeCursorIndex;
                    updateTimelineReadout(activeCursorIndex);
                    e.preventDefault();
                }
            }
        });

        // ── SLOT PLOT BUILDERS ───────────────────────────────────────────────

        function renderTrendPlotInSlot(slotIdx, container, ch, filteredDf, baseLayout, limits) {
            const cols = getChannelColumns(ch);
            const traces = [];
            const x_vals = filteredDf.map(r => r['_date']);
            
            const style = getComputedStyle(document.documentElement);
            const gridColor = style.getPropertyValue('--contrast-grid-color').trim() || '#e2e8f0';
            const borderCol = style.getPropertyValue('--border-color').trim() || '#cbd5e1';
            
            // Read checkboxes
            const showDirect = document.getElementById('show-trend-direct') ? document.getElementById('show-trend-direct').checked : true;
            const show1X = document.getElementById('show-trend-1x') ? document.getElementById('show-trend-1x').checked : true;
            const show2X = document.getElementById('show-trend-2x') ? document.getElementById('show-trend-2x').checked : true;
            const showGap = document.getElementById('show-trend-gap') ? document.getElementById('show-trend-gap').checked : true;
            const showTemp = document.getElementById('show-trend-temp') ? document.getElementById('show-trend-temp').checked : true;

            const hasPhaseTraces = (show1X && cols.phase_1x && filteredDf[0][cols.phase_1x] !== undefined) ||
                                   (show2X && cols.phase_2x && filteredDf[0][cols.phase_2x] !== undefined);
            const hasValueTraces = (showDirect && cols.direct && filteredDf[0][cols.direct] !== undefined) ||
                                   (show1X && cols.amp_1x && filteredDf[0][cols.amp_1x] !== undefined) ||
                                   (show2X && cols.amp_2x && filteredDf[0][cols.amp_2x] !== undefined) ||
                                   (showGap && cols.gap && filteredDf[0][cols.gap] !== undefined) ||
                                   (showTemp && cols.temp && filteredDf[0][cols.temp] !== undefined);

            let phaseDomain = [0.65, 1.0];
            let valueDomain = [0.08, 0.55];
            
            if (hasPhaseTraces && !hasValueTraces) {
                phaseDomain = [0.08, 1.0];
            } else if (!hasPhaseTraces && hasValueTraces) {
                valueDomain = [0.08, 1.0];
            }

            // Subplot 1 (Top): Phase Angle
            if (show1X && cols.phase_1x && filteredDf[0][cols.phase_1x] !== undefined) {
                const raw_phases = filteredDf.map(r => r[cols.phase_1x]);
                const unwrapped_phases = unwrapPhase(raw_phases);
                const tr = {
                    x: x_vals,
                    y: unwrapped_phases,
                    name: '1X Phase',
                    xaxis: 'x',
                    yaxis: 'y',
                    hoverinfo: 'none'
                };
                applyCurveFormatting(tr, 'phase_1x');
                traces.push(tr);
            }
            if (show2X && cols.phase_2x && filteredDf[0][cols.phase_2x] !== undefined) {
                const raw_phases = filteredDf.map(r => r[cols.phase_2x]);
                const unwrapped_phases = unwrapPhase(raw_phases);
                const tr = {
                    x: x_vals,
                    y: unwrapped_phases,
                    name: '2X Phase',
                    xaxis: 'x',
                    yaxis: 'y',
                    hoverinfo: 'none'
                };
                applyCurveFormatting(tr, 'phase_2x');
                traces.push(tr);
            }

            // Subplot 2 (Bottom): Vibration Values
            if (showDirect && cols.direct && filteredDf[0][cols.direct] !== undefined) {
                const tr = {
                    x: x_vals,
                    y: filteredDf.map(r => r[cols.direct]),
                    name: 'Direct',
                    xaxis: 'x2',
                    yaxis: 'y2',
                    hoverinfo: 'none'
                };
                applyCurveFormatting(tr, 'direct');
                traces.push(tr);
            }
            if (show1X && cols.amp_1x && filteredDf[0][cols.amp_1x] !== undefined) {
                const tr = {
                    x: x_vals,
                    y: filteredDf.map(r => r[cols.amp_1x]),
                    name: '1X Amp',
                    xaxis: 'x2',
                    yaxis: 'y2',
                    hoverinfo: 'none'
                };
                applyCurveFormatting(tr, 'amp_1x');
                traces.push(tr);
            }
            if (show2X && cols.amp_2x && filteredDf[0][cols.amp_2x] !== undefined) {
                const tr = {
                    x: x_vals,
                    y: filteredDf.map(r => r[cols.amp_2x]),
                    name: '2X Amp',
                    xaxis: 'x2',
                    yaxis: 'y2',
                    hoverinfo: 'none'
                };
                applyCurveFormatting(tr, 'amp_2x');
                traces.push(tr);
            }
            if (showGap && cols.gap && filteredDf[0][cols.gap] !== undefined) {
                const tr = {
                    x: x_vals,
                    y: filteredDf.map(r => r[cols.gap]),
                    name: 'Avg Gap',
                    xaxis: 'x2',
                    yaxis: 'y3',
                    hoverinfo: 'none'
                };
                applyCurveFormatting(tr, 'gap');
                traces.push(tr);
            }
            if (showTemp && cols.temp && filteredDf[0][cols.temp] !== undefined) {
                const tr = {
                    x: x_vals,
                    y: filteredDf.map(r => r[cols.temp]),
                    name: 'Temp',
                    xaxis: 'x2',
                    yaxis: 'y4',
                    hoverinfo: 'none'
                };
                applyCurveFormatting(tr, 'temp');
                traces.push(tr);
            }

            const layout = { ...baseLayout };
            layout.margin = { t: 45, b: 50, l: 65, r: 55 };
            
            const showIsoLimits = document.getElementById('show-iso-limits') ? document.getElementById('show-iso-limits').checked : false;
            
            if (showIsoLimits && hasValueTraces) {
                layout.shapes = [
                    {
                        type: 'rect',
                        xref: 'x2',
                        yref: 'y2',
                        x0: x_vals[0],
                        x1: x_vals[x_vals.length - 1],
                        y0: 0,
                        y1: 1.1,
                        fillcolor: 'rgba(16, 185, 129, 0.07)',
                        line: { width: 0 },
                        layer: 'below'
                    },
                    {
                        type: 'rect',
                        xref: 'x2',
                        yref: 'y2',
                        x0: x_vals[0],
                        x1: x_vals[x_vals.length - 1],
                        y0: 1.1,
                        y1: 2.8,
                        fillcolor: 'rgba(245, 158, 11, 0.07)',
                        line: { width: 0 },
                        layer: 'below'
                    },
                    {
                        type: 'rect',
                        xref: 'x2',
                        yref: 'y2',
                        x0: x_vals[0],
                        x1: x_vals[x_vals.length - 1],
                        y0: 2.8,
                        y1: 10.0,
                        fillcolor: 'rgba(239, 68, 68, 0.07)',
                        line: { width: 0 },
                        layer: 'below'
                    }
                ];
            }
            
            layout.xaxis = {
                anchor: 'y',
                domain: [0.08, 0.93],
                showticklabels: !hasValueTraces,
                gridcolor: gridColor,
                linecolor: borderCol
            };
            const phaseUnit = getChannelUnit(ch, 'phase', 'deg');
            const ampUnit = getChannelUnit(ch, 'amp', 'mils');
            const tempUnit = getChannelUnit(ch, 'temp', '°C');

            layout.yaxis = {
                title: `Phase Angle (${phaseUnit})`,
                domain: phaseDomain,
                gridcolor: gridColor,
                linecolor: borderCol,
                visible: hasPhaseTraces
            };
            
            layout.xaxis2 = {
                anchor: 'y2',
                domain: [0.08, 0.93],
                matches: 'x',
                showticklabels: true,
                gridcolor: gridColor,
                linecolor: borderCol,
                visible: hasValueTraces
            };
            layout.yaxis2 = {
                title: `Vib (${ampUnit})`,
                domain: valueDomain,
                gridcolor: gridColor,
                linecolor: borderCol,
                visible: hasValueTraces
            };
            layout.yaxis3 = {
                title: `Gap (${ampUnit})`,
                overlaying: 'y2',
                side: 'right',
                gridcolor: 'transparent',
                tickfont: { color: signalFormats.gap.color },
                titlefont: { color: signalFormats.gap.color },
                visible: hasValueTraces && showGap
            };
            layout.yaxis4 = {
                title: `Temp (${tempUnit})`,
                overlaying: 'y2',
                side: 'right',
                position: 0.97,
                gridcolor: 'transparent',
                tickfont: { color: signalFormats.temp.color },
                titlefont: { color: signalFormats.temp.color },
                visible: hasValueTraces && showTemp
            };

            layout.legend = {
                orientation: 'h',
                y: 1.15,
                x: 0.5,
                xanchor: 'center',
                bgcolor: 'rgba(255, 255, 255, 0.0)',
                bordercolor: 'transparent'
            };

            if (!limits.autoScale) {
                let yMin = limits.min !== null ? limits.min : 0.0;
                let yMax = limits.max !== null ? limits.max : 5.0;
                if (hasValueTraces) {
                    layout.yaxis2.range = [yMin, yMax];
                } else if (hasPhaseTraces) {
                    layout.yaxis.range = [yMin, yMax];
                }
            }

            addCursorToSlot(slotIdx, traces, layout, filteredDf);

            container.plotData = filteredDf;
            container.dataset.slotIndex = slotIdx;

            safePlotlyReact(container, traces, layout, { responsive: true, displayModeBar: false });
            
            container.on('plotly_click', (data) => handlePlotClick(data, container));
            container.on('plotly_hover', function(data) {
                if (data.points && data.points.length > 0) {
                    const globalIdx = getGlobalIndexFromPlotPoint(data.points[0], container);
                    if (globalIdx !== -1) {
                        updateSlotTelemetryBox(slotIdx, globalIdx);
                        updateTelemetryReadoutForIndex(globalIdx);
                    }
                }
            });
            container.on('plotly_unhover', function(data) {
                updateSlotTelemetryBox(slotIdx, activeCursorIndex);
                updateTelemetryReadoutForIndex(activeCursorIndex);
            });
            updateSlotTelemetryBox(slotIdx, activeCursorIndex);
        }

        function renderSpectrumInSlot(slotIdx, container, ch, filteredDf, baseLayout, limits) {
            const cols = getChannelColumns(ch);
            const style = getComputedStyle(document.documentElement);
            const accentColor = style.getPropertyValue('--accent-color').trim() || '#2563eb';
            
            const cursorRow = filteredDf[activeCursorIndex] || filteredDf[filteredDf.length - 1];
            if (!cursorRow || checkEmptyData(container, filteredDf)) return;

            const direct = cols.direct && isNumber(cursorRow[cols.direct]) ? cursorRow[cols.direct] : 0.0;
            const amp1x = cols.amp_1x && isNumber(cursorRow[cols.amp_1x]) ? cursorRow[cols.amp_1x] : 0.0;
            const phase1x = cols.phase_1x && isNumber(cursorRow[cols.phase_1x]) ? cursorRow[cols.phase_1x] * Math.PI / 180 : 0.0;
            const amp2x = cols.amp_2x && isNumber(cursorRow[cols.amp_2x]) ? cursorRow[cols.amp_2x] : 0.0;
            const phase2x = cols.phase_2x && isNumber(cursorRow[cols.phase_2x]) ? cursorRow[cols.phase_2x] * Math.PI / 180 : 0.0;
            
            const N = 512;
            const timeSignal = new Float64Array(N);
            
            for (let i = 0; i < N; i++) {
                const t = (2 * Math.PI * i) / 128;
                let val = amp1x * Math.cos(t - phase1x);
                val += amp2x * Math.cos(2 * t - phase2x);
                
                const residual = Math.max(0, direct - (amp1x + amp2x));
                if (residual > 0.05) {
                    val += residual * Math.cos(0.48 * t);
                }
                
                val += 0.02 * (Math.random() - 0.5);
                timeSignal[i] = val;
            }
            
            const windowed = applyHanningWindow(timeSignal);
            const magnitudes = computeFFT(windowed);
            
            const ratio = document.getElementById('gear-ratio-input') ? parseFloat(document.getElementById('gear-ratio-input').value) || 1.0 : 1.0;
            const orders = [];
            const spectrum_mags = [];
            
            for (let i = 0; i < magnitudes.length; i++) {
                const orderVal = (i / 4.0) / ratio;
                if (orderVal > 4.5 / ratio) break;
                orders.push(orderVal);
                spectrum_mags.push(magnitudes[i]);
            }
            
            const tr = {
                x: orders,
                y: spectrum_mags,
                type: 'bar',
                name: 'Vibration Spectrum',
                marker: {
                    color: accentColor,
                    opacity: 0.85
                },
                hoverinfo: 'x+y'
            };
            
            const layout = {
                ...baseLayout,
                showlegend: false,
                xaxis: {
                    title: 'Frequency (Orders of Running Speed)',
                    gridcolor: baseLayout.xaxis.gridcolor,
                    dtick: 0.5,
                    tickformat: '.2f'
                },
                yaxis: {
                    title: `Amplitude (${getChannelUnit(ch, 'amp', 'mils')} pk)`,
                    gridcolor: baseLayout.yaxis.gridcolor
                }
            };
            
            if (!limits.autoScale) {
                if (limits.max !== null) layout.yaxis.range = [0, limits.max];
            }
            
            safePlotlyReact(container, [tr], layout, { responsive: true, displayModeBar: false });
            
            container.on('plotly_hover', function(data) {
                if (data.points && data.points.length > 0) {
                    // Update telemetry box for coordinate readouts
                    updateSlotTelemetryBox(slotIdx, activeCursorIndex);
                }
            });
            updateSlotTelemetryBox(slotIdx, activeCursorIndex);
        }

        function renderCascadePlotInSlot(slotIdx, container, ch, filteredDf, baseLayout, limits) {
            const cols = getChannelColumns(ch);
            const clean_df = filteredDf.filter(r => isNumber(r[speedCol]));
            if (checkEmptyData(container, clean_df)) return;
            
            const numChunks = Math.min(15, clean_df.length);
            if (numChunks < 2) {
                // Not enough data points to build a 3D waterfall
                throw new Error("Waterfall Plot requires a larger range of data points (at least 2 samples).");
            }
            
            // Sort data chronologically to trace speed change
            const df_chrono = [...clean_df].sort((a, b) => a._time_ms - b._time_ms);
            const chunkSize = Math.max(1, Math.floor(df_chrono.length / numChunks));
            
            const traces = [];
            
            for (let c = 0; c < numChunks; c++) {
                const startIndex = c * chunkSize;
                const endIndex = Math.min(df_chrono.length, startIndex + chunkSize);
                const chunkData = df_chrono.slice(startIndex, endIndex);
                if (chunkData.length === 0) continue;
                
                // Calculate average parameters in this chunk
                let sumAmp1X = 0, sumPhase1X = 0, sumAmp2X = 0, sumPhase2X = 0, sumDirect = 0, sumRpm = 0;
                let count = 0;
                
                chunkData.forEach(r => {
                    sumAmp1X += cols.amp_1x && isNumber(r[cols.amp_1x]) ? r[cols.amp_1x] : 0.0;
                    sumPhase1X += cols.phase_1x && isNumber(r[cols.phase_1x]) ? r[cols.phase_1x] : 0.0;
                    sumAmp2X += cols.amp_2x && isNumber(r[cols.amp_2x]) ? r[cols.amp_2x] : 0.0;
                    sumPhase2X += cols.phase_2x && isNumber(r[cols.phase_2x]) ? r[cols.phase_2x] : 0.0;
                    sumDirect += cols.direct && isNumber(r[cols.direct]) ? r[cols.direct] : 0.0;
                    sumRpm += r[speedCol];
                    count++;
                });
                
                const avgAmp1X = sumAmp1X / count;
                const avgPhase1X = (sumPhase1X / count) * Math.PI / 180;
                const avgAmp2X = sumAmp2X / count;
                const avgPhase2X = (sumPhase2X / count) * Math.PI / 180;
                const avgDirect = sumDirect / count;
                const avgRpm = sumRpm / count;
                
                // Synthesize time signal
                const N = 512;
                const timeSignal = new Float64Array(N);
                for (let i = 0; i < N; i++) {
                    const t = (2 * Math.PI * i) / 128; // 4 cycles
                    let val = avgAmp1X * Math.cos(t - avgPhase1X);
                    val += avgAmp2X * Math.cos(2 * t - avgPhase2X);
                    
                    const residual = Math.max(0, avgDirect - (avgAmp1X + avgAmp2X));
                    if (residual > 0.05) {
                        val += residual * Math.cos(0.48 * t);
                    }
                    val += 0.02 * (Math.random() - 0.5);
                    timeSignal[i] = val;
                }
                
                const windowed = applyHanningWindow(timeSignal);
                const magnitudes = computeFFT(windowed);
                
                const ratio = document.getElementById('gear-ratio-input') ? parseFloat(document.getElementById('gear-ratio-input').value) || 1.0 : 1.0;
                const orders = [];
                const spectrum_mags = [];
                for (let i = 0; i < magnitudes.length; i++) {
                    const orderVal = (i / 4.0) / ratio;
                    if (orderVal > 4.5 / ratio) break;
                    orders.push(orderVal);
                    spectrum_mags.push(magnitudes[i]);
                }
                
                // HSL Color gradient from Blue (low RPM) to Magenta (high RPM)
                const minRpm = df_chrono[0][speedCol];
                const maxRpm = df_chrono[df_chrono.length - 1][speedCol];
                const rpmRange = Math.max(100, maxRpm - minRpm);
                const pct = (avgRpm - minRpm) / rpmRange;
                const hue = 220 + Math.min(100, Math.max(0, pct * 100)); // shift from 220 (blue) to 320 (magenta)
                
                const tr = {
                    type: 'scatter3d',
                    mode: 'lines',
                    x: orders,
                    y: Array(orders.length).fill(avgRpm * ratio),
                    z: spectrum_mags,
                    name: `${Math.round(avgRpm * ratio)} RPM`,
                    line: {
                        width: 4,
                        color: `hsl(${hue}, 85%, 50%)`
                    },
                    hoverinfo: 'x+y+z'
                };
                
                traces.push(tr);
            }
            
            const layout = {
                ...baseLayout,
                showlegend: false,
                scene: {
                    xaxis: {
                        title: 'Frequency (Orders)',
                        gridcolor: baseLayout.xaxis.gridcolor,
                        dtick: 1.0,
                        zeroline: false
                    },
                    yaxis: {
                        title: 'Speed (RPM)',
                        gridcolor: baseLayout.xaxis.gridcolor,
                        zeroline: false
                    },
                    zaxis: {
                        title: `Amp (${getChannelUnit(ch, 'amp', 'mils')} pk)`,
                        gridcolor: baseLayout.yaxis.gridcolor,
                        zeroline: false
                    },
                    camera: {
                        eye: { x: 1.5, y: -1.8, z: 1.3 } // standard dynamic 3D viewpoint angle
                    }
                }
            };
            
            safePlotlyReact(container, traces, layout, { responsive: true, displayModeBar: false });
            updateSlotTelemetryBox(slotIdx, activeCursorIndex);
        }

        function renderPolarPlotInSlot(slotIdx, container, ch, filteredDf, baseLayout, limits) {
            const cols = getChannelColumns(ch);
            if (!cols.amp_1x || !cols.phase_1x) {
                throw new Error("Polar Plot requires Amplitude and Phase columns.");
            }
            const clean_df = filteredDf.filter(r => isNumber(r[cols.amp_1x]) && isNumber(r[cols.phase_1x]));
            if (checkEmptyData(container, clean_df)) return;
            
            const amps = clean_df.map(r => r[cols.amp_1x]);
            const phases = unwrapPhase(clean_df.map(r => r[cols.phase_1x]));
            const ratio = document.getElementById('gear-ratio-input') ? parseFloat(document.getElementById('gear-ratio-input').value) || 1.0 : 1.0;
            const speeds = clean_df.map(r => r[speedCol] * ratio);
            
            const style = getComputedStyle(document.documentElement);
            const plotBg = style.getPropertyValue('--plot-bg-color').trim();
            const borderCol = style.getPropertyValue('--border-color').trim();
            
            const trace = {
                type: 'scatterpolar',
                r: amps,
                theta: phases,
                hoverinfo: 'none',
                marker: {
                    color: speeds,
                    colorscale: 'Viridis',
                    showscale: true,
                    colorbar: {
                        title: 'RPM',
                        thickness: 10,
                        x: 1.02,
                        tickfont: { color: baseLayout.font.color }
                    }
                }
            };
            applyCurveFormatting(trace, 'amp_1x');
            
            const slotConfig = (slotIdx === 'export' ? window.exportPlotConfig : plotSlots[slotIdx]) || { polarLabelType: 'speed' };
            const labelType = slotConfig.polarLabelType || 'speed';
            
            const labelIndices = [];
            if (labelType !== 'none' && clean_df.length > 0) {
                const rMax = amps.length > 0 ? Math.max(...amps) : 1.0;
                // Use 8% of max amplitude for clear physical separation on 2D space (collision prevention)
                const minAllowedDistance = rMax * 0.08; 
                
                labelIndices.push(0); // Always label the first point
                
                for (let i = 1; i < clean_df.length; i++) {
                    const r2 = amps[i];
                    const t2 = phases[i] * Math.PI / 180;
                    const x2 = r2 * Math.cos(t2);
                    const y2 = r2 * Math.sin(t2);
                    
                    let tooClose = false;
                    for (const idx of labelIndices) {
                        const r1 = amps[idx];
                        const t1 = phases[idx] * Math.PI / 180;
                        const x1 = r1 * Math.cos(t1);
                        const y1 = r1 * Math.sin(t1);
                        
                        const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                        if (dist < minAllowedDistance) {
                            tooClose = true;
                            break;
                        }
                    }
                    
                    if (!tooClose) {
                        labelIndices.push(i);
                    }
                }
            }

            const traces = [trace];

            if (labelType !== 'none' && labelIndices.length > 0) {
                const labelTexts = labelIndices.map(idx => {
                    if (labelType === 'speed') {
                        return `${speeds[idx].toFixed(0)}`;
                    } else if (labelType === 'time') {
                        const ts = clean_df[idx][tsCol];
                        const tsStr = ts ? String(ts) : '';
                        const t_part = tsStr.split(' ')[1] || tsStr;
                        return t_part.slice(0, 8);
                    }
                    return '';
                });

                // Dynamically offset labels outward based on quadrant angle
                const textpositions = labelIndices.map(idx => {
                    const angle = (phases[idx] % 360 + 360) % 360;
                    if (angle >= 0 && angle < 90) return 'top right';
                    if (angle >= 90 && angle < 180) return 'bottom right';
                    if (angle >= 180 && angle < 270) return 'bottom left';
                    return 'top left';
                });

                const labelTrace = {
                    type: 'scatterpolar',
                    r: labelIndices.map(idx => amps[idx]),
                    theta: labelIndices.map(idx => phases[idx]),
                    mode: 'markers+text',
                    text: labelTexts,
                    textposition: textpositions,
                    hoverinfo: 'skip',
                    marker: {
                        size: 6,
                        color: labelIndices.map(idx => speeds[idx]),
                        colorscale: 'Viridis',
                        showscale: false,
                        line: {
                            color: '#ffffff',
                            width: 1.5
                        }
                    },
                    textfont: {
                        size: 9,
                        color: baseLayout.font.color || '#000000',
                        family: 'Arial, sans-serif',
                        weight: 'bold'
                    }
                };
                traces.push(labelTrace);
            }
            
            const angleXInput = document.getElementById('probe-angle-x-input');
            const angleYInput = document.getElementById('probe-angle-y-input');
            const probeXAngle = angleXInput ? parseFloat(angleXInput.value) || 135 : 135;
                const probeYAngle = angleYInput ? parseFloat(angleYInput.value) || 45 : 45;

            let probeAngle = 90;
            if (ch.toUpperCase().endsWith('X') || ch.toUpperCase().includes('X')) {
                probeAngle = probeXAngle;
            } else if (ch.toUpperCase().endsWith('Y') || ch.toUpperCase().includes('Y')) {
                probeAngle = probeYAngle;
            }

            // Add ADRE Sxp concentric rotation direction arc arrow outside outer circular boundary (top-left quadrant)
            const maxAmp = amps.length > 0 ? Math.max(...amps) : 1.0;
            let currentRMax = maxAmp * 1.1;
            if (!limits.autoScale && limits.max !== null) {
                currentRMax = limits.max;
            }

            const layout = { ...baseLayout };
            layout.margin = { t: 45, b: 65, l: 45, r: 75 };
            const ampUnit = getChannelUnit(ch, 'amp', 'mils');
            
            // Format full scale text e.g., "2.60 mil pp FULL SCALE"
            const displayUnit = ampUnit === 'mils' ? 'mil pp' : ampUnit;
            const fullScaleText = `${currentRMax.toFixed(2)} ${displayUnit} FULL SCALE`;

            layout.polar = {
                bgcolor: plotBg,
                domain: { x: [0.12, 0.88], y: [0.12, 0.88] }, // symmetric domain centered at 0.50
                angularaxis: {
                    direction: 'clockwise',
                    period: 360,
                    rotation: probeAngle,
                    gridcolor: baseLayout.xaxis.gridcolor,
                    linecolor: borderCol,
                    tickfont: { color: baseLayout.font.color }
                },
                radialaxis: {
                    angle: probeAngle,
                    gridcolor: baseLayout.xaxis.gridcolor,
                    linecolor: borderCol,
                    showticklabels: false,
                    ticks: ''
                }
            };

            // Force radial axis range so circular boundary size matches currentRMax exactly
            let rMin = (!limits.autoScale && limits.min !== null) ? limits.min : 0.0;
            layout.polar.radialaxis.range = [rMin, currentRMax];

            // Calculate screen dimensions of the container to render a perfect concentric arc outside the circular boundary
            const rect = container.getBoundingClientRect();
            const width = rect.width || 400;
            const height = rect.height || 300;

            const domainSize = 0.76; // width and height of the domain is 0.76 (from 0.12 to 0.88)
            const circleRadiusPx = Math.min(width * domainSize, height * domainSize) / 2;

            const paperCenterX = 0.50;
            const paperCenterY = 0.50;
            
            // Draw arc concentric at 1.18 times the radius (sitting cleanly outside the tick labels)
            const paperRx = (circleRadiusPx * 1.18) / width;
            const paperRy = (circleRadiusPx * 1.18) / height;

            // Generate path using short line segments (L) to ensure 100% compatibility with Plotly shape parser
            let arcPath = '';
            const steps = 12;
            for (let i = 0; i <= steps; i++) {
                const angle = (165 - (i / steps) * 60) * Math.PI / 180; // Sweeping clockwise from 165 to 105 degrees
                const x = paperCenterX + paperRx * Math.cos(angle);
                const y = paperCenterY + paperRy * Math.sin(angle);
                if (i === 0) {
                    arcPath += `M ${x.toFixed(4)} ${y.toFixed(4)}`;
                } else {
                    arcPath += ` L ${x.toFixed(4)} ${y.toFixed(4)}`;
                }
            }

            const angleEnd = 105 * Math.PI / 180;
            const xEnd = paperCenterX + paperRx * Math.cos(angleEnd);
            const yEnd = paperCenterY + paperRy * Math.sin(angleEnd);

            // Tangent direction at the end point (pointing clockwise)
            const tangentAngle = angleEnd - Math.PI / 2; // 15 degrees
            const arrowLength = 9; // pixels
            const arrowLenX = arrowLength / width;
            const arrowLenY = arrowLength / height;

            const xWing1 = xEnd + arrowLenX * Math.cos(tangentAngle + 150 * Math.PI / 180);
            const yWing1 = yEnd - arrowLenY * Math.sin(tangentAngle + 150 * Math.PI / 180); // Invert y-offset to compensate for Plotly's vertical rendering flip
            const xWing2 = xEnd + arrowLenX * Math.cos(tangentAngle - 150 * Math.PI / 180);
            const yWing2 = yEnd - arrowLenY * Math.sin(tangentAngle - 150 * Math.PI / 180); // Invert y-offset to compensate for Plotly's vertical rendering flip

            const arrowheadPath = `M ${xEnd.toFixed(4)} ${yEnd.toFixed(4)} L ${xWing1.toFixed(4)} ${yWing1.toFixed(4)} L ${xWing2.toFixed(4)} ${yWing2.toFixed(4)} Z`;

            const scaleX = 0.94; // X position for the vertical scale bar in paper coordinates
            const scaleYStart = 0.50; // Y center (0 scale)
            const scaleYEnd = 0.88; // Y top (Full Scale)
            const scaleHeight = scaleYEnd - scaleYStart;

            layout.shapes = [
                // ADRE concentric direction arc line
                {
                    type: 'path',
                    xref: 'paper',
                    yref: 'paper',
                    path: arcPath,
                    fillcolor: 'rgba(0,0,0,0)', // Use standard transparent rgba instead of none to prevent rendering failure
                    line: { color: borderCol, width: 1.2 }
                },
                // ADRE concentric direction arrowhead
                {
                    type: 'path',
                    xref: 'paper',
                    yref: 'paper',
                    path: arrowheadPath,
                    fillcolor: borderCol, // Blend with the grid border color
                    line: { color: borderCol, width: 0.8 }
                },
                // Vertical scale line
                {
                    type: 'line',
                    xref: 'paper',
                    yref: 'paper',
                    x0: scaleX,
                    y0: scaleYStart,
                    x1: scaleX,
                    y1: scaleYEnd,
                    line: { color: borderCol, width: 1.5 }
                },
                // Bottom tick (0%)
                {
                    type: 'line',
                    xref: 'paper',
                    yref: 'paper',
                    x0: scaleX,
                    y0: scaleYStart,
                    x1: scaleX + 0.015,
                    y1: scaleYStart,
                    line: { color: borderCol, width: 1.5 }
                },
                // 25% tick
                {
                    type: 'line',
                    xref: 'paper',
                    yref: 'paper',
                    x0: scaleX,
                    y0: scaleYStart + scaleHeight * 0.25,
                    x1: scaleX + 0.01,
                    y1: scaleYStart + scaleHeight * 0.25,
                    line: { color: borderCol, width: 1.2 }
                },
                // 50% tick
                {
                    type: 'line',
                    xref: 'paper',
                    yref: 'paper',
                    x0: scaleX,
                    y0: scaleYStart + scaleHeight * 0.50,
                    x1: scaleX + 0.012,
                    y1: scaleYStart + scaleHeight * 0.50,
                    line: { color: borderCol, width: 1.2 }
                },
                // 75% tick
                {
                    type: 'line',
                    xref: 'paper',
                    yref: 'paper',
                    x0: scaleX,
                    y0: scaleYStart + scaleHeight * 0.75,
                    x1: scaleX + 0.01,
                    y1: scaleYStart + scaleHeight * 0.75,
                    line: { color: borderCol, width: 1.2 }
                },
                // Top tick (100%)
                {
                    type: 'line',
                    xref: 'paper',
                    yref: 'paper',
                    x0: scaleX,
                    y0: scaleYEnd,
                    x1: scaleX + 0.015,
                    y1: scaleYEnd,
                    line: { color: borderCol, width: 1.5 }
                }
            ];

            layout.annotations = [
                ...(baseLayout.annotations || []),
                // Bottom-right: Rotation Direction label
                {
                    text: 'CW ROTATION',
                    showarrow: false,
                    xref: 'paper',
                    yref: 'paper',
                    x: 0.98,
                    y: 0.02,
                    xanchor: 'right',
                    yanchor: 'bottom',
                    font: {
                        size: 9,
                        color: baseLayout.font.color || '#64748b',
                        weight: 'bold',
                        family: 'Arial, sans-serif'
                    }
                },
                // Bottom-left: Full Scale label (exact ADRE replica)
                {
                    text: fullScaleText,
                    showarrow: false,
                    xref: 'paper',
                    yref: 'paper',
                    x: 0.02,
                    y: 0.02,
                    xanchor: 'left',
                    yanchor: 'bottom',
                    font: {
                        size: 9.5,
                        color: baseLayout.font.color || '#475569',
                        weight: 'bold',
                        family: 'Arial, sans-serif'
                    }
                },
                // Scale Bar: Unit Label at the top
                {
                    text: `<b>${displayUnit}</b>`,
                    showarrow: false,
                    xref: 'paper',
                    yref: 'paper',
                    x: scaleX,
                    y: scaleYEnd + 0.03,
                    xanchor: 'center',
                    yanchor: 'bottom',
                    font: {
                        size: 9,
                        color: baseLayout.font.color || '#475569',
                        weight: 'bold',
                        family: 'Arial, sans-serif'
                    }
                },
                // Scale Bar: Top Value
                {
                    text: `${currentRMax.toFixed(2)}`,
                    showarrow: false,
                    xref: 'paper',
                    yref: 'paper',
                    x: scaleX - 0.01,
                    y: scaleYEnd,
                    xanchor: 'right',
                    yanchor: 'middle',
                    font: {
                        size: 9,
                        color: baseLayout.font.color || '#475569',
                        family: 'Arial, sans-serif'
                    }
                },
                // Scale Bar: Bottom Value (0)
                {
                    text: '0',
                    showarrow: false,
                    xref: 'paper',
                    yref: 'paper',
                    x: scaleX - 0.01,
                    y: scaleYStart,
                    xanchor: 'right',
                    yanchor: 'middle',
                    font: {
                        size: 9,
                        color: baseLayout.font.color || '#475569',
                        family: 'Arial, sans-serif'
                    }
                }
            ];
            
            if (!limits.autoScale) {
                let rMin = limits.min !== null ? limits.min : 0.0;
                let rMax = limits.max !== null ? limits.max : (amps.length > 0 ? Math.max(...amps) * 1.1 : 5.0);
                layout.polar.radialaxis.range = [rMin, rMax];
            }
            
            container.plotData = clean_df;
            container.unwrappedPhases = phases;
            container.dataset.slotIndex = slotIdx;
            container.unwrappedPhases = phases;
            container.dataset.slotIndex = slotIdx;

            addCursorToSlot(slotIdx, traces, layout, clean_df);

            safePlotlyReact(container, traces, layout, { responsive: true, displayModeBar: false });
            
            container.on('plotly_click', (data) => handlePlotClick(data, container));
            container.on('plotly_hover', function(data) {
                if (data.points && data.points.length > 0) {
                    const globalIdx = getGlobalIndexFromPlotPoint(data.points[0], container);
                    if (globalIdx !== -1) {
                        updateSlotTelemetryBox(slotIdx, globalIdx);
                        updateTelemetryReadoutForIndex(globalIdx);
                    }
                }
            });
            container.on('plotly_unhover', function(data) {
                updateSlotTelemetryBox(slotIdx, activeCursorIndex);
                updateTelemetryReadoutForIndex(activeCursorIndex);
            });
            updateSlotTelemetryBox(slotIdx, activeCursorIndex);
        }

        function renderBode2DInSlot(slotIdx, container, ch, filteredDf, baseLayout, limits) {
            const cols = getChannelColumns(ch);
            if (!cols.amp_1x || !cols.phase_1x) {
                throw new Error("2D Bode Plot requires Amplitude and Phase columns.");
            }
            console.log("renderBode2DInSlot DEBUG: ch=" + ch + " cols.amp_1x=" + cols.amp_1x + " cols.phase_1x=" + cols.phase_1x + " speedCol=" + speedCol + " filteredDf.length=" + filteredDf.length);
            if (filteredDf.length > 0) {
                const firstRow = filteredDf[0];
                console.log("renderBode2DInSlot DEBUG values: amp_1x=" + firstRow[cols.amp_1x] + " (type " + typeof firstRow[cols.amp_1x] + "), phase_1x=" + firstRow[cols.phase_1x] + " (type " + typeof firstRow[cols.phase_1x] + "), speedCol=" + firstRow[speedCol] + " (type " + typeof firstRow[speedCol] + ")");
            }
            const clean_df = filteredDf.filter(r => isNumber(r[cols.amp_1x]) && isNumber(r[cols.phase_1x]) && isNumber(r[speedCol])).sort((a,b) => a._time_ms - b._time_ms);
            console.log("renderBode2DInSlot DEBUG final clean_df.length=" + clean_df.length);
            if (checkEmptyData(container, clean_df)) return;
            
            const ratio = document.getElementById('gear-ratio-input') ? parseFloat(document.getElementById('gear-ratio-input').value) || 1.0 : 1.0;
            const speeds = clean_df.map(r => r[speedCol] * ratio);
            const style = getComputedStyle(document.documentElement);
            const gridColor = style.getPropertyValue('--contrast-grid-color').trim();
            const borderCol = style.getPropertyValue('--border-color').trim();
            
            const trace_amp1x = {
                x: speeds,
                y: clean_df.map(r => r[cols.amp_1x]),
                name: '1X Amp',
                xaxis: 'x2', yaxis: 'y2',
                hoverinfo: 'none'
            };
            applyCurveFormatting(trace_amp1x, 'amp_1x');
            
            const raw_phases = clean_df.map(r => r[cols.phase_1x]);
            const unwrapped_phases = unwrapPhase(raw_phases);
            
            const trace_phase1x = {
                x: speeds,
                y: unwrapped_phases,
                name: '1X Phase',
                xaxis: 'x', yaxis: 'y',
                hoverinfo: 'none'
            };
            applyCurveFormatting(trace_phase1x, 'phase_1x');
            
            const ampUnit = getChannelUnit(ch, 'amp', 'mils');
            const speedUnit = getChannelUnit(ch, 'speed', 'RPM');
            const phaseUnit = getChannelUnit(ch, 'phase', 'deg');

            const layout = { ...baseLayout };
            layout.margin = { t: 45, b: 50, l: 55, r: 40 };

            // Add critical speed vertical highlight lines & annotations
            if (window.sensorCriticalSpeeds && window.sensorCriticalSpeeds[ch]) {
                layout.shapes = layout.shapes || [];
                window.sensorCriticalSpeeds[ch].forEach(peak => {
                    layout.shapes.push({
                        type: 'line',
                        x0: peak.rpm,
                        x1: peak.rpm,
                        y0: 0.08,
                        y1: 0.45,
                        yref: 'paper',
                        line: { color: 'rgba(239, 68, 68, 0.45)', width: 1.5, dash: 'dash' }
                    });
                    layout.shapes.push({
                        type: 'line',
                        x0: peak.rpm,
                        x1: peak.rpm,
                        y0: 0.55,
                        y1: 1.0,
                        yref: 'paper',
                        line: { color: 'rgba(239, 68, 68, 0.45)', width: 1.5, dash: 'dash' }
                    });
                    
                    layout.annotations = layout.annotations || [];
                    layout.annotations.push({
                        x: peak.rpm,
                        y: 0.42,
                        yref: 'paper',
                        text: `${peak.rpm} RPM`,
                        showarrow: false,
                        font: { size: 9, color: '#ef4444', weight: 'bold' },
                        bgcolor: 'rgba(241, 245, 249, 0.9)',
                        bordercolor: '#ef4444',
                        borderwidth: 0.5,
                        borderpad: 2
                    });
                });
            }
            
            let minSpeedVal = Math.min(...speeds);
            let maxSpeedVal = Math.max(...speeds);
            if (minSpeedVal === maxSpeedVal || isNaN(minSpeedVal) || isNaN(maxSpeedVal)) {
                minSpeedVal = (minSpeedVal || 0) - 100;
                maxSpeedVal = (maxSpeedVal || 0) + 100;
            }

            layout.xaxis = {
                anchor: 'y',
                domain: [0, 1],
                showticklabels: false,
                gridcolor: gridColor,
                linecolor: borderCol,
                range: [minSpeedVal, maxSpeedVal]
            };
            layout.yaxis = {
                title: `Phase (${phaseUnit})`,
                domain: [0.55, 1.0],
                gridcolor: gridColor,
                linecolor: borderCol
            };
            
            layout.xaxis2 = {
                anchor: 'y2',
                domain: [0, 1],
                matches: 'x',
                showticklabels: true,
                title: `Speed (${speedUnit})`,
                gridcolor: gridColor,
                linecolor: borderCol,
                range: [minSpeedVal, maxSpeedVal]
            };
            layout.yaxis2 = {
                title: `Amp (${ampUnit})`,
                domain: [0.08, 0.45],
                gridcolor: gridColor,
                linecolor: borderCol
            };
            
            if (!limits.autoScale) {
                let yMin = limits.min !== null ? limits.min : 0.0;
                let yMax = limits.max !== null ? limits.max : 5.0;
                layout.yaxis2.range = [yMin, yMax];
            }
            
            const traces = [trace_amp1x, trace_phase1x];
            addCursorToSlot(slotIdx, traces, layout, clean_df);
            
            container.plotData = clean_df;
            container.dataset.slotIndex = slotIdx;

            safePlotlyReact(container, traces, layout, { responsive: true, displayModeBar: false });
            
            container.on('plotly_click', (data) => handlePlotClick(data, container));
            container.on('plotly_hover', function(data) {
                if (data.points && data.points.length > 0) {
                    const globalIdx = getGlobalIndexFromPlotPoint(data.points[0], container);
                    if (globalIdx !== -1) {
                        updateSlotTelemetryBox(slotIdx, globalIdx);
                        updateTelemetryReadoutForIndex(globalIdx);
                    }
                }
            });
            container.on('plotly_unhover', function(data) {
                updateSlotTelemetryBox(slotIdx, activeCursorIndex);
                updateTelemetryReadoutForIndex(activeCursorIndex);
            });
            updateSlotTelemetryBox(slotIdx, activeCursorIndex);
        }

        function renderBode3DInSlot(slotIdx, container, ch, filteredDf, baseLayout, limits) {
            const cols = getChannelColumns(ch);
            if (!cols.amp_1x || !cols.phase_1x) {
                throw new Error("3D Bode Plot requires Amplitude and Phase columns.");
            }
            const clean_df = filteredDf.filter(r => isNumber(r[cols.amp_1x]) && isNumber(r[cols.phase_1x]) && isNumber(r[speedCol]));
            if (checkEmptyData(container, clean_df)) return;
            
            const ratio = document.getElementById('gear-ratio-input') ? parseFloat(document.getElementById('gear-ratio-input').value) || 1.0 : 1.0;
            const speeds = clean_df.map(r => r[speedCol] * ratio);
            const amps = clean_df.map(r => r[cols.amp_1x]);
            const phases = unwrapPhase(clean_df.map(r => r[cols.phase_1x]));
            
            const trace = {
                type: 'scatter3d',
                mode: 'lines+markers',
                x: speeds,
                y: amps,
                z: phases,
                hoverinfo: 'none',
                line: { color: signalFormats.amp_1x.color, width: 3 },
                marker: {
                    size: 2,
                    color: speeds,
                    colorscale: 'Viridis'
                }
            };
            
            const speedUnit = getChannelUnit(ch, 'speed', 'RPM');
            const ampUnit = getChannelUnit(ch, 'amp', 'mils');
            const phaseUnit = getChannelUnit(ch, 'phase', 'deg');

            const layout = { ...baseLayout };
            layout.margin = { t: 45, b: 20, l: 20, r: 20 };
            layout.scene = {
                bgcolor: baseLayout.plot_bgcolor,
                xaxis: { title: `Speed (${speedUnit})`, gridcolor: baseLayout.xaxis.gridcolor, tickfont: { color: baseLayout.font.color } },
                yaxis: { title: `Amp (${ampUnit})`, gridcolor: baseLayout.yaxis.gridcolor, tickfont: { color: baseLayout.font.color } },
                zaxis: { title: `Phase (${phaseUnit})`, gridcolor: baseLayout.yaxis.gridcolor, tickfont: { color: baseLayout.font.color } },
                camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } }
            };
            
            if (!limits.autoScale) {
                let yMin = limits.min !== null ? limits.min : 0.0;
                let yMax = limits.max !== null ? limits.max : 5.0;
                layout.scene.yaxis.range = [yMin, yMax];
            }
            
            const cursorTrace = {
                type: 'scatter3d',
                mode: 'markers',
                x: [speeds[0] || 0],
                y: [amps[0] || 0],
                z: [phases[0] || 0],
                marker: {
                    symbol: 'diamond',
                    size: 8,
                    color: '#ef4444'
                },
                name: 'Cursor Marker',
                showlegend: false,
                hoverinfo: 'skip'
            };

            const traces = [trace, cursorTrace];
            
            container.plotData = clean_df;
            container.unwrappedPhases = phases;
            container.dataset.slotIndex = slotIdx;

            safePlotlyReact(container, traces, layout, { responsive: true, displayModeBar: false });

            container.on('plotly_click', (data) => handlePlotClick(data, container));
            container.on('plotly_hover', function(data) {
                if (data.points && data.points.length > 0) {
                    const globalIdx = getGlobalIndexFromPlotPoint(data.points[0], container);
                    if (globalIdx !== -1) {
                        updateSlotTelemetryBox(slotIdx, globalIdx);
                        updateTelemetryReadoutForIndex(globalIdx);
                    }
                }
            });
            container.on('plotly_unhover', function(data) {
                updateSlotTelemetryBox(slotIdx, activeCursorIndex);
                updateTelemetryReadoutForIndex(activeCursorIndex);
            });
            updateSlotTelemetryBox(slotIdx, activeCursorIndex);
        }

        function renderCenterlineInSlot(slotIdx, container, brg, filteredDf, baseLayout, limits) {
            const cols = getBearingPairColumns(brg);
            if (!cols.x.gap || !cols.y.gap) {
                throw new Error("Shaft Centerline requires AvgGap columns.");
            }
            const clean_df = filteredDf.filter(r => isNumber(r[cols.x.gap]) && isNumber(r[cols.y.gap])).sort((a,b) => a._time_ms - b._time_ms);
            if (checkEmptyData(container, clean_df)) return;
            
            const C = window.bearingClearance || 12.0; 
            const x_gap_raw = clean_df.map(r => r[cols.x.gap]);
            const y_gap_raw = clean_df.map(r => r[cols.y.gap]);
            const ratio = document.getElementById('gear-ratio-input') ? parseFloat(document.getElementById('gear-ratio-input').value) || 1.0 : 1.0;
            const speeds = clean_df.map(r => r[speedCol] * ratio);
            
            const { scaleFactor, restX, restY } = getProbeRestAndScale(brg);
            
            const x_vals = [];
            const y_vals = [];
            for (let i = 0; i < clean_df.length; i++) {
                const dx = (x_gap_raw[i] - restX) * scaleFactor;
                const dy = (y_gap_raw[i] - restY) * scaleFactor;
                const pt = convertProbesToPhysical(dx, dy);
                x_vals.push(pt.x);
                y_vals.push(pt.y);
            }
            
            const trace = {
                x: x_vals,
                y: y_vals,
                mode: 'lines+markers',
                hoverinfo: 'none',
                line: { color: signalFormats.direct.color, width: 2 },
                marker: {
                    size: 4,
                    color: speeds,
                    colorscale: 'Viridis',
                    showscale: true,
                    colorbar: { title: 'RPM', thickness: 10, x: 1.02, tickfont: { color: baseLayout.font.color } }
                }
            };
            
            const clearance_r = C;
            const theta = Array.from({length: 100}, (_, i) => i * 2 * Math.PI / 99);
            const bx = theta.map(t => clearance_r * Math.cos(t));
            const by = theta.map(t => C + clearance_r * Math.sin(t));
            
            const trace_clearance = {
                x: bx,
                y: by,
                mode: 'lines',
                name: 'Clearance Boundary',
                hoverinfo: 'skip',
                line: { color: '#ef4444', width: 1, dash: 'dash' }
            };
            
            const parts = brg.split('/');
            const brgX = parts[0];
            const ampUnit = getChannelUnit(brgX, 'amp', 'mils');
 
            const layout = { ...baseLayout };
            layout.margin = { t: 45, b: 50, l: 50, r: 75 };
            layout.xaxis.title = `Physical Horizontal Position (${ampUnit})`;
            layout.yaxis.title = `Physical Vertical Position (${ampUnit})`;
            layout.yaxis.scaleanchor = 'x';
            layout.yaxis.scaleratio = 1;
            
            layout.xaxis.range = [-(C * 1.25), C * 1.25];
            layout.yaxis.range = [-(C * 0.25), C * 2.25];
            
            if (!limits.autoScale) {
                let limitMax = C * 1.25;
                if (limits.max !== null) limitMax = Math.abs(limits.max);
                else if (limits.min !== null) limitMax = Math.abs(limits.min);
                layout.xaxis.range = [-limitMax, limitMax];
                layout.yaxis.range = [C - limitMax, C + limitMax];
            }
            
            const traces = [trace, trace_clearance];
            addCursorToSlot(slotIdx, traces, layout, clean_df);
            
            container.plotData = clean_df;
            container.dataset.slotIndex = slotIdx;

            safePlotlyReact(container, traces, layout, { responsive: true, displayModeBar: false });
            
            container.on('plotly_click', (data) => handlePlotClick(data, container));
            container.on('plotly_hover', function(data) {
                if (data.points && data.points.length > 0) {
                    const globalIdx = getGlobalIndexFromPlotPoint(data.points[0], container);
                    if (globalIdx !== -1) {
                        updateSlotTelemetryBox(slotIdx, globalIdx);
                        updateTelemetryReadoutForIndex(globalIdx);
                    }
                }
            });
            container.on('plotly_unhover', function(data) {
                updateSlotTelemetryBox(slotIdx, activeCursorIndex);
                updateTelemetryReadoutForIndex(activeCursorIndex);
            });
            updateSlotTelemetryBox(slotIdx, activeCursorIndex);
        }

        function renderCenterlineOrbitInSlot(slotIdx, container, brg, filteredDf, baseLayout, limits) {
            const cols = getBearingPairColumns(brg);
            if (!cols.x.gap || !cols.y.gap || !cols.x.amp_1x || !cols.y.amp_1x || !cols.x.phase_1x || !cols.y.phase_1x) {
                throw new Error("Overlay requires Gap, Amplitude, and Phase columns.");
            }
            const clean_df = filteredDf.filter(r => isNumber(r[cols.x.gap]) && isNumber(r[cols.y.gap]) && isNumber(r[speedCol])).sort((a,b) => a._time_ms - b._time_ms);
            if (checkEmptyData(container, clean_df)) return;
            
            const C = window.bearingClearance || 12.0;
            const x_gap_raw = clean_df.map(r => r[cols.x.gap]);
            const y_gap_raw = clean_df.map(r => r[cols.y.gap]);
            const ratio = document.getElementById('gear-ratio-input') ? parseFloat(document.getElementById('gear-ratio-input').value) || 1.0 : 1.0;
            const speeds = clean_df.map(r => r[speedCol] * ratio);
            
            const { scaleFactor, restX, restY } = getProbeRestAndScale(brg);
            
            const cl_x = [];
            const cl_y = [];
            for (let i = 0; i < clean_df.length; i++) {
                const dx = (x_gap_raw[i] - restX) * scaleFactor;
                const dy = (y_gap_raw[i] - restY) * scaleFactor;
                const pt = convertProbesToPhysical(dx, dy);
                cl_x.push(pt.x);
                cl_y.push(pt.y);
            }
            
            const traces = [];
            traces.push({
                x: cl_x,
                y: cl_y,
                mode: 'lines',
                name: 'Centerline Path',
                line: { color: signalFormats.direct.color, width: 2 },
                hoverinfo: 'none'
            });
            
            const max_rpm = Math.max(...clean_df.map(r => r[speedCol]));
            const target_rpms = [500, 1500, 2500, 3000];
            const active_targets = target_rpms.filter(r => r < max_rpm);
            active_targets.push(max_rpm);
            
            const theta = Array.from({length: 64}, (_, i) => i * 2 * Math.PI / 63);
            const orbitColors = ['#f43f5e', '#fb923c', '#10b981', '#38bdf8', '#a855f7'];
            
            active_targets.forEach((target_rpm, i) => {
                let closest_row = clean_df[0];
                let min_diff = Math.abs(closest_row[speedCol] - target_rpm);
                clean_df.forEach(row => {
                    let diff = Math.abs(row[speedCol] - target_rpm);
                    if (diff < min_diff) {
                        min_diff = diff;
                        closest_row = row;
                    }
                });
                
                const gx = closest_row[cols.x.gap];
                const gy = closest_row[cols.y.gap];
                const ax = closest_row[cols.x.amp_1x];
                const ay = closest_row[cols.y.amp_1x];
                const px = closest_row[cols.x.phase_1x] * Math.PI / 180;
                const py = closest_row[cols.y.phase_1x] * Math.PI / 180;
                const speed = closest_row[speedCol];
                
                const dx_row = (gx - restX) * scaleFactor;
                const dy_row = (gy - restY) * scaleFactor;
                const pt_row = convertProbesToPhysical(dx_row, dy_row);
                const gx_phys = pt_row.x;
                const gy_phys = pt_row.y;
                
                const ox = theta.map(t => {
                    const pt_orb = convertProbesToPhysical(ax * Math.cos(t - px), ay * Math.sin(t - py));
                    return gx_phys + pt_orb.x;
                });
                const oy = theta.map(t => {
                    const pt_orb = convertProbesToPhysical(ax * Math.cos(t - px), ay * Math.sin(t - py));
                    return gy_phys + pt_orb.y;
                });
                
                traces.push({
                    x: ox, y: oy,
                    mode: 'lines',
                    name: `1X Orbit @ ${speed.toFixed(0)} RPM`,
                    line: { color: orbitColors[i % orbitColors.length], width: 1.5 },
                    hoverinfo: 'none'
                });
            });
            
            const clearance_r = C;
            const cx = theta.map(t => clearance_r * Math.cos(t));
            const cy = theta.map(t => C + clearance_r * Math.sin(t));
            
            traces.push({
                x: cx, y: cy,
                mode: 'lines',
                name: 'Clearance Boundary',
                line: { color: '#ef4444', width: 1, dash: 'dash' },
                hoverinfo: 'skip'
            });
            
            const parts = brg.split('/');
            const brgX = parts[0];
            const ampUnit = getChannelUnit(brgX, 'amp', 'mils');
 
            const layout = { ...baseLayout };
            layout.margin = { t: 45, b: 50, l: 50, r: 75 };
            layout.xaxis.title = `Physical Horizontal Position (${ampUnit})`;
            layout.yaxis.title = `Physical Vertical Position (${ampUnit})`;
            layout.yaxis.scaleanchor = 'x';
            layout.yaxis.scaleratio = 1;
            
            layout.xaxis.range = [-(C * 1.25), C * 1.25];
            layout.yaxis.range = [-(C * 0.25), C * 2.25];
            
            if (!limits.autoScale) {
                let limitMax = C * 1.25;
                if (limits.max !== null) limitMax = Math.abs(limits.max);
                else if (limits.min !== null) limitMax = Math.abs(limits.min);
                layout.xaxis.range = [-limitMax, limitMax];
                layout.yaxis.range = [C - limitMax, C + limitMax];
            }
            
            addCursorToSlot(slotIdx, traces, layout, clean_df);
            
            container.plotData = clean_df;
            container.dataset.slotIndex = slotIdx;

            safePlotlyReact(container, traces, layout, { responsive: true, displayModeBar: false });
            
            container.on('plotly_click', (data) => handlePlotClick(data, container));
            container.on('plotly_hover', function(data) {
                if (data.points && data.points.length > 0) {
                    const globalIdx = getGlobalIndexFromPlotPoint(data.points[0], container);
                    if (globalIdx !== -1) {
                        updateSlotTelemetryBox(slotIdx, globalIdx);
                        updateTelemetryReadoutForIndex(globalIdx);
                    }
                }
            });
            container.on('plotly_unhover', function(data) {
                updateSlotTelemetryBox(slotIdx, activeCursorIndex);
                updateTelemetryReadoutForIndex(activeCursorIndex);
            });
            updateSlotTelemetryBox(slotIdx, activeCursorIndex);
        }

        function renderOrbitInSlot(slotIdx, container, brg, filteredDf, baseLayout, limits) {
            const config = (slotIdx === 'export' ? window.exportPlotConfig : plotSlots[slotIdx]) || {};
            const isOrbit = config.category === 'orbit';
            const showTimebase = isOrbit && config.showTimebase !== false;
            const showTrace2 = showTimebase && config.showTrace2 === true;
            const cycles = (isOrbit && config.cycles) ? config.cycles : 8;

            const style = getComputedStyle(document.documentElement);
            const cols = getBearingPairColumns(brg);
            if (!cols.x.amp_1x || !cols.y.amp_1x || !cols.x.phase_1x || !cols.y.phase_1x) {
                throw new Error("Orbit Plot requires Amplitude and Phase columns.");
            }
            
            const clean_df = filteredDf.filter(r => isNumber(r[cols.x.amp_1x]) && isNumber(r[cols.y.amp_1x]) && isNumber(r[cols.x.phase_1x]) && isNumber(r[cols.y.phase_1x]) && isNumber(r[speedCol]));
            if (checkEmptyData(container, clean_df)) return;
            
            const df_chrono = [...clean_df].sort((a,b) => a._time_ms - b._time_ms);
            let df_frames = df_chrono.filter((_, i) => i % Math.max(1, Math.floor(df_chrono.length / 50)) === 0);
            
            const C = window.bearingClearance || 12.0;
            const boundary_r = C;
            
            let maxVal = 0.1;
            clean_df.forEach(row => {
                const ax = Math.abs(row[cols.x.amp_1x]) || 0;
                const ay = Math.abs(row[cols.y.amp_1x]) || 0;
                if (ax > maxVal) maxVal = ax;
                if (ay > maxVal) maxVal = ay;
            });
            
            const limit = maxVal * 1.4;
            let finalLimit = limit;
            if (!limits.autoScale) {
                if (limits.max !== null) finalLimit = Math.abs(limits.max);
                else if (limits.min !== null) finalLimit = Math.abs(limits.min);
            }

            const layout = { ...baseLayout };
            layout.showlegend = false;

            if (!showTimebase) {
                layout.grid = { rows: 1, columns: 1 };
                layout.xaxis = {
                    title: `Horiz. Displ. (${getChannelUnit(brg.split('/')[0], 'amp', 'mils')})`,
                    gridcolor: baseLayout.xaxis.gridcolor
                };
                layout.yaxis = {
                    title: `Vert. Displ. (${getChannelUnit(brg.split('/')[0], 'amp', 'mils')})`,
                    gridcolor: baseLayout.yaxis.gridcolor,
                    scaleanchor: 'x', scaleratio: 1
                };
                if (!limits.autoScale) {
                    layout.xaxis.range = [-finalLimit, finalLimit];
                    layout.yaxis.range = [-finalLimit, finalLimit];
                }
            } else if (!showTrace2) {
                layout.grid = { rows: 1, columns: 2, pattern: 'independent' };
                layout.column_widths = [0.45, 0.55];
                layout.xaxis = {
                    title: `Horiz. Displ. (${getChannelUnit(brg.split('/')[0], 'amp', 'mils')})`,
                    gridcolor: baseLayout.xaxis.gridcolor,
                    domain: [0, 0.43]
                };
                layout.yaxis = {
                    title: `Vert. Displ. (${getChannelUnit(brg.split('/')[0], 'amp', 'mils')})`,
                    gridcolor: baseLayout.yaxis.gridcolor,
                    scaleanchor: 'x', scaleratio: 1,
                    domain: [0, 1.0]
                };
                layout.xaxis2 = {
                    title: 'Rotational Cycles',
                    gridcolor: baseLayout.xaxis.gridcolor, range: [0, cycles],
                    domain: [0.55, 1.0]
                };
                layout.yaxis2 = {
                    title: `Displacement (${getChannelUnit(brg.split('/')[0], 'amp', 'mils')})`,
                    gridcolor: baseLayout.yaxis.gridcolor
                };
                if (!limits.autoScale) {
                    layout.xaxis.range = [-finalLimit, finalLimit];
                    layout.yaxis.range = [-finalLimit, finalLimit];
                    layout.yaxis2.range = [-finalLimit, finalLimit];
                }
            } else {
                layout.grid = { rows: 1, columns: 3, pattern: 'independent' };
                layout.column_widths = [0.34, 0.33, 0.33];
                layout.xaxis = {
                    title: `Horiz. Displ. (${getChannelUnit(brg.split('/')[0], 'amp', 'mils')})`,
                    gridcolor: baseLayout.xaxis.gridcolor,
                    domain: [0, 0.30]
                };
                layout.yaxis = {
                    title: `Vert. Displ. (${getChannelUnit(brg.split('/')[0], 'amp', 'mils')})`,
                    gridcolor: baseLayout.yaxis.gridcolor,
                    scaleanchor: 'x', scaleratio: 1,
                    domain: [0, 1.0]
                };
                layout.xaxis2 = {
                    title: 'Rotational Cycles (X)',
                    gridcolor: baseLayout.xaxis.gridcolor, range: [0, cycles],
                    domain: [0.38, 0.66]
                };
                layout.yaxis2 = {
                    title: `Displacement (${getChannelUnit(brg.split('/')[0], 'amp', 'mils')})`,
                    gridcolor: baseLayout.yaxis.gridcolor
                };
                layout.xaxis3 = {
                    title: 'Rotational Cycles (Y)',
                    gridcolor: baseLayout.xaxis.gridcolor, range: [0, cycles],
                    domain: [0.72, 1.0]
                };
                layout.yaxis3 = {
                    title: `Displacement (${getChannelUnit(brg.split('/')[0], 'amp', 'mils')})`,
                    gridcolor: baseLayout.yaxis.gridcolor
                };
                if (!limits.autoScale) {
                    layout.xaxis.range = [-finalLimit, finalLimit];
                    layout.yaxis.range = [-finalLimit, finalLimit];
                    layout.yaxis2.range = [-finalLimit, finalLimit];
                    layout.yaxis3.range = [-finalLimit, finalLimit];
                }
            }

            if (!limits.autoScale) {
                // Custom probe shapes and annotations
                layout.shapes = [
                    // X Probe body (grey cylinder)
                    {
                        type: 'rect', xref: 'x', yref: 'y',
                        x0: boundary_r * 1.05, y0: -boundary_r * 0.08,
                        x1: boundary_r * 1.35, y1: boundary_r * 0.08,
                        fillcolor: '#64748b', line: { color: '#475569', width: 1 }
                    },
                    // X Probe tip (gold)
                    {
                        type: 'rect', xref: 'x', yref: 'y',
                        x0: boundary_r * 1.01, y0: -boundary_r * 0.05,
                        x1: boundary_r * 1.05, y1: boundary_r * 0.05,
                        fillcolor: '#eab308', line: { color: '#ca8a04', width: 1 }
                    },
                    // Y Probe body (grey cylinder)
                    {
                        type: 'rect', xref: 'x', yref: 'y',
                        x0: -boundary_r * 0.08, y0: boundary_r * 1.05,
                        x1: boundary_r * 0.08, y1: boundary_r * 1.35,
                        fillcolor: '#64748b', line: { color: '#475569', width: 1 }
                    },
                    // Y Probe tip (gold)
                    {
                        type: 'rect', xref: 'x', yref: 'y',
                        x0: -boundary_r * 0.05, y0: boundary_r * 1.01,
                        x1: boundary_r * 0.05, y1: boundary_r * 1.05,
                        fillcolor: '#eab308', line: { color: '#ca8a04', width: 1 }
                    }
                ];

                layout.annotations = [
                    {
                        x: boundary_r * 1.45, y: 0, xref: 'x', yref: 'y',
                        text: '<b>X Probe</b>', showarrow: false,
                        font: { size: 9, color: 'var(--text-color)' }
                    },
                    {
                        x: 0, y: boundary_r * 1.45, xref: 'x', yref: 'y',
                        text: '<b>Y Probe</b>', showarrow: false,
                        font: { size: 9, color: 'var(--text-color)' }
                    }
                ];
            } else {
                layout.shapes = [];
                layout.annotations = [];
            }

            const first_row = df_frames[0];
            const theta = Array.from({length: 64}, (_, i) => i * 2 * Math.PI / 63);
            
            const ax_i = first_row[cols.x.amp_1x];
            const ay_i = first_row[cols.y.amp_1x];
            const px_i = first_row[cols.x.phase_1x] * Math.PI / 180;
            const py_i = first_row[cols.y.phase_1x] * Math.PI / 180;
            
            const x_init = theta.map(t => convertProbesToPhysical(ax_i * Math.cos(t - px_i), ay_i * Math.sin(t - py_i)).x);
            const y_init = theta.map(t => convertProbesToPhysical(ax_i * Math.cos(t - px_i), ay_i * Math.sin(t - py_i)).y);

            // Timebase waveforms
            const tb_steps = 100 * cycles;
            const theta_tb = Array.from({length: tb_steps}, (_, i) => (i / (tb_steps - 1)) * cycles * 2 * Math.PI);
            const tb_x_init_val = theta_tb.map(t => convertProbesToPhysical(ax_i * Math.cos(t - px_i), 0).x);
            const tb_x_init_time = theta_tb.map(t => t / (2 * Math.PI));
            const tb_y_init_val = theta_tb.map(t => convertProbesToPhysical(0, ay_i * Math.cos(t - py_i)).y);
            const tb_y_init_time = tb_x_init_time;

            // Keyphasor dots (once per cycle)
            const kp_times = Array.from({length: cycles}, (_, i) => i);
            const pt_kp_init = convertProbesToPhysical(ax_i * Math.cos(-px_i), ay_i * Math.sin(-py_i));
            const kp_x_init_val = Array.from({length: cycles}, () => convertProbesToPhysical(ax_i * Math.cos(-px_i), 0).x);
            const kp_y_init_val = Array.from({length: cycles}, () => convertProbesToPhysical(0, ay_i * Math.cos(-py_i)).y);

            const traces = [];

            // Trace 0: Orbit Path
            traces.push({
                x: x_init, y: y_init, mode: 'lines+markers', name: '1X Orbit',
                line: { color: '#f43f5e', width: 2.5 },
                marker: { size: 3, color: '#fb7185' }, hoverinfo: 'none',
                xaxis: 'x', yaxis: 'y'
            });

            // Trace 1: Clearance Boundary (only plotted for manual limits)
            if (!limits.autoScale) {
                traces.push({
                    x: theta.map(t => boundary_r * Math.cos(t)),
                    y: theta.map(t => boundary_r * Math.sin(t)),
                    mode: 'lines', name: 'Clearance Boundary',
                    line: { color: '#ef4444', width: 1, dash: 'dash' },
                    hoverinfo: 'skip', xaxis: 'x', yaxis: 'y'
                });
            } else {
                traces.push({
                    x: [], y: [], mode: 'lines', showlegend: false, hoverinfo: 'skip', xaxis: 'x', yaxis: 'y'
                });
            }

            // Trace 2: Keyphasor Dot on Orbit
            traces.push({
                x: [pt_kp_init.x],
                y: [pt_kp_init.y],
                mode: 'markers', name: 'Keyphasor Dot',
                marker: { size: 8, color: '#f59e0b', symbol: 'circle' },
                hoverinfo: 'none', xaxis: 'x', yaxis: 'y'
            });

            if (showTimebase) {
                // Trace 3: X Timebase waveform
                traces.push({
                    x: tb_x_init_time, y: tb_x_init_val, mode: 'lines', name: 'X Waveform',
                    line: { color: '#0ea5e9', width: 2 }, hoverinfo: 'none',
                    xaxis: 'x2', yaxis: 'y2'
                });

                // Trace 4: Keyphasor Dots on X Timebase
                traces.push({
                    x: kp_times, y: kp_x_init_val, mode: 'markers', name: 'KP Dots X',
                    marker: { size: 7, color: '#f59e0b', symbol: 'circle' }, hoverinfo: 'none',
                    xaxis: 'x2', yaxis: 'y2'
                });

                if (showTrace2) {
                    // Trace 5: Y Timebase waveform
                    traces.push({
                        x: tb_y_init_time, y: tb_y_init_val, mode: 'lines', name: 'Y Waveform',
                        line: { color: '#10b981', width: 2 }, hoverinfo: 'none',
                        xaxis: 'x3', yaxis: 'y3'
                    });

                    // Trace 6: Keyphasor Dots on Y Timebase
                    traces.push({
                        x: kp_times, y: kp_y_init_val, mode: 'markers', name: 'KP Dots Y',
                        marker: { size: 7, color: '#f59e0b', symbol: 'circle' }, hoverinfo: 'none',
                        xaxis: 'x3', yaxis: 'y3'
                    });
                }
            }

            const frames = [];
            df_frames.forEach((row, f_idx) => {
                const ax = row[cols.x.amp_1x] || 0;
                const ay = row[cols.y.amp_1x] || 0;
                const px = (row[cols.x.phase_1x] || 0) * Math.PI / 180;
                const py = (row[cols.y.phase_1x] || 0) * Math.PI / 180;

                const ox = theta.map(t => convertProbesToPhysical(ax * Math.cos(t - px), ay * Math.sin(t - py)).x);
                const oy = theta.map(t => convertProbesToPhysical(ax * Math.cos(t - px), ay * Math.sin(t - py)).y);

                const pt_kp = convertProbesToPhysical(ax * Math.cos(-px), ay * Math.sin(-py));

                const f_data = [
                    { x: ox, y: oy },
                    {}, // Trace 1 (static)
                    { x: [pt_kp.x], y: [pt_kp.y] }
                ];

                const f_traces = [0, 1, 2];

                if (showTimebase) {
                    const tb_x = theta_tb.map(t => convertProbesToPhysical(ax * Math.cos(t - px), 0).x);
                    const kp_x = Array.from({length: cycles}, () => convertProbesToPhysical(ax * Math.cos(-px), 0).x);
                    f_data.push({ y: tb_x });
                    f_data.push({ y: kp_x });
                    f_traces.push(3, 4);

                    if (showTrace2) {
                        const tb_y = theta_tb.map(t => convertProbesToPhysical(0, ay * Math.cos(t - py)).y);
                        const kp_y = Array.from({length: cycles}, () => convertProbesToPhysical(0, ay * Math.cos(-py)).y);
                        f_data.push({ y: tb_y });
                        f_data.push({ y: kp_y });
                        f_traces.push(5, 6);
                    }
                }

                frames.push({
                    name: `f_${f_idx}_slot_${slotIdx}`,
                    data: f_data,
                    traces: f_traces
                });
            });

            container.df_frames = df_frames;
            safePlotlyReact(container, traces, layout, { responsive: true, displayModeBar: false }).then(() => {
                Plotly.addFrames(container, frames);
            });
        }

        function renderModeShapeInSlot(slotIdx, container, filteredDf, baseLayout, limits) {
            // 1. Setup clean canvas container
            window.threeCleanupRegistry = window.threeCleanupRegistry || {};
            if (window.threeCleanupRegistry[slotIdx]) {
                try {
                    window.threeCleanupRegistry[slotIdx]();
                } catch (e) {}
                delete window.threeCleanupRegistry[slotIdx];
            }
            
            container.innerHTML = '';
            container.style.position = 'relative';

            // 2. Identify active bearings
            const bearing_z = {
                'BRG1': -6.0,
                'BRG2': -3.0,
                'BRG3': 0.0,
                'BRG4': 3.0,
                'BRG5': 6.0
            };
            
            const active_brgs = [];
            bearingPairs.forEach(brg => {
                const cleanBrg = cleanPrefixForDisplay(brg);
                if (bearing_z[cleanBrg] !== undefined) {
                    const cols = getBearingPairColumns(brg);
                    if (cols.x.gap && cols.y.gap && cols.x.amp_1x && cols.y.amp_1x) {
                        active_brgs.push(brg);
                    }
                }
            });
            
            if (active_brgs.length < 2) {
                container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:0.8rem;color:var(--text-muted);">Deflection Profile requires at least 2 orthogonal proximity pairs.</div>';
                return;
            }
            
            const df_chrono = [...filteredDf].sort((a,b) => a._time_ms - b._time_ms);
            if (checkEmptyData(container, df_chrono)) return;
            
            // Sliced frames (standard 30 frames for timeline scrubbing)
            let df_frames = df_chrono.filter((_, i) => i % Math.max(1, Math.floor(df_chrono.length / 30)) === 0);
            container.df_frames = df_frames;

            // 3. Initialize Three.js Components
            const width = container.clientWidth || 300;
            const height = container.clientHeight || 300;
            
            const THREE = window.THREE;
            if (!THREE) {
                container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:0.8rem;color:var(--text-muted);">Loading 3D WebGL engine...</div>';
                return;
            }

            const scene = new THREE.Scene();
            // Get background colors from theme stylesheet
            const style = getComputedStyle(document.documentElement);
            const paperBg = style.getPropertyValue('--paper-bg-color').trim() || '#ffffff';
            const isDark = paperBg === '#0f172a' || paperBg === '#1e293b' || paperBg.includes('15') || paperBg.includes('23');
            scene.background = new THREE.Color(isDark ? 0x0f172a : 0xf8fafc);

            const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
            camera.position.set(12, 10, 15);

            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.shadowMap.enabled = true;
            container.appendChild(renderer.domElement);

            let controls = null;
            const OrbitControls = THREE.OrbitControls || window.OrbitControls;
            if (OrbitControls) {
                controls = new OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.05;
                controls.maxPolarAngle = Math.PI / 2 + 0.1; // prevent turning completely upside down
            }

            // Lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            scene.add(ambientLight);

            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(10, 20, 10);
            dirLight.castShadow = true;
            scene.add(dirLight);

            const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.3); // subtle blue fill light
            fillLight.position.set(-10, -10, -10);
            scene.add(fillLight);

            // Grid & Axes Helper
            const gridHelper = new THREE.GridHelper(20, 20, 0x10b981, isDark ? 0x334155 : 0xcbd5e1);
            gridHelper.position.y = -5;
            scene.add(gridHelper);

            // 4. Create Geometries and Materials
            const C = window.bearingClearance || 12.0;
            // Scale deflections so they are nicely visible in the 3D scene
            // Max bearing clearance is C mils. Let's map C mils to 3.0 units in Three.js coordinates.
            const scaleFactor = 3.0 / C;

            // Bearings and Clearance Boundaries
            const bearingMaterial = new THREE.MeshPhongMaterial({
                color: 0x64748b,
                transparent: true,
                opacity: 0.35,
                side: THREE.DoubleSide
            });
            const clearanceMaterial = new THREE.LineBasicMaterial({
                color: 0xef4444,
                linewidth: 1
            });
            const orbitMaterial = new THREE.LineBasicMaterial({
                color: 0xf43f5e,
                linewidth: 2
            });

            // Draw Bearing Rings and Clearance Boundaries
            const clearanceLines = [];
            const orbitLines = [];
            const orbitMarkers = [];

            active_brgs.forEach((brg, idx) => {
                const cleanBrg = cleanPrefixForDisplay(brg);
                const z_pos = bearing_z[cleanBrg];

                // Torus mesh for bearing sleeve
                const torusGeo = new THREE.TorusGeometry(3.0, 0.2, 8, 24);
                const torusMesh = new THREE.Mesh(torusGeo, bearingMaterial);
                torusMesh.position.set(0, 0, z_pos);
                scene.add(torusMesh);

                // Bearing Clearance Circle (dashed line)
                const circlePoints = [];
                for (let i = 0; i <= 64; i++) {
                    const theta = (i / 64) * 2 * Math.PI;
                    circlePoints.push(new THREE.Vector3(3.0 * Math.cos(theta), 3.0 * Math.sin(theta), z_pos));
                }
                const circleGeo = new THREE.BufferGeometry().setFromPoints(circlePoints);
                const circleLine = new THREE.Line(circleGeo, clearanceMaterial);
                scene.add(circleLine);
                clearanceLines.push(circleLine);

                // Orbit Line (Lissajous path of 1X vibration)
                const orbitPoints = Array.from({length: 65}, () => new THREE.Vector3(0, 0, z_pos));
                const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
                const orbitLine = new THREE.Line(orbitGeo, orbitMaterial);
                scene.add(orbitLine);
                orbitLines.push(orbitLine);

                // Spherical Marker for current shaft center position
                const sphereGeo = new THREE.SphereGeometry(0.18, 16, 16);
                const sphereMat = new THREE.MeshPhongMaterial({ color: 0x10b981, emissive: 0x047857 });
                const marker = new THREE.Mesh(sphereGeo, sphereMat);
                marker.position.set(0, 0, z_pos);
                scene.add(marker);
                orbitMarkers.push(marker);
            });

            // Create Shaft (dynamic cylinder)
            let shaftMesh = null;
            const shaftMaterial = new THREE.MeshPhongMaterial({
                color: 0x0ea5e9,
                emissive: 0x0369a1,
                specular: 0xffffff,
                shininess: 30,
                transparent: true,
                opacity: 0.85
            });

            // Keep track of current frame parameters
            let currentFrameIdx = 0;
            let timePhase = 0.0;
            let activeFrameData = null;

            // Helper function to extract amplitude, phase, and gap values for the active frame
            function getFrameDiagnostics(frameRow) {
                const diag = [];
                active_brgs.forEach(brg => {
                    const cols = getBearingPairColumns(brg);
                    const gx = frameRow[cols.x.gap] || 0;
                    const gy = frameRow[cols.y.gap] || 0;
                    const ax = frameRow[cols.x.amp_1x] || 0;
                    const ay = frameRow[cols.y.amp_1x] || 0;
                    const px = (frameRow[cols.x.phase_1x] || 0) * Math.PI / 180;
                    const py = (frameRow[cols.y.phase_1x] || 0) * Math.PI / 180;
                    
                    const { scaleFactor: sf, restX, restY } = getProbeRestAndScale(brg);
                    const dx = (gx - restX) * sf;
                    const dy = (gy - restY) * sf;
                    const pt = convertProbesToPhysical(dx, dy);
                    const gx_phys = pt.x;
                    const gy_phys = pt.y;

                    diag.push({
                        brg,
                        gx_phys,
                        gy_phys,
                        ax,
                        ay,
                        px,
                        py
                    });
                });
                return diag;
            }

            // Function to update the Three.js scene dynamically
            function updateThreeScene(f_idx) {
                if (f_idx < 0 || f_idx >= df_frames.length) return;
                currentFrameIdx = f_idx;
                const row = df_frames[f_idx];
                activeFrameData = getFrameDiagnostics(row);
                
                // Draw static orbits for the active frame
                activeFrameData.forEach((data, b_idx) => {
                    const z_pos = bearing_z[cleanPrefixForDisplay(data.brg)];
                    const points = [];
                    const thetaSteps = 64;
                    for (let i = 0; i <= thetaSteps; i++) {
                        const t = (i / thetaSteps) * 2 * Math.PI;
                        const pt_orb = convertProbesToPhysical(data.ax * Math.cos(t - data.px), data.ay * Math.sin(t - data.py));
                        const ox = data.gx_phys + pt_orb.x;
                        const oy = data.gy_phys + pt_orb.y;
                        points.push(new THREE.Vector3(ox * scaleFactor, oy * scaleFactor, z_pos));
                    }
                    orbitLines[b_idx].geometry.dispose();
                    orbitLines[b_idx].geometry = new THREE.BufferGeometry().setFromPoints(points);
                });
            }
            container.updateThreeScene = updateThreeScene;

            // Initialize with the first frame
            updateThreeScene(0);

            // 5. Animation Loop
            let animationFrameId = null;
            const clock = new THREE.Clock();

            function animate() {
                animationFrameId = requestAnimationFrame(animate);

                // Get speed profile from current frame to adjust whirling speed
                let speedFactor = 1.0;
                if (df_frames[currentFrameIdx]) {
                    const rpm = df_frames[currentFrameIdx][speedCol] || 3600;
                    speedFactor = rpm / 3600.0; // normalize around 3600 RPM
                }

                // Advance phase angle over time (scaled by RPM speed)
                const dt = clock.getDelta();
                timePhase += dt * 8.0 * speedFactor; // speed of whirl rotation

                if (activeFrameData) {
                    const curvePoints = [];

                    // Calculate dynamic node deflections (bending centerline)
                    activeFrameData.forEach((data, b_idx) => {
                        const cleanBrg = cleanPrefixForDisplay(data.brg);
                        const z_pos = bearing_z[cleanBrg];
                        
                        const pt_orb = convertProbesToPhysical(data.ax * Math.cos(timePhase - data.px), data.ay * Math.sin(timePhase - data.py));
                        const inst_x = data.gx_phys + pt_orb.x;
                        const inst_y = data.gy_phys + pt_orb.y;
                        
                        const scaled_x = inst_x * scaleFactor;
                        const scaled_y = inst_y * scaleFactor;

                        // Update sphere marker position
                        orbitMarkers[b_idx].position.set(scaled_x, scaled_y, z_pos);

                        // Push points for shaft spline (interpolated curve)
                        curvePoints.push(new THREE.Vector3(scaled_x, scaled_y, z_pos));
                    });

                    // Update Shaft Cylinder Mesh
                    if (shaftMesh) {
                        scene.remove(shaftMesh);
                        shaftMesh.geometry.dispose();
                    }

                    // Generate a smooth spline tube through all bearing deflection points
                    const curve = new THREE.CatmullRomCurve3(curvePoints);
                    const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.4, 16, false);
                    shaftMesh = new THREE.Mesh(tubeGeo, shaftMaterial);
                    shaftMesh.castShadow = true;
                    scene.add(shaftMesh);
                }

                if (controls) controls.update();
                renderer.render(scene, camera);
            }
            
            // Start the WebGL render loop
            animate();

            // 6. Resize Observer
            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    const w = entry.contentRect.width || container.clientWidth;
                    const h = entry.contentRect.height || container.clientHeight;
                    camera.aspect = w / h;
                    camera.updateProjectionMatrix();
                    renderer.setSize(w, h);
                }
            });
            resizeObserver.observe(container);

            // 7. Cleanup callback
            const cleanupThree = () => {
                // Stop loop
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }
                
                // Disconnect observers
                resizeObserver.disconnect();
                
                // Dispose of WebGL geometries and materials to release memory
                scene.traverse(object => {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(mat => mat.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                });
                
                if (renderer) {
                    renderer.dispose();
                }
                
                // Delete bindings
                delete container.updateThreeScene;
                delete container.cleanupThree;
            };

            window.threeCleanupRegistry[slotIdx] = cleanupThree;
            container.cleanupThree = cleanupThree;
        }

        // Helper to unwrap phase angle series (converts degrees -> radians -> unwrap -> degrees)
        function unwrapPhase(phases) {
            let unwrapped = [];
            if (phases.length === 0) return unwrapped;
            
            let rads = phases.map(p => p * Math.PI / 180);
            
            let offset = 0;
            unwrapped.push(rads[0]);
            
            for (let i = 1; i < rads.length; i++) {
                let diff = rads[i] - rads[i-1];
                if (diff > Math.PI) {
                    offset -= 2 * Math.PI;
                } else if (diff < -Math.PI) {
                    offset += 2 * Math.PI;
                }
                unwrapped.push(rads[i] + offset);
            }
            
            return unwrapped.map(r => r * 180 / Math.PI);
        }
    
        function toggleWorkspaceTheme() {
            const style = getComputedStyle(document.documentElement);
            const paperBg = style.getPropertyValue('--paper-bg-color').trim();
            const isCurrentlyLight = !paperBg || paperBg === '#ffffff' || paperBg === 'white' || paperBg.toLowerCase() === '#fff';
            
            if (isCurrentlyLight) {
                document.documentElement.style.setProperty('--bg-color', '#090d16');
                document.documentElement.style.setProperty('--card-color', '#090d16');
                document.documentElement.style.setProperty('--plot-bg-color', '#0f172a');
                document.documentElement.style.setProperty('--paper-bg-color', '#0f172a');
                document.documentElement.style.setProperty('--text-color', '#f8fafc');
                document.documentElement.style.setProperty('--plot-text-color', '#f8fafc');
                document.documentElement.style.setProperty('--text-muted', '#94a3b8');
                document.documentElement.style.setProperty('--border-color', '#334155');
                document.documentElement.style.setProperty('--contrast-grid-color', '#1e293b');
                document.documentElement.style.setProperty('--neu-shadow-dark', '#020408');
                document.documentElement.style.setProperty('--neu-shadow-light', '#151e30');
                document.documentElement.style.setProperty('--neu-hover-bg', '#1e293b');
                
                const outPicker = document.getElementById('bg-outside-picker');
                if (outPicker) outPicker.value = '#090d16';
                const inPicker = document.getElementById('bg-inside-picker');
                if (inPicker) inPicker.value = '#0f172a';
                setIsDark(true);
            } else {
                document.documentElement.style.setProperty('--bg-color', '#f8fafc');
                document.documentElement.style.setProperty('--card-color', '#ffffff');
                document.documentElement.style.setProperty('--plot-bg-color', '#ffffff');
                document.documentElement.style.setProperty('--paper-bg-color', '#ffffff');
                document.documentElement.style.setProperty('--text-color', '#0f172a');
                document.documentElement.style.setProperty('--plot-text-color', '#0f172a');
                document.documentElement.style.setProperty('--text-muted', '#64748b');
                document.documentElement.style.setProperty('--border-color', '#cbd5e1');
                document.documentElement.style.setProperty('--contrast-grid-color', '#e2e8f0');
                document.documentElement.style.setProperty('--neu-shadow-dark', '#cbd5e1');
                document.documentElement.style.setProperty('--neu-shadow-light', '#ffffff');
                document.documentElement.style.setProperty('--neu-hover-bg', '#f8fafc');
                
                const outPicker = document.getElementById('bg-outside-picker');
                if (outPicker) outPicker.value = '#f8fafc';
                const inPicker = document.getElementById('bg-inside-picker');
                if (inPicker) inPicker.value = '#ffffff';
                setIsDark(false);
            }
            renderGrid();
        }


        
        // Bind all functions to window so JSX handlers can call them
        window.selectActivityTab = selectActivityTab;
        window.closePanelDrawer = closePanelDrawer;
        window.toggleSidebarGlobal = toggleSidebarGlobal;
        window.toggleSidebar = toggleSidebar;
        window.triggerResizeWithTimeout = triggerResizeWithTimeout;
        window.getChannelUnit = getChannelUnit;
        window.applyWorkspaceStyle = applyWorkspaceStyle;
        window.applyCurveFormatting = applyCurveFormatting;
        window.handleBgOutsideChange = handleBgOutsideChange;
        window.handleBgInsideChange = handleBgInsideChange;
        window.getBrightness = getBrightness;
        window.toggleMarkerControls = toggleMarkerControls;
        window.loadSignalFormat = loadSignalFormat;
        window.handleFormatColorChange = handleFormatColorChange;
        window.handleFormatDashChange = handleFormatDashChange;
        window.handleFormatWidthChange = handleFormatWidthChange;
        window.handleFormatModeChange = handleFormatModeChange;
        window.handleFormatSymbolChange = handleFormatSymbolChange;
        window.handleFormatMarkerSizeChange = handleFormatMarkerSizeChange;
        window.cacheCSVInSession = cacheCSVInSession;
        window.uploadDatasetToBackend = uploadDatasetToBackend;
        window.fetchSavedDatasets = fetchSavedDatasets;
        window.loadDatasetFromServer = loadDatasetFromServer;
        window.loadCachedDataset = loadCachedDataset;
        window.selectOutputDirectory = selectOutputDirectory;
        window.saveFileToLocalDirectory = saveFileToLocalDirectory;
        window.dataURItoBlob = dataURItoBlob;
        window.exportMergedCSV = exportMergedCSV;
        window.downloadSlotPlot = downloadSlotPlot;
        window.downloadAllPlots = downloadAllPlots;
        window.exportAllProjectPlots = exportAllProjectPlots;
        window.detectAndDecodeText = detectAndDecodeText;
        window.preprocessCSV = preprocessCSV;
        window.cleanJSNumericValue = cleanJSNumericValue;
        window.handleFileSelect = handleFileSelect;
        window.handleMultiFileImport = handleMultiFileImport;
        window.processExcelSheet = processExcelSheet;
        window.detectColumnsInDataset = detectColumnsInDataset;
        window.escapeRegExp = escapeRegExp;
        window.mergeClientDatasets = mergeClientDatasets;
        window.parseTimestamp = parseTimestamp;
        window.parseCSVData = parseCSVData;
        window.showUploadError = showUploadError;
        window.showLoader = showLoader;
        window.detectMachineColumns = detectMachineColumns;
        window.runAIDiagnostics = runAIDiagnostics;
        window.updateDiagnosticsUI = updateDiagnosticsUI;
        window.detectStates = detectStates;
        window.cleanPrefixForDisplay = cleanPrefixForDisplay;
        window.populateSidebarTree = populateSidebarTree;
        window.toggleTreeNode = toggleTreeNode;
        window.selectPlotType = selectPlotType;
        window.syncSidebarTreeHighlights = syncSidebarTreeHighlights;
        window.selectOrAddOption = selectOrAddOption;
        window.populateFilterControls = populateFilterControls;
        window.invalidateFilteredDataCache = invalidateFilteredDataCache;
        window.getFilteredData = getFilteredData;
        window.handleStateFilterChange = handleStateFilterChange;
        window.handleRPMFilterChange = handleRPMFilterChange;
        window.handleTimeFilterChange = handleTimeFilterChange;
        window.findClosestRowIndexByMs = findClosestRowIndexByMs;
        window.handleTimeWindowPresetChange = handleTimeWindowPresetChange;
        window.updateTelemetryReadout = updateTelemetryReadout;
        window.updateTelemetryReadoutForIndex = updateTelemetryReadoutForIndex;
        window.updateSlotTelemetryBox = updateSlotTelemetryBox;
        function toggleOrbitTimebase(idx, checked) {
            if (plotSlots[idx]) {
                plotSlots[idx].showTimebase = checked;
                renderGrid();
            }
        }
        window.toggleOrbitTimebase = toggleOrbitTimebase;

        function toggleOrbitTrace2(idx, checked) {
            if (plotSlots[idx]) {
                plotSlots[idx].showTrace2 = checked;
                renderGrid();
            }
        }
        window.toggleOrbitTrace2 = toggleOrbitTrace2;

        function changeOrbitCycles(idx, val) {
            if (plotSlots[idx]) {
                const num = parseInt(val);
                if (num >= 1 && num <= 999) {
                    plotSlots[idx].cycles = num;
                    renderGrid();
                }
            }
        }
        window.changeOrbitCycles = changeOrbitCycles;

        function changePolarLabelType(idx, val) {
            if (plotSlots[idx]) {
                plotSlots[idx].polarLabelType = val;
                renderGrid();
                saveWorkspaceConfig();
            }
        }
        window.changePolarLabelType = changePolarLabelType;

        window.scadaWebSocket = null;
        window.startScadaSimulation = () => {
            const simBtn = document.getElementById('btn-scada-sim');
            
            if (window.scadaWebSocket) {
                window.scadaWebSocket.close();
                window.scadaWebSocket = null;
                if (simBtn) {
                    simBtn.innerText = 'Simulate Live SCADA Feed';
                    simBtn.style.borderColor = 'var(--accent-color)';
                    simBtn.style.color = 'var(--accent-color)';
                }
                return;
            }
            
            if (simBtn) {
                simBtn.innerText = 'Stop Live Feed';
                simBtn.style.borderColor = '#ef4444';
                simBtn.style.color = '#ef4444';
            }
            
            const apiBase = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : (window.API_BASE_URL || '');
            let wsUrl;
            const tokenVal = (typeof token !== 'undefined' ? token : '') || localStorage.getItem('token') || '';
            const queryParam = tokenVal ? `?token=${encodeURIComponent(tokenVal)}` : '';
            if (apiBase) {
                wsUrl = apiBase.replace('http://', 'ws://').replace('https://', 'wss://').replace(/\/api$/, '') + '/scada/stream' + queryParam;
            } else {
                wsUrl = 'ws://localhost:8000/scada/stream' + queryParam;
            }
            
            console.log("Connecting to SCADA WebSocket: " + wsUrl);
            const ws = new WebSocket(wsUrl);
            window.scadaWebSocket = ws;
            
            df = []; // Clear dataframe to start fresh
            
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    df.push(data);
                    
                    // Maintain a sliding window of the last 150 points
                    if (df.length > 150) {
                        df.shift();
                    }
                    
                    // Re-index rows
                    df.forEach((r, idx) => {
                        r._index = idx;
                    });
                    
                    const isFirstPacket = (df.length === 1);
                    if (isFirstPacket) {
                        allDatasetColumns = Object.keys(df[0]);
                        tsCol = allDatasetColumns.find(c => c === 'Timestamp' || c.toLowerCase() === 'timestamp') ||
                                allDatasetColumns.find(c => c.toLowerCase() === 'date' || c.toLowerCase() === '_date') ||
                                allDatasetColumns.find(c => c.toLowerCase() === '_time_ms') ||
                                allDatasetColumns[0] || 'Timestamp';
                        bearingPairs = ['BRG1X/BRG1Y'];
                        singlePrefixes = ['BRG1X', 'BRG1Y'];
                        speedCol = 'Speed';
                        window.detectedSpeedCols = ['Speed'];
                        
                        updateSpeedSensorDropdown();
                        calculateBaselineThresholds();
                        populateSidebarTree();
                    }
                    
                    const welcome = document.getElementById('welcome-screen');
                    if (welcome) welcome.style.display = 'none';
                    
                    const mainContainer = document.getElementById('main-container');
                    if (mainContainer) mainContainer.style.display = 'flex';
                    navigate('/dashboard');
                    
                    const timelineBar = document.getElementById('global-timeline-bar');
                    if (timelineBar) timelineBar.style.display = 'flex';
                    const topBtn = document.getElementById('btn-top-toggle-timeline');
                    if (topBtn) {
                        topBtn.style.display = 'inline-block';
                        topBtn.innerText = 'Hide Speed Profile';
                        topBtn.style.background = 'var(--card-color)';
                        topBtn.style.borderColor = 'var(--border-color)';
                        topBtn.style.color = '#ef4444';
                    }
                    
                    if (!plotSlots[0]) {
                        plotSlots[0] = { bearingOrChannel: 'BRG1X', category: 'trend', isDual: false, layoutLimits: { min: null, max: null, autoScale: true } };
                    }
                    if (!plotSlots[1]) {
                        plotSlots[1] = { bearingOrChannel: 'BRG1X/BRG1Y', category: 'orbit', isDual: true, layoutLimits: { min: null, max: null, autoScale: true } };
                    }
                    
                    activeCursorIndex = df.length - 1;
                    renderGrid();
                } catch (err) {
                    console.error("Error parsing SCADA websocket message:", err);
                }
            };
            
            ws.onclose = () => {
                console.log("SCADA WebSocket disconnected.");
                window.scadaWebSocket = null;
                if (simBtn) {
                    simBtn.innerText = 'Simulate Live SCADA Feed';
                    simBtn.style.borderColor = 'var(--accent-color)';
                    simBtn.style.color = 'var(--accent-color)';
                }
            };
            
            ws.onerror = (err) => {
                console.error("SCADA WebSocket error:", err);
                ws.close();
            };
        };

        window.handleLoadNewFile = () => {
            window.activeWorkspaceDataset = null;
            df = [];
            singlePrefixes = [];
            bearingPairs = [];
            bearingPairsMapping = {};
            allDatasetColumns = [];
            baselineThresholds = {};
            savedSlowRollSamples = [];
            activeSlowRollSampleId = null;
            slowRollCompensationEnabled = false;
            const checkboxEl = document.getElementById('slow-roll-enabled');
            if (checkboxEl) {
                checkboxEl.checked = false;
            }
            if (timelineIntervalId) {
                clearInterval(timelineIntervalId);
            }
            timelineIntervalId = null;
            isTimelinePlaying = false;
            timelineStepSize = 1;
            timelinePlaybackDelay = 200;
            timelinePlotlyContainer = null;
            SessionCache.delete('csv_filename')
                .then(() => SessionCache.delete('csv_text'))
                .then(() => {
                    navigate('/upload');
                });
        };

        window.setLayout = setLayout;
        window.toggleTimeSync = toggleTimeSync;
        window.zoomSlotPlotIn = zoomSlotPlotIn;
        window.zoomSlotPlotOut = zoomSlotPlotOut;
        window.navigateToSubscription = () => {
            navigate('/subscription', { state: { from: view === 'dashboard' ? '/dashboard' : '/upload' } });
        };
        window.toggleTimelineBar = () => {
            const bar = document.getElementById('global-timeline-bar');
            const btn = document.getElementById('btn-toggle-timeline');
            const topBtn = document.getElementById('btn-top-toggle-timeline');
            if (bar) {
                if (bar.style.display === 'none') {
                    bar.style.display = 'flex';
                    if (btn) btn.classList.add('active');
                    if (topBtn) {
                        topBtn.innerText = 'Hide Speed Profile';
                        topBtn.style.background = 'var(--card-color)';
                        topBtn.style.borderColor = 'var(--border-color)';
                        topBtn.style.color = '#ef4444';
                    }
                } else {
                    bar.style.display = 'none';
                    if (btn) btn.classList.remove('active');
                    if (topBtn) {
                        topBtn.innerText = 'Show Speed Profile';
                        topBtn.style.background = 'var(--card-color)';
                        topBtn.style.borderColor = 'var(--border-color)';
                        topBtn.style.color = 'var(--accent-color)';
                    }
                }
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                }, 50);
            }
        };
        window.prevGridPage = prevGridPage;
        window.nextGridPage = nextGridPage;
        window.selectSlot = selectSlot;
        window.clearSlot = clearSlot;
        window.toggleAutoScale = toggleAutoScale;
        window.setSlotMinLimit = setSlotMinLimit;
        window.setSlotMaxLimit = setSlotMaxLimit;
        window.updateSlotScale = updateSlotScale;
        window.getPlotName = getPlotName;
        window.renderGrid = renderGrid;
        window.renderPlotInSlot = renderPlotInSlot;
        window.getChannelColumns = getChannelColumns;
        window.getBearingPairColumns = getBearingPairColumns;
        window.checkEmptyData = checkEmptyData;
        window.addCursorToSlot = addCursorToSlot;
        window.findClosestRowIndex = findClosestRowIndex;
        window.updateStepSize = updateStepSize;
        window.updatePlaybackSpeed = updatePlaybackSpeed;
        window.getTimelineData = getTimelineData;
        window.updateTimelineRangeUI = updateTimelineRangeUI;
        window.renderTimelineWaveformPlot = renderTimelineWaveformPlot;
        window.initTimelineDragEvents = initTimelineDragEvents;
        window.updateTimelineCursorLine = updateTimelineCursorLine;
        window.updateTimelineReadout = updateTimelineReadout;
        window.timelineSliderInput = timelineSliderInput;
        window.timelineNext = timelineNext;
        window.timelinePrev = timelinePrev;
        window.timelineTogglePlay = timelineTogglePlay;
        window.updateAllCursorsThrottled = updateAllCursorsThrottled;
        window.updateAllCursors = updateAllCursors;
        window.getGlobalIndexFromPlotPoint = getGlobalIndexFromPlotPoint;
        window.handlePlotClick = handlePlotClick;
        window.renderTrendPlotInSlot = renderTrendPlotInSlot;
        window.renderPolarPlotInSlot = renderPolarPlotInSlot;
        window.renderBode2DInSlot = renderBode2DInSlot;
        window.renderBode3DInSlot = renderBode3DInSlot;
        window.renderCenterlineInSlot = renderCenterlineInSlot;
        window.renderCenterlineOrbitInSlot = renderCenterlineOrbitInSlot;
        window.renderOrbitInSlot = renderOrbitInSlot;
        window.renderModeShapeInSlot = renderModeShapeInSlot;
        window.renderSpectrumInSlot = renderSpectrumInSlot;
        window.renderCascadePlotInSlot = renderCascadePlotInSlot;
        window.unwrapPhase = unwrapPhase;
        window.toggleWorkspaceTheme = toggleWorkspaceTheme;
        window.toggleCustomizeLayoutMode = toggleCustomizeLayoutMode;
        window.moveSlotLeft = moveSlotLeft;
        window.moveSlotRight = moveSlotRight;
        window.saveWorkspaceConfig = saveWorkspaceConfig;
        
        function parseMarkdownToHTML(md) {
            if (!md) return "";
            let html = md;
            
            // Escape HTML tags to prevent XSS
            html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            
            // Headings
            html = html.replace(/^### (.*$)/gim, '<h4 style="font-family: \'Outfit\'; font-weight: 700; font-size: 1.05rem; margin-top: 15px; margin-bottom: 8px; color: var(--text-color); border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">$1</h4>');
            html = html.replace(/^## (.*$)/gim, '<h3 style="font-family: \'Outfit\'; font-weight: 800; font-size: 1.25rem; margin-top: 22px; margin-bottom: 10px; color: var(--accent-color);">$1</h3>');
            html = html.replace(/^# (.*$)/gim, '<h2 style="font-family: \'Outfit\'; font-weight: 900; font-size: 1.5rem; margin-top: 25px; margin-bottom: 12px; color: var(--text-color);">$1</h2>');
            
            // Bold & Italic
            html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
            
            // Bullet points
            html = html.replace(/^\s*-\s+(.*$)/gim, '<li style="margin-left: 20px; margin-bottom: 5px; list-style-type: disc; color: var(--text-color);">$1</li>');
            html = html.replace(/^\s*\*\s+(.*$)/gim, '<li style="margin-left: 20px; margin-bottom: 5px; list-style-type: disc; color: var(--text-color);">$1</li>');
            
            // Blockquotes
            html = html.replace(/^\s*>\s+(.*$)/gim, '<blockquote style="border-left: 4px solid var(--accent-color); padding-left: 15px; margin: 10px 0; color: var(--text-muted); font-style: italic;">$1</blockquote>');
            
            // Paragraphs (split by double newlines)
            const lines = html.split(/\n\n+/);
            const wrapped = lines.map(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith('<h') || trimmed.startsWith('<li') || trimmed.startsWith('<blockquote')) {
                    return line;
                }
                return `<p style="margin-bottom: 12px; line-height: 1.6; color: var(--text-color);">${line.replace(/\n/g, '<br/>')}</p>`;
            });
            
            return wrapped.join('');
        }

        window.handleGenerateReport = async () => {
            const btn = document.getElementById("btn-generate-report");
            const spinner = document.getElementById("report-btn-spinner");

            if (user && user.subscription_status === 'free-tier' && (user.report_generation_count || 0) >= 3) {
                alert("You have reached the Starter Plan limit of 3 free AI diagnostics report generations. Please upgrade to a Premium subscription.");
                navigate('/subscription', { state: { from: view === 'dashboard' ? '/dashboard' : '/upload' } });
                return;
            }

            const data = window.activeDiagnosticsData;
            if (!data) {
                alert("No diagnostic data available. Please load a dataset first.");
                return;
            }
            
            if (btn) btn.disabled = true;
            if (spinner) spinner.style.display = "inline-block";
            
            // Collect telemetry bounds summary
            let telemetry_summary = {};
            const speed_el = document.getElementById("tl-val-rpm");
            if (speed_el) {
                telemetry_summary.current_speed = speed_el.innerText;
            }
            const activeDatasetEl = document.getElementById("active-dataset-name");
            const datasetName = activeDatasetEl ? activeDatasetEl.innerText : "Active Proximity Probe";
            
            const payload = {
                bearing_name: datasetName,
                primary_diagnosis: data.primaryDiag.score > 30 ? data.primaryDiag.type : "Normal Operating State",
                confidence_score: data.primaryDiag.score,
                recommendations: data.primaryDiag.score > 30 ? data.primaryDiag.rec : "Rotor is operating within normal vibration limits.",
                critical_speeds: data.criticalSpeeds,
                telemetry_summary: telemetry_summary
            };
            
            // Reset modal body content and display it immediately for streaming
            const modal = document.getElementById("report-modal");
            const body = document.getElementById("report-modal-body");
            if (modal && body) {
                body.innerHTML = '<div style="color: var(--text-muted); font-style: italic; font-weight: 500;" id="stream-loading-msg">Connecting to Gemini AI server and generating analysis...</div>';
                modal.style.display = "flex";
                
                // Show print and docx buttons in modal header by default
                const printBtn = document.querySelector('#report-modal button[onclick*="printReport"]');
                const docxBtn = document.getElementById("btn-export-docx");
                if (printBtn) printBtn.style.display = "inline-flex";
                if (docxBtn) docxBtn.style.display = "inline-flex";
            }
            
            const apiBase = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '';
            try {
                let freshToken = token;
                try {
                    const sessionRes = await supabase.auth.getSession();
                    if (sessionRes.data.session?.access_token) {
                        freshToken = sessionRes.data.session.access_token;
                    }
                } catch (tokenErr) {
                    console.warn("Could not retrieve fresh token from Supabase client:", tokenErr);
                }

                const response = await fetch(`${apiBase}/reports/generate`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${freshToken}`
                    },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    const errText = await response.text();
                    // Intercept free-tier limit exhaustions to show the pricing upgrade notice directly in the report modal
                    if (response.status === 403 || errText.includes("limit") || errText.includes("exhausted")) {
                        // Hide print/docx buttons in modal header
                        const printBtn = document.querySelector('#report-modal button[onclick*="printReport"]');
                        const docxBtn = document.getElementById("btn-export-docx");
                        if (printBtn) printBtn.style.display = "none";
                        if (docxBtn) docxBtn.style.display = "none";

                        if (body) {
                            body.innerHTML = `
                                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 50px 20px; text-align:center; height: 100%; color: var(--text-color); font-family: 'Plus Jakarta Sans', sans-serif;">
                                    <div style="font-size: 3.5rem; color: #ef4444; margin-bottom: 20px;">🔒</div>
                                    <h2 style="font-family: 'Outfit'; font-size: 1.6rem; font-weight: 800; margin-bottom: 12px; color: var(--text-color);">Free Plan Completed</h2>
                                    <p style="font-size: 0.95rem; color: var(--text-muted); max-width: 480px; line-height: 1.6; margin-bottom: 30px;">
                                        Your free plan is completed (3 free generations). Update for more generations.
                                    </p>
                                    <div style="display:flex; gap: 15px; justify-content:center;">
                                        <button onclick="window.navigateToSubscription()" style="padding: 12px 24px; font-size: 0.9rem; font-weight: 700; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2); transition: all 0.2s;">
                                            Go to Subscription Page
                                        </button>
                                        <button onclick="document.getElementById('report-modal').style.display='none';" style="padding: 12px 24px; font-size: 0.9rem; font-weight: 600; background: var(--paper-bg-color, #f1f5f9); color: var(--text-color); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            `;
                        }
                        return;
                    }
                    throw new Error(`Report generation failed: ${errText}`);
                }
                
                const reader = response.body.getReader();
                const decoder = new TextDecoder("utf-8");
                let reportText = "";
                let buffer = "";
                
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunkText = decoder.decode(value, { stream: true });
                    buffer += chunkText;
                    
                    const lines = buffer.split("\n");
                    buffer = lines.pop(); // Keep incomplete line
                    
                    for (const line of lines) {
                        const cleanLine = line.trim();
                        if (cleanLine.startsWith("data: ")) {
                            try {
                                const jsonStr = cleanLine.substring(6);
                                const parsed = JSON.parse(jsonStr);
                                if (parsed.error) {
                                    throw new Error(parsed.error);
                                }
                                if (parsed.text) {
                                    // Remove initial loader placeholder
                                    const loaderMsg = document.getElementById("stream-loading-msg");
                                    if (loaderMsg) loaderMsg.style.display = "none";
                                    
                                    reportText += parsed.text;
                                    if (body) {
                                        body.innerHTML = parseMarkdownToHTML(reportText);
                                        // Auto-scroll body to bottom during streaming
                                        body.scrollTop = body.scrollHeight;
                                    }
                                }
                            } catch (e) {
                                console.warn("Error parsing stream chunk:", e);
                            }
                        }
                    }
                }

                // Increment generation counter in local user state upon successful generation
                if (user && user.subscription_status !== 'premium') {
                    setUser(prev => ({
                        ...prev,
                        report_generation_count: (prev.report_generation_count || 0) + 1
                    }));
                }

            } catch (error) {
                console.error("Error generating report:", error);
                if (body) {
                    body.innerHTML = `<div style="color: #ef4444; font-weight: 700; padding: 15px; border: 1px solid #fee2e2; background-color: #fef2f2; border-radius: 8px;">Failed to generate AI report: ${error.message}</div>`;
                }
            } finally {
                if (btn) btn.disabled = false;
                if (spinner) spinner.style.display = "none";
            }
        };
        

        window.printReport = () => {
            if (user && user.subscription_status !== 'premium') {
                setShowUpgradeModal(true);
                return;
            }
            const element = document.getElementById('report-modal-body');
            if (!element) return;
            
            const generatePDF = (el) => {
                const datasetName = document.getElementById("active-dataset-name")?.innerText || "Rotor";
                const filename = `RotorDyn_AI_Report_${datasetName.replace(/\.[^/.]+$/, "")}.pdf`;
                
                const originalBoxSizing = el.style.boxSizing;
                const originalMaxHeight = el.style.maxHeight;
                const originalHeight = el.style.height;
                const originalOverflowY = el.style.overflowY;
                
                el.style.boxSizing = 'content-box';
                el.style.maxHeight = 'none';
                el.style.height = 'auto';
                el.style.overflowY = 'visible';
                
                const opt = {
                    margin:       [0.5, 0.5, 0.5, 0.5],
                    filename:     filename,
                    image:        { type: 'jpeg', quality: 0.98 },
                    html2canvas:  { 
                        scale: 2, 
                        useCORS: true, 
                        logging: false,
                        backgroundColor: '#ffffff'
                    },
                    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
                };
                
                const printBtn = document.querySelector('#report-modal button[onclick*="printReport"]');
                const originalText = printBtn ? printBtn.innerText : '';
                if (printBtn) {
                    printBtn.innerText = 'Exporting PDF...';
                    printBtn.disabled = true;
                }
                
                window.html2pdf().from(el).set(opt).save().then(() => {
                    el.style.boxSizing = originalBoxSizing;
                    el.style.maxHeight = originalMaxHeight;
                    el.style.height = originalHeight;
                    el.style.overflowY = originalOverflowY;
                    
                    if (printBtn) {
                        printBtn.innerText = originalText;
                        printBtn.disabled = false;
                    }
                }).catch(err => {
                    console.error("PDF generation failed:", err);
                    alert("Export failed. Falling back to browser print...");
                    window.print();
                    
                    el.style.boxSizing = originalBoxSizing;
                    el.style.maxHeight = originalMaxHeight;
                    el.style.height = originalHeight;
                    el.style.overflowY = originalOverflowY;
                    
                    if (printBtn) {
                        printBtn.innerText = originalText;
                        printBtn.disabled = false;
                    }
                });
            };

            if (typeof window.html2pdf !== 'undefined') {
                generatePDF(element);
            } else {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                script.onload = () => {
                    generatePDF(element);
                };
                script.onerror = () => {
                    alert("Failed to load PDF library. Falling back to browser print...");
                    window.print();
                };
                document.head.appendChild(script);
            }
        };

        window.exportDocxReport = async () => {
            if (user && user.subscription_status !== 'premium') {
                setShowUpgradeModal(true);
                return;
            }
            const reportBody = document.getElementById('report-modal-body');
            if (!reportBody) return;
            
            const activeDatasetEl = document.getElementById("active-dataset-name");
            const datasetName = activeDatasetEl ? activeDatasetEl.innerText : "Rotor";
            
            const btn = document.getElementById("btn-export-docx");
            const originalText = btn ? btn.innerHTML : '';
            if (btn) {
                btn.innerHTML = 'Exporting Word...';
                btn.disabled = true;
            }
            
            try {
                const images = [];
                const gdElements = document.querySelectorAll('.chart-container');
                
                for (let i = 0; i < gdElements.length; i++) {
                    const gd = gdElements[i];
                    if (!gd) continue;
                    
                    if (gd.classList.contains('js-plotly-plot') && typeof Plotly !== 'undefined') {
                        try {
                            const dataUrl = await Plotly.toImage(gd, { format: 'png', height: 500, width: 900 });
                            images.push(dataUrl);
                        } catch (plotlyErr) {
                            console.warn("Failed to capture Plotly image:", plotlyErr);
                        }
                    } else {
                        const canvas = gd.querySelector('canvas');
                        if (canvas) {
                            try {
                                const dataUrl = canvas.toDataURL('image/png');
                                images.push(dataUrl);
                            } catch (canvasErr) {
                                console.warn("Failed to capture Canvas image:", canvasErr);
                            }
                        }
                    }
                }
                
                const apiBase = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '';
                const response = await fetch(`${apiBase}/reports/download_docx`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        bearing_name: datasetName,
                        report_text: reportBody.innerText,
                        images: images
                    })
                });
                
                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(errText);
                }
                
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `RotorDyn_AI_Report_${datasetName.replace(/\.[^/.]+$/, "")}.docx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
            } catch (err) {
                console.error("Export Word report failed:", err);
                alert(`Export failed: ${err.message}`);
            } finally {
                if (btn) {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            }
        };

        return () => {
            delete window.handleGenerateReport;
            delete window.printReport;
            delete window.exportDocxReport;
            
        // Cleanup window bindings on unmount
        delete window.selectActivityTab;
        delete window.closePanelDrawer;
        delete window.toggleSidebarGlobal;
        delete window.toggleSidebar;
        delete window.triggerResizeWithTimeout;
        delete window.getChannelUnit;
        delete window.applyWorkspaceStyle;
        delete window.applyCurveFormatting;
        delete window.handleBgOutsideChange;
        delete window.handleBgInsideChange;
        delete window.getBrightness;
        delete window.toggleMarkerControls;
        delete window.loadSignalFormat;
        delete window.handleFormatColorChange;
        delete window.handleFormatDashChange;
        delete window.handleFormatWidthChange;
        delete window.handleFormatModeChange;
        delete window.handleFormatSymbolChange;
        delete window.handleFormatMarkerSizeChange;
        delete window.cacheCSVInSession;
        delete window.uploadDatasetToBackend;
        delete window.fetchSavedDatasets;
        delete window.loadDatasetFromServer;
        delete window.loadCachedDataset;
        delete window.selectOutputDirectory;
        delete window.saveFileToLocalDirectory;
        delete window.dataURItoBlob;
        delete window.exportMergedCSV;
        delete window.downloadSlotPlot;
        delete window.downloadAllPlots;
        delete window.exportAllProjectPlots;
        delete window.detectAndDecodeText;
        delete window.preprocessCSV;
        delete window.cleanJSNumericValue;
        delete window.handleFileSelect;
        delete window.handleMultiFileImport;
        delete window.processExcelSheet;
        delete window.detectColumnsInDataset;
        delete window.escapeRegExp;
        delete window.mergeClientDatasets;
        delete window.parseTimestamp;
        delete window.parseCSVData;
        delete window.showUploadError;
        delete window.showLoader;
        delete window.detectMachineColumns;
        delete window.runAIDiagnostics;
        delete window.updateDiagnosticsUI;
        delete window.detectStates;
        delete window.cleanPrefixForDisplay;
        delete window.populateSidebarTree;
        delete window.toggleTreeNode;
        delete window.selectPlotType;
        delete window.syncSidebarTreeHighlights;
        delete window.selectOrAddOption;
        delete window.populateFilterControls;
        delete window.invalidateFilteredDataCache;
        delete window.getFilteredData;
        delete window.handleStateFilterChange;
        delete window.handleRPMFilterChange;
        delete window.handleTimeFilterChange;
        delete window.findClosestRowIndexByMs;
        delete window.handleTimeWindowPresetChange;
        delete window.updateTelemetryReadout;
        delete window.updateTelemetryReadoutForIndex;
        delete window.updateSlotTelemetryBox;
        delete window.toggleOrbitTimebase;
        delete window.toggleOrbitTrace2;
        delete window.changeOrbitCycles;
        delete window.changePolarLabelType;
        delete window.populatePlotFromToolbar;
        
        if (window.scadaInterval) {
            clearInterval(window.scadaInterval);
            window.scadaInterval = null;
        }
        delete window.startScadaSimulation;
        delete window.toggleSlowRoll;
        delete window.saveSlowRollSample;
        delete window.updateSavedSlowRollList;
        delete window.populateSlowRollDropdown;
        delete window.setLayout;
        delete window.toggleTimeSync;
        delete window.zoomSlotPlotIn;
        delete window.zoomSlotPlotOut;
        delete window.toggleTimelineBar;
        delete window.prevGridPage;
        delete window.nextGridPage;
        delete window.selectSlot;
        delete window.clearSlot;
        delete window.toggleAutoScale;
        delete window.setSlotMinLimit;
        delete window.setSlotMaxLimit;
        delete window.updateSlotScale;
        delete window.getPlotName;
        delete window.renderGrid;
        delete window.renderPlotInSlot;
        delete window.getChannelColumns;
        delete window.getBearingPairColumns;
        delete window.checkEmptyData;
        delete window.addCursorToSlot;
        delete window.findClosestRowIndex;
        delete window.updateStepSize;
        delete window.updatePlaybackSpeed;
        delete window.getTimelineData;
        delete window.updateTimelineRangeUI;
        delete window.renderTimelineWaveformPlot;
        delete window.initTimelineDragEvents;
        delete window.updateTimelineCursorLine;
        delete window.updateTimelineReadout;
        delete window.timelineSliderInput;
        delete window.timelineNext;
        delete window.timelinePrev;
        delete window.timelineTogglePlay;
        delete window.updateAllCursorsThrottled;
        delete window.updateAllCursors;
        delete window.getGlobalIndexFromPlotPoint;
        delete window.handlePlotClick;
        delete window.renderTrendPlotInSlot;
        delete window.renderPolarPlotInSlot;
        delete window.renderBode2DInSlot;
        delete window.renderBode3DInSlot;
        delete window.renderCenterlineInSlot;
        delete window.renderCenterlineOrbitInSlot;
        delete window.renderOrbitInSlot;
        delete window.renderModeShapeInSlot;
        delete window.renderSpectrumInSlot;
        delete window.renderCascadePlotInSlot;
        delete window.unwrapPhase;
        delete window.toggleWorkspaceTheme;
        delete window.toggleCustomizeLayoutMode;
        delete window.moveSlotLeft;
        delete window.moveSlotRight;
        delete window.saveWorkspaceConfig;

            delete window.handleLoadNewFile;

            clearTimeout(clearanceTimeout);

            delete window.API_BASE_URL;
            delete window.logout;
            delete window.bearingClearance;
            delete window.handleClearanceChange;
            delete window.detectedSpeedCols;
            delete window.handleSpeedSensorChange;
            delete window.updateSpeedSensorDropdown;
            window.removeEventListener('resize', triggerResizeWithTimeout);
        };
    }, [scriptsLoaded, token, logout, navigate, API_BASE_URL, view]);

    if (!scriptsLoaded) {
        return (
            <div style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'var(--bg-color)',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                color: 'var(--text-color)'
            }}>
                <div className="welcome-card" style={{
                    padding: '40px',
                    maxWidth: '450px',
                    width: '90%',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '20px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
                }}>
                    <img src="/favicon.png" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'contain' }} />
                    <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.4rem', fontWeight: 800 }}>ROTORDYN.AI</h2>
                    {scriptsLoadingError ? (
                        <>
                            <p style={{ fontSize: '0.85rem', color: '#ef4444' }}>{scriptsLoadingError}</p>
                            <button 
                                onClick={() => window.location.reload()}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '50px',
                                    background: '#3b82f6',
                                    color: '#ffffff',
                                    border: 'none',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
                                }}
                            >
                                Retry Connection
                            </button>
                        </>
                    ) : (
                        <>
                            <div style={{
                                width: '36px',
                                height: '36px',
                                border: '3px solid var(--border-color)',
                                borderTop: '3px solid var(--accent-color)',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }} />
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Initializing Diagnostics Engine...</p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div id="app-root-container" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', backgroundColor: 'var(--bg-color)', overflow: 'hidden', zIndex: 1000 }}>
            {/* Global Top-Right Controls & Profile Dropdown */}
            {user && view === 'dashboard' && (
                <div className="no-print" style={{
                    position: 'absolute',
                    top: '16px',
                    right: '70px',
                    zIndex: 10005,
                    pointerEvents: 'auto',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <button type="button" id="btn-top-toggle-timeline" onClick={() => window.toggleTimelineBar && window.toggleTimelineBar()} style={{ background: "var(--card-color)", border: "1px solid var(--border-color)", color: "var(--accent-color)", padding: "8px 16px", borderRadius: "50px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", display: "none", transition: "all 0.2s", boxShadow: "0 4px 12px rgba(15, 23, 42, 0.05)" }}>
                        Hide Speed Profile
                    </button>
                    <button type="button" id="btn-load-new-file" onClick={() => window.handleLoadNewFile && window.handleLoadNewFile()} style={{ background: "var(--card-color)", border: "1px solid var(--border-color)", color: "#ef4444", padding: "8px 16px", borderRadius: "50px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 4px 12px rgba(15, 23, 42, 0.05)" }}>
                        Load New File
                    </button>
                </div>
            )}
            {/* WELCOME / UPLOADER SCREEN */}
    <div id="welcome-screen" style={{ display: view === 'upload' ? 'flex' : 'none' }}>
        <div style={{position: "absolute", top: "20px", right: "20px", zIndex: 100}}>
            <button className="btn-upload" type="button" onClick={() => logout()} style={{display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "8px", margin: 0, width: "auto", fontSize: "0.85rem"}}>
                <FiLogOut size={16} /> Sign Out
            </button>
        </div>
        <div className="welcome-card">
            <img src="/favicon.png" style={{width: "56px", height: "56px", objectFit: "contain", marginBottom: "12px", borderRadius: "50%"}} />
            <div className="welcome-logo">ROTORDYN.AI</div>
            <h2 style={{fontSize: "1.25rem", marginBottom: "8px"}}>Interactive Vibration Diagnostics Dashboard</h2>
            <p className="welcome-subtitle">
                A professional diagnostic app for rotating machinery. Load your merged machine dataset to generate all plots with slider sweeps, telemetry hovers, and customized colors.
            </p>
            
            <div id="drop-zone" onClick={() => document.getElementById('file-input').click()}>
                <div className="upload-icon"><FiFolder size={48} style={{ color: "var(--text-muted)", marginBottom: "15px" }} /></div>
                <p style={{fontWeight: 500, marginBottom: "5px"}}>Drag & Drop CSV or Excel Files Here</p>
                <p style={{fontSize: "0.8rem", color: "var(--text-muted)"}}>or click to browse multiple files from local computer</p>
                <p style={{fontSize: "0.75rem", color: "var(--accent-color)", marginTop: "10px"}}>(Supports multi-file CSV/Excel auto-merging)</p>
            </div>
            
            <input type="file" id="file-input" accept=".csv,.xlsx,.xls" multiple onChange={(e) => window.handleFileSelect && window.handleFileSelect(e)} />
            <button className="btn-upload" type="button" onClick={() => document.getElementById('file-input').click()}>Select CSV or Excel Files</button>
            <button className="btn-upload" id="btn-scada-sim" type="button" onClick={() => window.startScadaSimulation && window.startScadaSimulation()} style={{backgroundColor: "transparent", border: "1px dashed var(--accent-color)", color: "var(--accent-color)", marginTop: "10px"}}>Simulate Live SCADA Feed</button>
            <button className="btn-upload" id="btn-load-cached" type="button" onClick={() => window.loadCachedDataset && window.loadCachedDataset()} style={{backgroundColor: "transparent", border: "1px solid var(--accent-color)", color: "var(--accent-color)", marginTop: "10px", display: "none"}}>Load Last Selected Dataset</button>
            
            {/* Saved Datasets section */}
            <div id="saved-datasets-container" style={{marginTop: "15px", borderTop: "1px solid var(--border-color)", paddingTop: "12px", width: "100%", textAlign: "left"}}>
                <h3 style={{fontSize: "0.95rem", marginBottom: "8px", fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: "var(--text-color)"}}>Your Saved Datasets</h3>
                <div id="saved-datasets-list" style={{display: "flex", flexDirection: "column", gap: "8px", maxHeight: "90px", overflowY: "auto", paddingRight: "5px"}}>
                    <p style={{fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center"}}>Fetching saved datasets...</p>
                </div>
            </div>

            <div className="error-message" id="upload-error">Invalid CSV structure detected. Please check your data file.</div>
        </div>
    </div>

    {/* MAIN DASHBOARD LAYOUT */}
    <div id="main-container" style={{ '--sidebar-width': '60px', display: view === 'dashboard' ? 'flex' : 'none' }}>
        
        {/* Sidebar Toggle Button */}
        <button id="sidebar-toggle-btn" className="sidebar-toggle" type="button" onClick={() => window.toggleSidebar && window.toggleSidebar()} title="Expand Sidebar">
            <FiChevronRight style={{width: "16px", height: "16px", display: "block", margin: "auto"}} />
        </button>
        
        {/* SIDEBAR DECK */}
        <div className="sidebar">
            
            {/* 1. ACTIVITY BAR (60px) */}
            <div className="activity-bar">
                {/* Top Logo / Brand Icon */}
                <div className="activity-logo" onClick={() => window.toggleSidebarGlobal && window.toggleSidebarGlobal()} title="Rotordyn.ai">
                    <img src="/favicon.png" style={{width: "100%", height: "100%", borderRadius: "50%", objectFit: "contain"}} />
                </div>
                
                {/* Navigation Tab Buttons */}
                <div className="activity-nav">
                    {/* User Profile Button */}
                    <button className="activity-btn" id="act-btn-profile" type="button" onClick={() => window.selectActivityTab && window.selectActivityTab('profile')} title="My Profile" style={{ marginBottom: "6px" }}>
                        <div style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            background: isDark ? 'var(--border-color)' : 'linear-gradient(135deg, var(--accent-color) 0%, #1d4ed8 100%)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.72rem',
                            fontWeight: 700
                        }}>
                            {user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                        </div>
                    </button>
                    <div style={{ width: "30px", height: "1px", backgroundColor: "var(--border-color)", margin: "2px auto 10px auto" }}></div>

                    <button className="activity-btn" id="act-btn-data" type="button" onClick={() => window.selectActivityTab && window.selectActivityTab('data')} title="Dataset Source">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                    </button>
                    <button className="activity-btn" id="act-btn-tree" type="button" onClick={() => window.selectActivityTab && window.selectActivityTab('tree')} title="Sensor Tree Navigation">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 3a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3zM6 15a3 3 0 0 0-3 3 3 3 0 0 0 6 0a3 3 0 0 0-3-3zM18 15a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>
                            <path d="M18 9v6M6 15V9a3 3 0 0 1 3-3h6"/>
                        </svg>
                    </button>
                    <button className="activity-btn" id="act-btn-filters" type="button" onClick={() => window.selectActivityTab && window.selectActivityTab('filters')} title="Timeline & RPM Filters">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="4" y1="21" x2="4" y2="14"/>
                            <line x1="4" y1="10" x2="4" y2="3"/>
                            <line x1="12" y1="21" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12" y2="3"/>
                            <line x1="20" y1="21" x2="20" y2="16"/>
                            <line x1="20" y1="12" x2="20" y2="3"/>
                            <line x1="2" y1="14" x2="6" y2="14"/>
                            <line x1="10" y1="8" x2="14" y2="8"/>
                            <line x1="18" y1="16" x2="22" y2="16"/>
                        </svg>
                    </button>
                    <button className="activity-btn" id="act-btn-styles" type="button" onClick={() => window.selectActivityTab && window.selectActivityTab('styles')} title="Styles & Formatting">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C5.03345 19.1749 5.0999 19.4318 5.02905 19.6678C4.84311 20.2872 5.19446 20.9388 5.8139 21.1247C6.01242 21.1843 6.22301 21.1895 6.42445 21.1397C6.93806 21.0129 7.42273 21.3283 7.50702 21.844C7.54593 22.0818 7.75168 22.25 7.99267 22.25H12Z"/>
                            <circle cx="7.5" cy="10.5" r="1.5" fill="currentColor"/>
                            <circle cx="11.5" cy="7.5" r="1.5" fill="currentColor"/>
                            <circle cx="16.5" cy="9.5" r="1.5" fill="currentColor"/>
                            <circle cx="15.5" cy="14.5" r="1.5" fill="currentColor"/>
                        </svg>
                    </button>
                    <button className="activity-btn" id="act-btn-diagnostics" type="button" onClick={() => window.selectActivityTab && window.selectActivityTab('diagnostics')} title="AI Diagnostics & Reports">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                    </button>
                    <button className="activity-btn" id="act-btn-team" type="button" onClick={() => window.selectActivityTab && window.selectActivityTab('team')} title="Team & Workspace">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                    </button>
                    <button className="activity-btn" id="act-btn-pricing" type="button" onClick={() => navigate('/subscription', { state: { from: view === 'dashboard' ? '/dashboard' : '/upload' } })} title="Pricing & Subscription" style={{ color: '#0284c7' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="1" x2="12" y2="23"></line>
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                        </svg>
                    </button>
                </div>
                
                {/* Bottom Collapse Chevron Toggle */}
                <div className="activity-footer">
                    <button className="activity-btn" id="act-btn-toggle" type="button" onClick={() => window.toggleSidebarGlobal && window.toggleSidebarGlobal()} title="Expand Menu Panel">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                    </button>
                </div>
            </div>
            
            {/* 2. DRAWER / CONTROL PANEL (260px) */}
            <div className="drawer-panel">
                {/* Panel Header */}
                <div className="drawer-header">
                    <span id="drawer-title" style={{fontFamily: "'Outfit'", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-color)"}}>Sensor Navigation</span>
                    <button className="grid-card-btn" type="button" onClick={() => window.closePanelDrawer && window.closePanelDrawer()} style={{display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", padding: 0, borderRadius: "4px"}} title="Close Panel">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: "12px", height: "12px"}}>
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                
                {/* Panel Body Scrollable Content */}
                <div className="drawer-body">
                    
                    {/* Tab Content: User Profile */}
                    <div className="tab-content" id="tab-content-profile" style={{padding: "15px"}}>
                        <h4 style={{fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "12px"}}>Account Details</h4>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                background: isDark ? 'var(--border-color)' : 'linear-gradient(135deg, var(--accent-color) 0%, #1d4ed8 100%)',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.25rem',
                                fontWeight: 800
                            }}>
                                {user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                            </div>
                            <div style={{ minWidth: 0, flexGrow: 1 }}>
                                <h3 style={{ margin: 0, fontFamily: "'Outfit'", fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-color)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{user.name}</h3>
                                <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{user.email}</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Role:</span>
                                <span style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-color)' }}>{user.role}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Plan:</span>
                                <span style={{ 
                                    fontWeight: 700, 
                                    textTransform: 'uppercase', 
                                    color: user.subscription_status === 'premium' ? '#0284c7' : '#64748b',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <FiAward size={11} />
                                    {user.subscription_status === 'premium' ? 'Premium' : 'Free-tier'}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button 
                                onClick={() => {
                                    window.closePanelDrawer && window.closePanelDrawer();
                                    navigate('/subscription', { state: { from: view === 'dashboard' ? '/dashboard' : '/upload' } });
                                }}
                                className="neu-button"
                                style={{ width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                            >
                                <FiAward size={14} /> Subscription & Billing
                            </button>
                            <button 
                                onClick={() => {
                                    window.toggleWorkspaceTheme && window.toggleWorkspaceTheme();
                                }}
                                className="neu-button"
                                style={{ width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                            >
                                <FiMoon size={14} /> Toggle Theme
                            </button>
                            <button 
                                onClick={async () => {
                                    await logout();
                                    navigate('/auth');
                                }}
                                className="neu-button"
                                style={{ width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', backgroundColor: '#ef4444', color: 'white', border: '1px solid #dc2626' }}
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>

                    {/* Tab Content: Data Source */}
                    <div className="tab-content" id="tab-content-data" style={{padding: "15px"}}>
                        <h4 style={{fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "12px"}}>Active Dataset</h4>

                        <div className="sidebar-file-section" style={{padding: 0, border: "none", marginBottom: "15px"}}>
                            <div style={{fontSize: "0.75rem", color: "var(--text-color)", marginBottom: "8px", fontWeight: 500, wordBreak: "break-all"}} id="sidebar-active-filename">
                                output/merged_machine_data.csv
                            </div>
                            <button className="sidebar-file-btn" id="sidebar-file-info" type="button" onClick={() => document.getElementById('file-input').click()}>
                                Change Dataset File
                            </button>
                            <button className="sidebar-file-btn" id="sidebar-file-export" type="button" onClick={() => window.exportMergedCSV && window.exportMergedCSV()} style={{marginTop: "8px"}}>
                                Export Merged CSV
                            </button>
                            <button className="sidebar-file-btn" id="sidebar-export-plots-png" type="button" onClick={() => window.exportAllProjectPlots && window.exportAllProjectPlots()} style={{marginTop: "8px", backgroundColor: "var(--accent-color)", color: "#ffffff"}}>
                                Save All Plots as PNG
                            </button>
                            <button className="sidebar-file-btn" id="sidebar-select-output-dir" type="button" onClick={() => window.selectOutputDirectory && window.selectOutputDirectory()} style={{marginTop: "8px", border: "1px dashed var(--accent-color)", backgroundColor: "rgba(14, 165, 233, 0.05)", color: "var(--accent-color)"}}>
                                <FiFolderPlus style={{ marginRight: "6px", verticalAlign: "middle" }} /> Select Local Output Folder
                            </button>
                        </div>
                        <div style={{fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.4}}>
                            <p style={{marginBottom: "8px", fontWeight: 600}}>📂 Dataset Summary:</p>
                            <ul style={{paddingLeft: "15px", display: "flex", flexDirection: "column", gap: "4px", listStyleType: "disc"}}>
                                <li>Points: <span id="data-summary-points">-</span></li>
                                <li>RPM Range: <span id="data-summary-rpm">-</span></li>
                                <li>Time Range: <span id="data-summary-time">-</span></li>
                            </ul>
                        </div>
                    </div>
                    
                    {/* Tab Content: Tree View */}
                    <div className="tab-content" id="tab-content-tree" style={{padding: "15px"}}>
                        <h4 style={{fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "10px"}}>Sensor Navigation</h4>
                        <ul id="sidebar-tree" className="tree-view"></ul>
                    </div>
                    
                    {/* Tab Content: Filters */}
                    <div className="tab-content" id="tab-content-filters" style={{padding: "15px"}}>
                        <h4 style={{fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "10px"}}>Timeline & RPM Filters</h4>
                        
                        <div className="control-group">
                            <label htmlFor="filter-state" style={{fontSize: "0.75rem"}}>Operational State</label>
                            <select id="filter-state" onChange={(e) => window.handleStateFilterChange && window.handleStateFilterChange(e)}>
                                <option value="all">All States</option>
                                <option value="startup">Startup Sweep</option>
                                <option value="steady">Steady State</option>
                                <option value="coastdown">Coastdown Sweep</option>
                            </select>
                        </div>
                        
                        <div className="control-group" style={{display: "flex", gap: "8px"}}>
                            <div style={{flex: 1}}>
                                <label htmlFor="filter-min-rpm" style={{fontSize: "0.7rem"}}>Min RPM</label>
                                <input type="number" id="filter-min-rpm" style={{padding: "6px"}} onChange={() => window.handleRPMFilterChange && window.handleRPMFilterChange()} />
                            </div>
                            <div style={{flex: 1}}>
                                <label htmlFor="filter-max-rpm" style={{fontSize: "0.7rem"}}>Max RPM</label>
                                <input type="number" id="filter-max-rpm" style={{padding: "6px"}} onChange={() => window.handleRPMFilterChange && window.handleRPMFilterChange()} />
                            </div>
                        </div>

                        <div className="control-group">
                            <label htmlFor="filter-time-window" style={{fontSize: "0.7rem"}}>Time Window / Duration</label>
                            <select id="filter-time-window" onChange={(e) => window.handleTimeWindowPresetChange && window.handleTimeWindowPresetChange(e)}>
                                <option value="all">Full Dataset</option>
                                <option value="1">1 Minute</option>
                                <option value="5">5 Minutes</option>
                                <option value="10">10 Minutes</option>
                                <option value="30">30 Minutes</option>
                                <option value="60">1 Hour</option>
                                <option value="custom">Custom Range</option>
                            </select>
                        </div>

                        <div className="control-group" style={{display: "flex", gap: "8px"}}>
                            <div style={{flex: 1}}>
                                <label htmlFor="filter-start-time" style={{fontSize: "0.7rem"}}>Start Time</label>
                                <select id="filter-start-time" style={{padding: "6px"}} onChange={() => window.handleTimeFilterChange && window.handleTimeFilterChange("start")}></select>
                            </div>
                            <div style={{flex: 1}}>
                                <label htmlFor="filter-end-time" style={{fontSize: "0.7rem"}}>End Time</label>
                                <select id="filter-end-time" style={{padding: "6px"}} onChange={() => window.handleTimeFilterChange && window.handleTimeFilterChange("end")}></select>
                            </div>
                        </div>
                    </div>
                    
                    {/* Tab Content: Styles & Formatting */}
                    <div className="tab-content" id="tab-content-styles" style={{padding: "15px", gap: "15px"}}>
                        
                        {/* Workspace Style */}
                        <div className="controls-block" style={{background: "none", padding: 0}}>
                            <h4 style={{fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px"}}>Workspace Style</h4>
                            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px"}}>
                                <div className="color-picker-mini">
                                    <input type="color" id="bg-outside-picker" defaultValue="#f8fafc" onChange={(e) => window.handleBgOutsideChange && window.handleBgOutsideChange(e.target.value)} />
                                    <label style={{fontSize: "0.65rem", marginBottom: 0, color: "var(--text-muted)"}}>Outer Area</label>
                                </div>
                                <div className="color-picker-mini">
                                    <input type="color" id="bg-inside-picker" defaultValue="#ffffff" onChange={(e) => window.handleBgInsideChange && window.handleBgInsideChange(e.target.value)} />
                                    <label style={{fontSize: "0.65rem", marginBottom: 0, color: "var(--text-muted)"}}>Grid Area</label>
                                </div>
                            </div>
                            <button className="sidebar-file-btn" type="button" onClick={() => window.applyWorkspaceStyle && window.applyWorkspaceStyle()} style={{marginTop: "8px", fontSize: "0.7rem", padding: "4px 8px"}}>
                                Apply Style
                            </button>
                        </div>

                        {/* Bearing Clearance Configuration */}
                        <div className="controls-block" style={{background: "none", padding: 0}}>
                            <h4 style={{fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px"}}>Bearing Clearance</h4>
                            <div className="control-group" style={{marginBottom: "8px"}}>
                                <label htmlFor="bearing-clearance-input" style={{fontSize: "0.65rem", display: "flex", justifyContent: "space-between", marginBottom: "3px"}}>
                                    <span>Clearance Limit (mils)</span>
                                    <span id="bearing-clearance-val">12.0</span>
                                </label>
                                <input type="number" id="bearing-clearance-input" min="1" max="100" step="0.5" defaultValue="12.0" onChange={(e) => window.handleClearanceChange && window.handleClearanceChange(e.target.value)} style={{padding: "4px", fontSize: "0.75rem", width: "100%", border: "1px solid var(--border-color)", borderRadius: "4px", backgroundColor: "var(--card-color)", color: "var(--text-color)"}} />
                            </div>
                        </div>

                        {/* Proximity Probe Configuration */}
                        <div className="controls-block" style={{background: "none", padding: 0, marginTop: "12px"}}>
                            <h4 style={{fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px"}}>Probe Angles & Offsets</h4>
                            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px"}}>
                                <div>
                                    <label htmlFor="probe-angle-x-input" style={{fontSize: "0.65rem", display: "block", marginBottom: "3px"}}>Probe X Angle (°)</label>
                                    <input type="number" id="probe-angle-x-input" min="-360" max="360" step="5" defaultValue="135" onChange={() => window.renderGrid && window.renderGrid()} style={{padding: "4px", fontSize: "0.75rem", width: "100%", border: "1px solid var(--border-color)", borderRadius: "4px", backgroundColor: "var(--card-color)", color: "var(--text-color)"}} />
                                </div>
                                <div>
                                    <label htmlFor="probe-angle-y-input" style={{fontSize: "0.65rem", display: "block", marginBottom: "3px"}}>Probe Y Angle (°)</label>
                                    <input type="number" id="probe-angle-y-input" min="-360" max="360" step="5" defaultValue="45" onChange={() => window.renderGrid && window.renderGrid()} style={{padding: "4px", fontSize: "0.75rem", width: "100%", border: "1px solid var(--border-color)", borderRadius: "4px", backgroundColor: "var(--card-color)", color: "var(--text-color)"}} />
                                </div>
                            </div>
                            <div className="control-group" style={{marginBottom: "8px"}}>
                                <label htmlFor="probe-scale-factor-input" style={{fontSize: "0.65rem", display: "block", marginBottom: "3px"}}>
                                    Probe Scale Factor (mils/V)
                                </label>
                                <input type="number" id="probe-scale-factor-input" min="0.1" max="100.0" step="0.1" defaultValue="5.0" onChange={() => window.renderGrid && window.renderGrid()} style={{padding: "4px", fontSize: "0.75rem", width: "100%", border: "1px solid var(--border-color)", borderRadius: "4px", backgroundColor: "var(--card-color)", color: "var(--text-color)"}} />
                            </div>
                            <div className="control-group" style={{marginBottom: "8px"}}>
                                <label style={{fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: 600, color: "var(--text-color)"}}>
                                    <input type="checkbox" id="manual-rest-enabled" onChange={() => window.renderGrid && window.renderGrid()} style={{margin: 0}} /> Manual DC Rest Voltages
                                </label>
                            </div>
                            <div id="manual-rest-inputs" style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px"}}>
                                <div>
                                    <label htmlFor="manual-rest-x-input" style={{fontSize: "0.65rem", display: "block", marginBottom: "3px"}}>Rest X (V)</label>
                                    <input type="number" id="manual-rest-x-input" step="0.1" defaultValue="0.0" onChange={() => window.renderGrid && window.renderGrid()} style={{padding: "4px", fontSize: "0.75rem", width: "100%", border: "1px solid var(--border-color)", borderRadius: "4px", backgroundColor: "var(--card-color)", color: "var(--text-color)"}} />
                                </div>
                                <div>
                                    <label htmlFor="manual-rest-y-input" style={{fontSize: "0.65rem", display: "block", marginBottom: "3px"}}>Rest Y (V)</label>
                                    <input type="number" id="manual-rest-y-input" step="0.1" defaultValue="0.0" onChange={() => window.renderGrid && window.renderGrid()} style={{padding: "4px", fontSize: "0.75rem", width: "100%", border: "1px solid var(--border-color)", borderRadius: "4px", backgroundColor: "var(--card-color)", color: "var(--text-color)"}} />
                                </div>
                            </div>
                        </div>

                        {/* Active Speed Sensor (Keyphaser) Configuration */}
                        <div className="controls-block" style={{background: "none", padding: 0, marginTop: "12px"}}>
                            <h4 style={{fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px"}}>Keyphaser / Speed Sensor</h4>
                            <div className="control-group" style={{marginBottom: "8px"}}>
                                <label htmlFor="speed-sensor-select" style={{fontSize: "0.65rem", display: "block", marginBottom: "3px"}}>
                                    Active Shaft Speed Column
                                </label>
                                <select id="speed-sensor-select" onChange={(e) => window.handleSpeedSensorChange && window.handleSpeedSensorChange(e.target.value)} style={{padding: "4px", fontSize: "0.75rem", width: "100%", border: "1px solid var(--border-color)", borderRadius: "4px", backgroundColor: "var(--card-color)", color: "var(--text-color)"}}>
                                    <option value="">(No Dataset Loaded)</option>
                                </select>
                            </div>
                            <div className="control-group" style={{marginBottom: "8px"}}>
                                <label htmlFor="gear-ratio-input" style={{fontSize: "0.65rem", display: "block", marginBottom: "3px"}}>
                                    Gearbox / Speed Multiplier Ratio
                                </label>
                                <input type="number" id="gear-ratio-input" step="0.01" min="0.01" max="100.0" defaultValue="1.00" onChange={() => window.renderGrid && window.renderGrid()} style={{padding: "4px", fontSize: "0.75rem", width: "100%", border: "1px solid var(--border-color)", borderRadius: "4px", backgroundColor: "var(--card-color)", color: "var(--text-color)"}} />
                            </div>
                        </div>

                        {/* Slow Roll Compensation Configuration */}
                        <div className="controls-block" style={{background: "none", padding: 0, marginTop: "12px"}}>
                            <h4 style={{fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px"}}>Slow Roll Compensation</h4>
                            <div className="control-group" style={{marginBottom: "8px"}}>
                                <label style={{fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: 600, color: "var(--text-color)"}}>
                                    <input type="checkbox" id="slow-roll-enabled" defaultChecked={slowRollCompensationEnabled} onChange={(e) => window.toggleSlowRoll && window.toggleSlowRoll(e.target.checked)} style={{margin: 0}} /> Apply Compensation
                                </label>
                            </div>
                            <div className="control-group" style={{marginBottom: "8px"}}>
                                <label htmlFor="slow-roll-sample-select" style={{fontSize: "0.65rem", display: "block", marginBottom: "3px"}}>
                                    Capture Low-Speed Sample
                                </label>
                                <select id="slow-roll-sample-select" style={{padding: "4px", fontSize: "0.75rem", width: "100%", border: "1px solid var(--border-color)", borderRadius: "4px", backgroundColor: "var(--card-color)", color: "var(--text-color)"}}>
                                    <option value="">(No Data Loaded)</option>
                                </select>
                            </div>
                            <div className="control-group" style={{marginBottom: "8px"}}>
                                <label htmlFor="slow-roll-name-input" style={{fontSize: "0.65rem", display: "block", marginBottom: "3px"}}>
                                    Sample Label
                                </label>
                                <input type="text" id="slow-roll-name-input" placeholder="e.g. Slow Roll 300RPM" style={{padding: "4px", fontSize: "0.75rem", width: "100%", border: "1px solid var(--border-color)", borderRadius: "4px", backgroundColor: "var(--card-color)", color: "var(--text-color)"}} />
                            </div>
                            <button className="sidebar-file-btn" type="button" onClick={() => window.saveSlowRollSample && window.saveSlowRollSample()} style={{fontSize: "0.7rem", padding: "4px 8px", width: "100%"}}>
                                Save Slow Roll Vector
                            </button>
                            <div id="slow-roll-saved-list" style={{marginTop: "8px", fontSize: "0.70rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "4px"}}>
                                <span style={{fontStyle: "italic", fontSize: "0.65rem"}}>No saved samples.</span>
                            </div>
                        </div>
                        
                        {/* Trend Curves Visibility */}
                        <div className="controls-block" style={{background: "none", padding: 0}}>
                            <h4 style={{fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px"}}>Trend Curves Visibility</h4>
                            <div style={{display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.75rem"}}>
                                <label style={{display: "flex", alignItems: "center", gap: "6px", fontWeight: "normal", cursor: "pointer", color: "var(--text-color)"}}>
                                    <input type="checkbox" id="show-trend-direct" defaultChecked onChange={() => window.renderGrid && window.renderGrid()} />
                                    Direct Vibration
                                </label>
                                <label style={{display: "flex", alignItems: "center", gap: "6px", fontWeight: "normal", cursor: "pointer", color: "var(--text-color)"}}>
                                    <input type="checkbox" id="show-trend-1x" defaultChecked onChange={() => window.renderGrid && window.renderGrid()} />
                                    1X Amp & Phase
                                </label>
                                <label style={{display: "flex", alignItems: "center", gap: "6px", fontWeight: "normal", cursor: "pointer", color: "var(--text-color)"}}>
                                    <input type="checkbox" id="show-trend-2x" defaultChecked onChange={() => window.renderGrid && window.renderGrid()} />
                                    2X Amp & Phase
                                </label>
                                <label style={{display: "flex", alignItems: "center", gap: "6px", fontWeight: "normal", cursor: "pointer", color: "var(--text-color)"}}>
                                    <input type="checkbox" id="show-trend-gap" defaultChecked onChange={() => window.renderGrid && window.renderGrid()} />
                                    Average Gap
                                </label>
                                <label style={{display: "flex", alignItems: "center", gap: "6px", fontWeight: "normal", cursor: "pointer", color: "var(--text-color)"}}>
                                    <input type="checkbox" id="show-trend-temp" defaultChecked onChange={() => window.renderGrid && window.renderGrid()} />
                                    Temperature
                                </label>
                                <label style={{display: "flex", alignItems: "center", gap: "6px", fontWeight: "normal", cursor: "pointer", color: "var(--text-color)"}}>
                                    <input type="checkbox" id="show-iso-limits" onChange={() => { window.renderGrid && window.renderGrid(); if (document.getElementById('show-iso-limits').checked) { window.dispatchEvent(new CustomEvent('rody_iso_toggled')); } }} />
                                    Show ISO 20816 Limits
                                </label>
                            </div>
                        </div>
                        
                        {/* Curve Formatting */}
                        <div id="formatting-panel" className="controls-block" style={{background: "none", padding: 0}}>
                            <h4 style={{fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px"}}>Curve Formatting</h4>
                            <div className="control-group" style={{marginBottom: "8px"}}>
                                <select id="format-signal-select" onChange={(e) => window.loadSignalFormat && window.loadSignalFormat(e.target.value)} style={{padding: "4px", fontSize: "0.75rem"}}>
                                    <option value="direct">Direct Vibration</option>
                                    <option value="amp_1x">1X Amplitude & Phase</option>
                                    <option value="amp_2x">2X Amplitude & Phase</option>
                                    <option value="amp_nx">nX Amplitude & Phase</option>
                                    <option value="gap">Avg Gap</option>
                                    <option value="temp">Temperature</option>
                                    <option value="speed">Speed</option>
                                    <option value="load">Load</option>
                                </select>
                            </div>
                            <div style={{display: "flex", gap: "8px", marginBottom: "8px"}}>
                                <div className="color-picker-mini" style={{flex: 1, padding: "2px 4px"}}>
                                    <input type="color" id="format-color-picker" onChange={(e) => window.handleFormatColorChange && window.handleFormatColorChange(e.target.value)} style={{width: "14px", height: "14px"}} />
                                    <label style={{fontSize: "0.6rem", marginBottom: 0, color: "var(--text-muted)"}}>Color</label>
                                </div>
                            </div>
                            <div style={{display: "flex", gap: "8px", marginBottom: "8px"}}>
                                <button className="sidebar-file-btn" type="button" onClick={() => {
                                    const picker = document.getElementById('format-color-picker');
                                    if (picker && window.handleFormatColorChange) {
                                        window.handleFormatColorChange(picker.value);
                                    }
                                }} style={{fontSize: "0.7rem", padding: "4px 8px", width: "100%"}}>
                                    Apply Curve Color
                                </button>
                            </div>
                            <div style={{display: "flex", gap: "8px", marginBottom: "8px"}}>
                                <div style={{flex: 1}}>
                                    <select id="format-dash-select" onChange={(e) => window.handleFormatDashChange && window.handleFormatDashChange(e.target.value)} style={{padding: "3px", fontSize: "0.7rem", width: "100%", border: "1px solid var(--border-color)", borderRadius: "4px", backgroundColor: "var(--card-color)", color: "var(--text-color)"}}>
                                        <option value="solid">Solid</option>
                                        <option value="dash">Dashed</option>
                                        <option value="dot">Dotted</option>
                                        <option value="dashdot">Dash-Dot</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{display: "flex", gap: "8px", marginBottom: "8px"}}>
                                <div style={{flex: 1}}>
                                    <label style={{fontSize: "0.6rem", color: "var(--text-muted)", display: "block", marginBottom: "2px"}}>Curve Type</label>
                                    <select id="format-mode-select" onChange={(e) => window.handleFormatModeChange && window.handleFormatModeChange(e.target.value)} style={{padding: "3px", fontSize: "0.7rem", width: "100%", border: "1px solid var(--border-color)", borderRadius: "4px", backgroundColor: "var(--card-color)", color: "var(--text-color)"}}>
                                        <option value="lines">Lines Only</option>
                                        <option value="markers">Markers Only</option>
                                        <option value="lines+markers">Lines & Markers</option>
                                    </select>
                                </div>
                                <div style={{flex: 1}}>
                                    <label style={{fontSize: "0.6rem", color: "var(--text-muted)", display: "block", marginBottom: "2px"}}>Symbol</label>
                                    <select id="format-symbol-select" onChange={(e) => window.handleFormatSymbolChange && window.handleFormatSymbolChange(e.target.value)} style={{padding: "3px", fontSize: "0.7rem", width: "100%", border: "1px solid var(--border-color)", borderRadius: "4px", backgroundColor: "var(--card-color)", color: "var(--text-color)"}}>
                                        <option value="circle">Circle</option>
                                        <option value="square">Square</option>
                                        <option value="cross">Cross</option>
                                        <option value="diamond">Diamond</option>
                                        <option value="triangle-up">Triangle</option>
                                    </select>
                                </div>
                            </div>
                            <div className="control-group" id="format-marker-size-group" style={{marginBottom: "8px", display: "none"}}>
                                <label htmlFor="format-marker-size-input" style={{fontSize: "0.65rem", display: "flex", justifyContent: "space-between", marginBottom: "3px"}}>
                                    <span>Marker Size</span>
                                    <span id="format-marker-size-val">4</span>
                                </label>
                                <input type="range" id="format-marker-size-input" min="2" max="12" step="1" defaultValue="4" onInput={(e) => window.handleFormatMarkerSizeChange && window.handleFormatMarkerSizeChange(e.target.value)} style={{padding: 0, margin: 0, background: "none"}} />
                            </div>
                            <div className="control-group" style={{marginBottom: 0}}>
                                <label htmlFor="format-width-input" style={{fontSize: "0.65rem", display: "flex", justifyContent: "space-between", marginBottom: "3px"}}>
                                    <span>Line Width</span>
                                    <span id="format-width-val">1.5</span>
                                </label>
                                <input type="range" id="format-width-input" min="0.5" max="5.0" step="0.1" defaultValue="1.5" onInput={(e) => window.handleFormatWidthChange && window.handleFormatWidthChange(e.target.value)} style={{padding: 0, margin: 0, background: "none"}} />
                            </div>
                        </div>
                    </div>
                    {/* Tab Content: AI Diagnostics & Reports */}
                    <div 
                        className="tab-content" 
                        id="tab-content-diagnostics" 
                        style={{
                            padding: "0px",
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            msUserSelect: 'none',
                            MozUserSelect: 'none'
                        }}
                        onCopy={(e) => { e.preventDefault(); alert('Copying diagnostics reports is disabled under your current tier.'); }}
                        onCut={(e) => { e.preventDefault(); }}
                        onContextMenu={(e) => { e.preventDefault(); }}
                    >
                        <div style={{padding: "15px", color: "var(--text-muted)", fontSize: "0.8rem", textAlign: "center"}}>
                            No dataset loaded. Upload or select a CSV dataset to execute AI diagnostics.
                        </div>
                    </div>
                    {/* Tab Content: Team & Workspace */}
                    <div className="tab-content" id="tab-content-team" style={{padding: "15px"}}>
                        <h4 style={{fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "12px"}}>Company Workspace</h4>
                        
                        {/* Company Details Card */}
                        <div style={{
                            background: 'rgba(59, 130, 246, 0.08)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            borderRadius: '6px',
                            padding: '12px',
                            marginBottom: '15px',
                            fontSize: '0.75rem',
                            lineHeight: '1.4'
                        }}>
                            <div style={{fontWeight: 700, color: 'var(--text-color)', fontSize: '0.8rem', marginBottom: '4px'}}>
                                🏢 {user ? user.company : 'Default Company'}
                            </div>
                            <div style={{color: 'var(--text-muted)'}}>
                                📍 Plant: {user ? user.plant : 'Default Plant'}
                            </div>
                            <p style={{marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-color)', paddingTop: '6px'}}>
                                🔒 <b>Tenant Boundary Active:</b> Colleagues in this company workspace share read-write permissions over all uploaded vibration dataset logs.
                            </p>
                        </div>
                        
                        <h4 style={{fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px"}}>Workspace Members</h4>
                        <div id="team-members-list" style={{maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '15px'}}>
                            {/* Loaded Dynamically */}
                        </div>

                        {/* Quick Invitation Block */}
                        <div style={{borderTop: '1px solid var(--border-color)', paddingTop: '12px'}}>
                            <h4 style={{fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "8px"}}>Invite Colleague</h4>
                            <input 
                                type="email" 
                                id="team-invite-email" 
                                placeholder="name@company.com" 
                                style={{
                                    width: '100%',
                                    padding: '8px 10px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'rgba(0,0,0,0.2)',
                                    color: 'var(--text-color)',
                                    fontSize: '0.75rem',
                                    marginBottom: '8px'
                                }}
                            />
                            <button 
                                type="button"
                                onClick={() => {
                                    const emailInput = document.getElementById('team-invite-email');
                                    const email = emailInput ? emailInput.value.trim() : '';
                                    if (!email) {
                                        alert("Please enter a valid email address.");
                                        return;
                                    }
                                    alert(`Invitation sent to ${email}! They will automatically join your company workspace (${user ? user.company : 'Default Company'}) upon signing up.`);
                                    if (emailInput) emailInput.value = '';
                                }}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    background: 'var(--accent-color)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Send Invitation
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* MAIN CHART AREA */}
        <div className="main-view">
            <div style={{display: "flex", flexDirection: "column", flexGrow: 1, height: "100%", overflow: "hidden", position: "relative"}}>
                {/* Telemetry Header Display */}
                <div className="telemetry-bar" id="telemetry-display">
                    <span className="telemetry-item" style={{color: "var(--text-muted)"}}>Hover cursor over data points on the plot area to view detailed diagnostic values...</span>
                </div>

                {/* Unified Timeline Player Controls */}
                <div className="timeline-player-bar" id="global-timeline-bar" style={{display: "none"}}>
                    {/* Row 1: Full-Width Waveform Timeline Navigator */}
                    <div style={{width: "100%", display: "flex", flexDirection: "column", gap: "4px"}}>
                        <div id="timeline-waveform-container" style={{width: "100%", height: "38px", border: "1px solid var(--border-color)", borderRadius: "4px", backgroundColor: "rgba(0,0,0,0.01)", position: "relative", cursor: "pointer", overflow: "visible"}}>
                            <div style={{position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.75rem"}}>Loading Speed Waveform...</div>
                        </div>
                        <div style={{display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-muted)", padding: "0 4px", fontWeight: 500, lineHeight: 1}}>
                            <span>Start</span>
                            <span id="tl-state-track-label" style={{textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600}}>Machine Speed Profile (Click or Drag to Scrub)</span>
                            <span>End</span>
                        </div>
                    </div>
                    
                    {/* Row 2: Playback controls, Step/Speed settings, and Telemetry readouts */}
                    <div style={{width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px"}}>
                        {/* Left Controls Group */}
                        <div style={{display: "flex", alignItems: "center", gap: "16px"}}>
                            {/* Playback Controls */}
                            <div className="timeline-group">
                                <button className="timeline-ctrl-btn" id="tl-btn-play" onClick={() => window.timelineTogglePlay && window.timelineTogglePlay()} title="Start/Stop Automatic Data Playback">
                                    <span id="tl-play-icon" style={{display: "inline-flex", alignItems: "center"}}><FiPlay style={{marginRight: "4px"}} /></span> <span id="tl-play-text">Playback</span>
                                </button>
                                <button className="timeline-ctrl-btn" id="tl-btn-prev" onClick={() => window.timelinePrev && window.timelinePrev()} title="Step Back (Ctrl+Left)" style={{display: "inline-flex", alignItems: "center", justifyContent: "center"}}><FiChevronLeft size={16} /></button>
                                <button className="timeline-ctrl-btn" id="tl-btn-next" onClick={() => window.timelineNext && window.timelineNext()} title="Step Forward (Ctrl+Right)" style={{display: "inline-flex", alignItems: "center", justifyContent: "center"}}><FiChevronRight size={16} /></button>
                            </div>
                            
                            {/* Step & Speed settings */}
                            <div className="timeline-group" style={{borderLeft: "1px solid var(--border-color)", paddingLeft: "16px", gap: "12px"}}>
                                <div className="timeline-select-wrapper">
                                    <label htmlFor="tl-select-step">Step:</label>
                                    <select id="tl-select-step" onChange={(e) => window.updateStepSize && window.updateStepSize(e.target.value)}>
                                        <option value="1">1 pt</option>
                                        <option value="5">5 pts</option>
                                        <option value="10">10 pts</option>
                                        <option value="25">25 pts</option>
                                        <option value="50">50 pts</option>
                                    </select>
                                </div>
                                <div className="timeline-select-wrapper">
                                    <label htmlFor="tl-select-speed">Speed:</label>
                                    <select id="tl-select-speed" onChange={(e) => window.updatePlaybackSpeed && window.updatePlaybackSpeed(e.target.value)}>
                                        <option value="500">Slow (0.5s)</option>
                                        <option value="200">Normal (0.2s)</option>
                                        <option value="50">Fast (0.05s)</option>
                                        <option value="10">Max (0.01s)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        {/* Telemetry Display badges */}
                        <div className="timeline-readouts-container">
                            <div className="telemetry-badge">
                                <span className="lbl">TIME</span>
                                <span className="val" id="tl-val-time">-</span>
                            </div>
                            <div className="telemetry-badge">
                                <span className="lbl">SPEED</span>
                                <span className="val"><span id="tl-val-rpm">-</span> RPM</span>
                            </div>
                            <div className="telemetry-badge" style={{minWidth: "90px", alignItems: "center"}}>
                                <span className="lbl">STATE</span>
                                <span className="val" style={{marginTop: "1px"}}><span id="tl-val-state" className="state-badge steady">-</span></span>
                            </div>
                            <div className="telemetry-badge">
                                <span className="lbl">INDEX</span>
                                <span className="val" id="tl-val-index">-</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Viewport Container */}
                <div className="chart-viewport">
                    {/* Spinner overlay */}
                    <div id="loader">
                        <div className="spinner"></div>
                        <p style={{fontFamily: "'Outfit', sans-serif", fontSize: "0.95rem", color: "var(--accent-color)"}}>Constructing Chart Canvas...</p>
                    </div>
                    
                    {/* Plot Grid */}
                    <div id="plotly-grid"></div>
                    
                    {/* Page controls at the bottom of grid */}
                    <div className="grid-page-controls" style={{display: "flex", justifyContent: "center", alignItems: "center", gap: "15px", padding: "6px 0", backgroundColor: "var(--card-color)", borderTop: "1px solid var(--border-color)", flexShrink: 0, fontSize: "0.8rem", fontFamily: "'Outfit'"}}>
                        <button className="grid-card-btn" type="button" onClick={() => window.prevGridPage && window.prevGridPage()} style={{display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "4px 8px"}}><FiChevronLeft size={16} /></button>
                        <span id="grid-page-indicator">Page 1 of 1</span>
                        <button className="grid-card-btn" type="button" onClick={() => window.nextGridPage && window.nextGridPage()} style={{display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "4px 8px"}}><FiChevronRight size={16} /></button>
                    </div>
                </div>
            </div>
            
            {/* Right-side Toolbar (Extensible Layout & Cursor controls) */}
            <div className="right-toolbar">
                <button className={`toolbar-btn ${currentLayoutState === '1' ? 'active' : ''}`} id="btn-layout-1" type="button" onClick={() => window.setLayout && window.setLayout('1')}>
                    1
                    <span className="tooltip">1 Plot</span>
                </button>
                <button className={`toolbar-btn ${currentLayoutState === '2V' ? 'active' : ''}`} id="btn-layout-2v" type="button" onClick={() => window.setLayout && window.setLayout('2V')}>
                    2H
                    <span className="tooltip">2 Plots Horizontal</span>
                </button>
                <button className={`toolbar-btn ${currentLayoutState === '2H' ? 'active' : ''}`} id="btn-layout-2h" type="button" onClick={() => window.setLayout && window.setLayout('2H')}>
                    2V
                    <span className="tooltip">2 Plots Vertical</span>
                </button>
                <button className={`toolbar-btn ${currentLayoutState === '4' ? 'active' : ''}`} id="btn-layout-4" type="button" onClick={() => window.setLayout && window.setLayout('4')}>
                    4
                    <span className="tooltip">4 Plots (2x2)</span>
                </button>
                <button className={`toolbar-btn ${currentLayoutState === '6' ? 'active' : ''}`} id="btn-layout-6" type="button" onClick={() => window.setLayout && window.setLayout('6')}>
                    6
                    <span className="tooltip">6 Plots (3x2)</span>
                </button>
                <button className={`toolbar-btn ${currentLayoutState === '8' ? 'active' : ''}`} id="btn-layout-8" type="button" onClick={() => window.setLayout && window.setLayout('8')}>
                    8
                    <span className="tooltip">8 Plots (4x2)</span>
                </button>
                
                <div className="toolbar-divider"></div>
                
                <button className="toolbar-btn active" id="btn-time-sync" type="button" onClick={() => window.toggleTimeSync && window.toggleTimeSync()}>
                    <FiClock style={{ verticalAlign: "middle" }} />
                    <span className="tooltip">Toggle Cursor Time-Sync</span>
                </button>
                <button className="toolbar-btn active" id="btn-toggle-timeline" type="button" onClick={() => window.toggleTimelineBar && window.toggleTimelineBar()} style={{ marginTop: "6px" }}>
                    <FiSliders style={{ verticalAlign: "middle" }} />
                    <span className="tooltip">Toggle Speed Profile Player</span>
                </button>
                
                <div className="toolbar-divider"></div>

                {/* Plot populator icons */}
                <button className="toolbar-btn" type="button" 
                        onClick={() => window.populatePlotFromToolbar && window.populatePlotFromToolbar('trend')}>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                    <span className="tooltip">Trend Plot</span>
                </button>
                <button className="toolbar-btn" type="button" 
                        onClick={() => window.populatePlotFromToolbar && window.populatePlotFromToolbar('polar')}>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <circle cx="12" cy="12" r="6"></circle>
                        <circle cx="12" cy="12" r="2"></circle>
                        <line x1="12" y1="2" x2="12" y2="22"></line>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                    </svg>
                    <span className="tooltip">1X Polar Plot</span>
                </button>
                <button className="toolbar-btn" type="button" 
                        onClick={() => window.populatePlotFromToolbar && window.populatePlotFromToolbar('bode2d')}>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3v18h18"></path>
                        <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
                        <circle cx="18.7" cy="8" r="1.5" fill="currentColor"></circle>
                        <circle cx="13.6" cy="13.2" r="1.5" fill="currentColor"></circle>
                        <circle cx="10.8" cy="10.5" r="1.5" fill="currentColor"></circle>
                    </svg>
                    <span className="tooltip">Bode Plot</span>
                </button>
                <button className="toolbar-btn" type="button" 
                        onClick={() => window.populatePlotFromToolbar && window.populatePlotFromToolbar('centerline')}>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" strokeDasharray="3,3"></circle>
                        <circle cx="10" cy="9" r="1.5" fill="currentColor"></circle>
                        <path d="M12 2v20M2 12h20"></path>
                    </svg>
                    <span className="tooltip">Shaft Centerline</span>
                </button>
                <button className="toolbar-btn" type="button" 
                        onClick={() => window.populatePlotFromToolbar && window.populatePlotFromToolbar('spectrum')}>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="20" x2="3" y2="4"></line>
                        <line x1="3" y1="20" x2="21" y2="20"></line>
                        <polyline points="3 20 6 14 9 17 12 8 15 12 18 6 21 20"></polyline>
                    </svg>
                    <span className="tooltip">FFT Spectrum</span>
                </button>
            </div>
        </div>

        {/* Report Modal */}
        <div id="report-modal" style={{display: "none", position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(15,23,42,0.45)", zIndex: 10000, justifyContent: "center", alignItems: "center", padding: "20px", backdropFilter: "blur(4px)"}}>
            <div className="neu-card" style={{backgroundColor: "var(--card-color)", width: "100%", maxWidth: "800px", height: "90%", borderRadius: "12px", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "0 10px 25px rgba(0,0,0,0.08)"}}>
                {/* Modal Header */}
                <div style={{padding: "16px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--card-color)"}}>
                    <h3 style={{margin: 0, fontFamily: "'Outfit'", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-color)"}}>AI Diagnostics & Maintenance Report</h3>
                    <div style={{display: "flex", gap: "10px"}}>
                        <button className="neu-button" onClick={() => window.printReport && window.printReport()} style={{padding: "6px 12px", fontSize: "0.8rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", cursor: "pointer"}}>
                            <FiPrinter /> Print / Save PDF
                        </button>
                        <button className="neu-button" id="btn-export-docx" onClick={() => window.exportDocxReport && window.exportDocxReport()} style={{padding: "6px 12px", fontSize: "0.8rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", backgroundColor: "#1e3a8a", color: "#fff", border: "1px solid #1d4ed8"}}>
                            <FiFileText /> Save as Word (.docx)
                        </button>
                        <button className="neu-button" onClick={() => { document.getElementById('report-modal').style.display = 'none'; }} style={{padding: "6px 12px", fontSize: "0.8rem", fontWeight: 600, backgroundColor: "#ef4444", color: "#fff", cursor: "pointer"}}>
                            Close
                        </button>
                    </div>
                </div>
                {/* Modal Content */}
                <div 
                    id="report-modal-body" 
                    className="report-print-area" 
                    onCopy={(e) => { e.preventDefault(); alert("Copying report content is disabled under the Starter Plan. Please download the PDF or Word report."); }}
                    onCut={(e) => { e.preventDefault(); }}
                    onContextMenu={(e) => { e.preventDefault(); }}
                    onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'a')) {
                            e.preventDefault();
                        }
                    }}
                    style={{
                        padding: "24px 30px", 
                        overflowY: "auto", 
                        flexGrow: 1, 
                        color: "var(--text-color)", 
                        fontSize: "0.9rem", 
                        lineHeight: "1.6", 
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        msUserSelect: "none",
                        MozUserSelect: "none"
                    }}
                >
                    {/* Content loaded dynamically */}
                </div>
            </div>
        </div>

        {/* Premium Upgrade Pricing Modal */}
        {showUpgradeModal && (
            <div id="upgrade-modal" style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(15,23,42,0.6)", zIndex: 100000, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px", backdropFilter: "blur(8px)" }}>
                <div className="neu-card" style={{ backgroundColor: "var(--card-color)", width: "100%", maxWidth: "680px", borderRadius: "16px", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "0 20px 50px rgba(15, 23, 42, 0.15)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {/* Modal Header */}
                    <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <FiAward size={22} style={{ color: "var(--accent-color)" }} />
                            <h3 style={{ margin: 0, fontFamily: "'Outfit'", fontSize: "1.2rem", fontWeight: 800, color: "var(--text-color)" }}>Upgrade to Premium Analyst</h3>
                        </div>
                        <button type="button" onClick={() => setShowUpgradeModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "1.5rem", cursor: "pointer", padding: "0 5px" }}>&times;</button>
                    </div>
                    {/* Modal Body */}
                    <div style={{ padding: "24px 30px", overflowY: "auto" }}>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", textAlign: "center", marginBottom: "24px" }}>
                            To export technical engineering reports with embedded dynamic plot evidence, select a premium subscription tier.
                        </p>
                        
                        {/* Two Columns Options */}
                        <div style={{ display: "flex", gap: "20px", marginBottom: "24px" }}>
                            {/* Free Card */}
                            <div style={{ flex: 1, border: "1px solid var(--border-color)", borderRadius: "12px", padding: "20px", backgroundColor: "rgba(0,0,0,0.01)", display: "flex", flexDirection: "column" }}>
                                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Basic Tier</span>
                                <h4 style={{ margin: "5px 0 10px 0", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-color)" }}>Free Account</h4>
                                <div style={{ marginBottom: "15px" }}>
                                    <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-color)" }}>$0</span>
                                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}> / month</span>
                                </div>
                                <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "8px", flexGrow: 1 }}>
                                    <li>✓ Basic dynamic workspace</li>
                                    <li>✓ 1 concurrent dataset limit</li>
                                    <li>✗ Gated PDF & Word exports</li>
                                    <li>✗ No WebGL cascade plots</li>
                                </ul>
                            </div>
                            
                            {/* Premium Card */}
                            <div style={{ flex: 1, border: "2px solid var(--accent-color)", borderRadius: "12px", padding: "20px", backgroundColor: "rgba(2, 132, 199, 0.02)", display: "flex", flexDirection: "column", boxShadow: "0 10px 20px rgba(2, 132, 199, 0.05)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--accent-color)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Machinery Analyst</span>
                                    <span style={{ fontSize: "0.6rem", fontWeight: 700, backgroundColor: "var(--accent-color)", color: "white", padding: "2px 6px", borderRadius: "20px" }}>RECOMMENDED</span>
                                </div>
                                <h4 style={{ margin: "5px 0 10px 0", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-color)" }}>Premium Analyst</h4>
                                <div style={{ marginBottom: "15px" }}>
                                    <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-color)" }}>$199</span>
                                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}> / month</span>
                                </div>
                                <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.8rem", color: "var(--text-color)", display: "flex", flexDirection: "column", gap: "8px", flexGrow: 1 }}>
                                    <li>✓ Unlimited telemetry dataset uploads</li>
                                    <li>✓ WebGL 3D waterfall cascade analysis</li>
                                    <li>✓ Unlimited PDF & Word report exports</li>
                                    <li>✓ Automatic Plot Evidence embedding</li>
                                    <li>✓ 24/7 dedicated support SLA</li>
                                </ul>
                            </div>
                        </div>
                        
                        {/* Call to Action Admin Info */}
                        <div style={{ padding: "16px", borderRadius: "8px", backgroundColor: "rgba(2, 132, 199, 0.05)", border: "1px solid rgba(2, 132, 199, 0.1)", textAlign: "center" }}>
                            <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "var(--text-color)" }}>
                                To unlock Premium access, please contact your systems administrator:
                            </p>
                            <p style={{ margin: "4px 0 0 0", fontSize: "0.9rem", fontWeight: 800, color: "var(--accent-color)" }}>
                                Billing Support (support@rotordyn.com)
                            </p>
                        </div>
                    </div>
                    {/* Modal Footer */}
                    <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end" }}>
                        <button type="button" className="neu-button" onClick={() => setShowUpgradeModal(false)} style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
                            Close Window
                        </button>
                    </div>
                </div>
            </div>
        )}

    </div>

        </div>
    );
};
