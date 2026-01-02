import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { useSetupShortcuts } from './components/useShortcut.ts';

export function AppSetup() {
  // I'm pretty sure you don't need export but there's the lint rule
  // react-refresh/only-export-components since fast refresh only works when
  // a file has exports (though this probably won't be edited?)
  useSetupShortcuts();
  return <></>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppSetup />
    <App />
  </StrictMode>,
);
