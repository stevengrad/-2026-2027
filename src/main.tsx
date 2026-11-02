import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// Enables an installable, offline-tolerant shell in supported browsers. Data
// requests still go directly to Supabase so live results are never stale.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Installation is progressive enhancement; the website remains usable.
    });
  });
}
