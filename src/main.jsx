import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { Buffer } from 'buffer'; // Import Buffer from the buffer package
import './index.css';

// Make Buffer available globally
window.Buffer = Buffer; // Polyfill Buffer

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
