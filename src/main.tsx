import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

import './blocks';
import { startPersisting } from './store/persist';

startPersisting();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
