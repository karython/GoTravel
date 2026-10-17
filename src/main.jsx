import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // Envia ao SW os arquivos já carregados para o app abrir offline desde a primeira visita
        const urls = performance
          .getEntriesByType('resource')
          .map((r) => r.name)
          .filter((url) => url.startsWith(window.location.origin));
        reg.active?.postMessage({ type: 'CACHE_URLS', urls: ['/', '/index.html', ...urls] });
      })
      .catch((err) => console.error('Falha ao registrar service worker:', err));
  });
}
