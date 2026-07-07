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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
