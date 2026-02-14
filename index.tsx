
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const isBenignMediaAbortError = (reason: unknown) => {
  const name = (reason as any)?.name;
  const message = ((reason as any)?.message || '').toString();

  return (
    name === 'AbortError' &&
    /play\(\) request was interrupted by a call to pause\(\)/i.test(message)
  );
};

window.addEventListener('unhandledrejection', (event) => {
  if (!isBenignMediaAbortError(event.reason)) return;

  event.preventDefault();
  if ((import.meta as any)?.env?.VITE_DEBUG_LOGS === 'true') {
    console.info('[debug] Ignorando AbortError benigno de mídia (play interrompido por pause).');
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
