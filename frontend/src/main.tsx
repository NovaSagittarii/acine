import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { setupShortcuts } from './components/useShortcut.ts';

function AppSetup() {
  setupShortcuts();
  return <></>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppSetup />
    <App />
  </StrictMode>,
);
