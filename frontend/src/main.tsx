import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { useSetupShortcuts } from './components/useShortcut.ts';

function AppSetup() {
  useSetupShortcuts();
  return <></>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppSetup />
    <App />
  </StrictMode>,
);
