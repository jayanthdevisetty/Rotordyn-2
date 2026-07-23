/* eslint-disable no-debugger */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
// Setup debug log capture for diagnosing runtime issues
window.debugLogs = [];
const logTypes = ['log', 'info', 'warn', 'error'];
logTypes.forEach(type => {
  const original = console[type];
  console[type] = (...args) => {
    const text = args.map(arg => {
      if (arg instanceof Error) return arg.message + '\n' + arg.stack;
      return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
    }).join(' ');
    window.debugLogs.push({ type, text, time: new Date().toLocaleTimeString() });
    if (window.onDebugLogAdded) {
      window.onDebugLogAdded();
    }
    original(...args);
  };
});

import './index.css';

// Source protection suite (production only)
if (import.meta.env.PROD) {
    document.addEventListener('contextmenu', e => e.preventDefault());
    
    document.addEventListener('keydown', e => {
        const key = e.key ? e.key.toLowerCase() : '';
        if (
            key === 'f12' ||
            ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(key)) ||
            ((e.ctrlKey || e.metaKey) && key === 'u')
        ) {
            e.preventDefault();
        }
    });

    const blockAccess = () => {
        document.body.innerHTML = `
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;background-color:#090d16;color:#ffffff;font-family:sans-serif;text-align:center;padding:20px;">
                <h1 style="color:#ef4444;font-size:1.8rem;margin-bottom:10px;">Security Access Alert</h1>
                <p style="color:#9ca3af;font-size:0.95rem;">Inspection of application source code is restricted by Rotordyn.ai Security policy.</p>
                <p style="color:#6b7280;font-size:0.8rem;margin-top:20px;">Please close Developer Tools and reload to resume normal operations.</p>
            </div>
        `;
    };

    setInterval(() => {
        // 1. Debugger Time-Lag check (Firefox & Safari fallback)
        const before = new Date().getTime();
        debugger;
        const after = new Date().getTime();
        if (after - before > 100) {
            blockAccess();
            return;
        }
    }, 1000);
}

// Dynamic Sentry setup for React frontend
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: sentryDsn,
      integrations: [],
      tracesSampleRate: 1.0,
    });
    console.info("Sentry initialization: Enabled in frontend.");
  }).catch((err) => {
    console.warn("Sentry frontend integration module failed to load:", err);
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
