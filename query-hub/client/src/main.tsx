import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './globals.css';
import { useAiSettingsStore } from './store/ai-settings-store';

async function boot() {
  await useAiSettingsStore.persist.rehydrate();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void boot();
