import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}service-worker.js`;
    navigator.serviceWorker.register(swUrl).catch(() => {
      // Non-fatal: app remains functional without offline support.
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
