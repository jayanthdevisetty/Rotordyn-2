import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiFolder, FiLogOut, FiLoader } from 'react-icons/fi';

export const Upload = () => {
    const { token, logout, API_BASE_URL } = useAuth();
    const navigate = useNavigate();

    const [uploadError, setUploadError] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [parsingStatus, setParsingStatus] = useState('');
    const [savedDatasets, setSavedDatasets] = useState([]);
    const [loadingDatasets, setLoadingDatasets] = useState(true);

    // Fetch upload history on mount
    useEffect(() => {
        if (!token) return;
        const apiBase = API_BASE_URL || '';
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
            setSavedDatasets(history);
            setLoadingDatasets(false);
        })
        .catch(err => {
            console.error("Error fetching upload history:", err);
            setLoadingDatasets(false);
        });
    }, [token, API_BASE_URL]);

    // Handle Drag & Drop events
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            processFiles(files);
        }
    };

    const handleFileSelect = (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            processFiles(files);
        }
    };

    const processFiles = (files) => {
        setUploadError('');
        setIsParsing(true);
        setParsingStatus("Processing datasets and rendering interactive plots... This may take a few seconds.");
        
        // Let browser paint loading UI first
        setTimeout(() => {
            handleMultiFileImport(files);
        }, 50);
    };

    // Client-side file import logic
    const handleMultiFileImport = (files) => {
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
                            const XLSX = window.XLSX;
                            if (!XLSX) {
                                reject(new Error("SheetJS (XLSX) library is not loaded."));
                                return;
                            }
                            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                            const fileSheets = [];
                            
                            workbook.SheetNames.forEach(sheetName => {
                                const worksheet = workbook.Sheets[sheetName];
                                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
                                if (json.length > 0) {
                                    fileSheets.push({ name: sheetName, rows: json });
                                }
                            });
                            
                            processExcelSheet(file, fileSheets, resolve, reject);
                        } catch (err) {
                            reject(err);
                        }
                    };
                    reader.readAsArrayBuffer(file);
                } else {
                    reader.onload = function(e) {
                        try {
                            const text = e.target.result;
                            parseCSVData(file, text, resolve, reject);
                        } catch (err) {
                            reject(err);
                        }
                    };
                    reader.readAsText(file);
                }
            });
            promises.push(p);
        }

        Promise.all(promises)
            .then(results => {
                const merged = mergeClientDatasets(results);
                if (!merged || merged.length === 0) {
                    throw new Error("Unable to parse any rows from the selected file(s).");
                }
                
                // Auto-detect columns
                const { df, speedCol, tsCol, detectedSpeedCols, singlePrefixes, bearingPairs, bearingPairsMapping, allDatasetColumns } = detectColumnsInDataset(merged);
                
                // Save to window object for workspace persistence across routes
                window.activeWorkspaceDataset = {
                    df: df,
                    speedCol: speedCol,
                    tsCol: tsCol,
                    detectedSpeedCols: detectedSpeedCols,
                    singlePrefixes: singlePrefixes,
                    bearingPairs: bearingPairs,
                    bearingPairsMapping: bearingPairsMapping,
                    allDatasetColumns: allDatasetColumns,
                    fileName: fileNames.join(" + "),
                    isScadaSim: false
                };

                // Log metadata on backend database for upload history tracking
                const apiBase = API_BASE_URL || '';
                fetch(`${apiBase}/uploads/metadata`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        filename: fileNames.join(" + "),
                        columns: Object.keys(df[0] || {}),
                        row_count: df.length
                    })
                })
                .then(() => {
                    setIsParsing(false);
                    navigate('/dashboard');
                })
                .catch(err => {
                    console.warn("Failed to log upload metadata:", err);
                    setIsParsing(false);
                    navigate('/dashboard');
                });
            })
            .catch(err => {
                console.error(err);
                setUploadError(err.message || "Failed to import files. Check console log for details.");
                setIsParsing(false);
            });
    };

    const processExcelSheet = (file, fileSheets, resolve, reject) => {
        try {
            const sheet = fileSheets[0];
            if (!sheet) {
                reject(new Error("Excel file is empty."));
                return;
            }
            
            const rows = sheet.rows;
            const headers = rows[0];
            const dataRows = [];
            
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length === 0 || row.every(v => v === null || v === '')) continue;
                
                const obj = {};
                headers.forEach((h, colIdx) => {
                    if (h) {
                        let val = row[colIdx];
                        if (val instanceof Date) {
                            obj[h] = val.getTime();
                        } else {
                            obj[h] = val;
                        }
                    }
                });
                dataRows.push(obj);
            }
            resolve({ filename: file.name, data: dataRows });
        } catch (err) {
            reject(err);
        }
    };

    const parseCSVData = (file, text, resolve, reject) => {
        const Papa = window.Papa;
        if (!Papa) {
            reject(new Error("PapaParse library is not loaded."));
            return;
        }
        
        Papa.parse(text, {
            header: true,
            skipEmptyLines: 'greedy',
            dynamicTyping: true,
            complete: function(results) {
                if (results.errors && results.errors.length > 0) {
                    console.warn("PapaParse completed with errors:", results.errors);
                }
                if (!results.data || results.data.length === 0) {
                    reject(new Error(`CSV file "${file.name}" contains no valid data rows.`));
                } else {
                    resolve({ filename: file.name, data: results.data });
                }
            },
            error: function(err) {
                reject(err);
            }
        });
    };

    const parseTimestamp = (tsStr) => {
        if (!tsStr) return null;
        if (typeof tsStr === 'number') return tsStr;
        const d = new Date(tsStr);
        const time = d.getTime();
        return isNaN(time) ? null : time;
    };

    const mergeClientDatasets = (results) => {
        if (results.length === 0) return [];
        if (results.length === 1) return results[0].data;
        
        // Multi-file merge by timestamp matching
        let merged = [];
        const base = results[0].data;
        
        for (let i = 0; i < base.length; i++) {
            let row = { ...base[i] };
            for (let j = 1; j < results.length; j++) {
                row = { ...row, ...results[j].data[i] };
            }
            merged.push(row);
        }
        return merged;
    };

    const isNumber = (val) => {
        return typeof val === 'number' && !isNaN(val);
    };

    const detectStates = (rpm, times) => {
        let states = Array(rpm.length).fill('steady');
        if (rpm.length === 0) return states;

        const maxSpeed = Math.max(...rpm);
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
            const first_val = rpm[0];
            const last_val = rpm[rpm.length - 1];
            const state = last_val > first_val ? 'startup' : 'coastdown';
            states.fill(state);
        } else {
            for (let i = 0; i < first_steady; i++) {
                states[i] = 'startup';
            }
            for (let i = first_steady; i <= last_steady; i++) {
                states[i] = 'steady';
            }
            for (let i = last_steady + 1; i < rpm.length; i++) {
                states[i] = 'coastdown';
            }
        }
        return states;
    };

    const detectMachineColumns = (df, cols) => {
        let speedCol = '';
        let tsCol = '';
        let detectedSpeedCols = [];
        let singlePrefixes = [];
        let bearingPairs = [];
        let bearingPairsMapping = {};

        if (df.length === 0) return { speedCol, tsCol, detectedSpeedCols, singlePrefixes, bearingPairs, bearingPairsMapping };

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
        detectedSpeedCols = Array.from(new Set(speedCols));

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
                return t ? parseTimestamp(t) : i * 1000;
            });

            const states = detectStates(speeds, times);
            df.forEach((row, idx) => {
                row['state'] = states[idx];
            });
        }

        return { speedCol, tsCol, detectedSpeedCols, singlePrefixes, bearingPairs, bearingPairsMapping };
    };

    const detectColumnsInDataset = (df) => {
        if (!df || df.length === 0) {
            throw new Error("Empty dataset provided.");
        }
        
        const allDatasetColumns = Object.keys(df[0]);
        
        // Call detectMachineColumns
        const { speedCol, tsCol, detectedSpeedCols, singlePrefixes, bearingPairs, bearingPairsMapping } = detectMachineColumns(df, allDatasetColumns);
        
        // Clean data row timestamps into numerical index
        df.forEach((row, idx) => {
            const rawTs = row[tsCol];
            let parsed = parseTimestamp(rawTs);
            if (parsed === null) {
                parsed = idx * 100; // 10Hz sample rate fallback
            }
            row._time_ms = parsed;
        });
        
        return { df, speedCol, tsCol, detectedSpeedCols, singlePrefixes, bearingPairs, bearingPairsMapping, allDatasetColumns };
    };

    // Load dataset downloaded from backend history
    const loadDatasetFromServer = (uploadId, filename) => {
        setUploadError('');
        setIsParsing(true);
        setParsingStatus(`Downloading saved dataset: ${filename}...`);
        
        const apiBase = API_BASE_URL || '';
        fetch(`${apiBase}/uploads/${uploadId}`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        })
        .then(res => {
            if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
            return res.blob();
        })
        .then(blob => {
            const fileObj = new File([blob], filename, { type: blob.type });
            handleMultiFileImport([fileObj]);
        })
        .catch(err => {
            console.error("Failed to load dataset from server:", err);
            setUploadError(`Failed to load dataset: ${err.message}`);
            setIsParsing(false);
        });
    };

    // Trigger SCADA websocket stream simulator
    const startScadaSimulation = () => {
        window.activeWorkspaceDataset = {
            df: [],
            bearingPairs: ['BRG1X/BRG1Y'],
            singlePrefixes: ['BRG1X', 'BRG1Y'],
            speedCol: 'Speed',
            tsCol: 'Timestamp',
            fileName: 'Live SCADA Stream',
            isScadaSim: true
        };
        navigate('/dashboard');
    };

    return (
        <div id="welcome-screen">
            {/* Top Sign Out */}
            <div style={{ position: "absolute", top: "20px", right: "20px", zIndex: 100 }}>
                <button 
                    className="btn-upload" 
                    type="button" 
                    onClick={() => {
                        logout();
                        navigate('/auth');
                    }} 
                    style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "8px", margin: 0, width: "auto", fontSize: "0.85rem" }}
                >
                    <FiLogOut size={16} /> Sign Out
                </button>
            </div>

            <div className="welcome-card" style={{ maxWidth: '640px', width: '90%', padding: '40px', background: 'rgba(9, 13, 22, 0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
                <img src="/favicon.png" style={{ width: "56px", height: "56px", objectFit: "contain", marginBottom: "12px", borderRadius: "50%" }} />
                <div className="welcome-logo">ROTORDYN.AI</div>
                <h2 style={{ fontSize: "1.35rem", marginBottom: "8px", fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>Telemetry Ingestion & Calibration</h2>
                <p className="welcome-subtitle" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '30px' }}>
                    Load a rotating machinery vibration telemetry dataset. Upload local files, select a saved run, or feed a live stream to calibrate sensor paths and begin diagnostics.
                </p>

                {/* Drag and Drop Zone */}
                <div 
                    id="drop-zone" 
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('file-input').click()}
                    style={{ border: '2px dashed rgba(59, 130, 246, 0.4)', borderRadius: '16px', padding: '30px 20px', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: 'rgba(59, 130, 246, 0.02)' }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2563eb'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)'}
                >
                    <div className="upload-icon" style={{ display: 'flex', justifyContent: 'center' }}>
                        <FiFolder size={44} style={{ color: "#3b82f6", marginBottom: "15px" }} />
                    </div>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: "5px", color: 'var(--text-color)' }}>Drag & Drop CSV or Excel Files Here</p>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: '10px' }}>or click to browse multiple files from local computer</p>
                    <span style={{ fontSize: "0.7rem", color: "#3b82f6", fontWeight: 700 }}>(Supports multi-file CSV/Excel auto-merging)</span>
                </div>

                <input 
                    type="file" 
                    id="file-input" 
                    accept=".csv,.xlsx,.xls" 
                    multiple 
                    onChange={handleFileSelect} 
                    style={{ display: 'none' }} 
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                    <button 
                        className="btn-upload" 
                        type="button" 
                        onClick={() => document.getElementById('file-input').click()}
                        style={{ width: '100%', margin: 0, padding: '12px', fontSize: '0.85rem' }}
                    >
                        Browse Files
                    </button>
                    <button 
                        className="btn-upload" 
                        id="btn-scada-sim" 
                        type="button" 
                        onClick={startScadaSimulation} 
                        style={{ backgroundColor: "transparent", border: "1px dashed #3b82f6", color: "#3b82f6", width: '100%', margin: 0, padding: '12px', fontSize: '0.85rem' }}
                    >
                        Simulate Live SCADA Feed
                    </button>
                </div>

                {/* Saved Datasets list */}
                <div id="saved-datasets-container" style={{ marginTop: "25px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px", width: "100%", textAlign: "left" }}>
                    <h3 style={{ fontSize: "0.9rem", marginBottom: "10px", fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: "var(--text-color)" }}>Your Saved Datasets</h3>
                    <div id="saved-datasets-list" style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "150px", overflowY: "auto", paddingRight: "5px" }}>
                        {loadingDatasets ? (
                            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center" }}>Fetching saved datasets...</p>
                        ) : savedDatasets.length === 0 ? (
                            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center" }}>No saved datasets found. Upload a file to save it.</p>
                        ) : (
                            savedDatasets.map(item => (
                                <div 
                                    key={item.id} 
                                    className="saved-dataset-row" 
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.78rem' }}
                                >
                                    <span style={{ fontWeight: '600', color: 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                                        {item.original_filename}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                            {new Date(item.upload_time).toLocaleDateString()}
                                        </span>
                                        <button 
                                            type="button"
                                            className="btn-upload" 
                                            onClick={() => loadDatasetFromServer(item.id, item.original_filename)}
                                            style={{ padding: '3px 10px', fontSize: '0.7rem', margin: 0, width: 'auto', height: 'auto', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            Load
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {uploadError && (
                    <div className="error-message" style={{ display: 'block', marginTop: '15px', color: '#ef4444', fontSize: '0.8rem', textAlign: 'center' }}>
                        {uploadError}
                    </div>
                )}
            </div>

            {/* Parsing Overlay Loader */}
            {isParsing && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(9, 13, 22, 0.85)', zIndex: 10000, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
                    <FiLoader size={40} className="spinner" style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: 'white', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'sans-serif' }}>{parsingStatus}</p>
                </div>
            )}
        </div>
    );
};
