import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import AppSetup from './AppSetup.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppSetup />
    <App />
  </StrictMode>,
);
