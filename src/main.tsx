import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { startPersisting } from './store/persist';

startPersisting();

// Dev only: the stores on `window.__neucli`, for poking at editor state from the console.
if (import.meta.env.DEV) {
  Promise.all([import('./store/useDocument'), import('./store/useSelection'), import('./store/useUI')]).then(([d, s, u]) => {
    (window as unknown as Record<string, unknown>).__neucli = { doc: d.useDocumentStore, selection: s.useSelectionStore, ui: u.useUIStore };
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
