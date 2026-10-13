import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { startSession } from './app/session';
import './index.css';

startSession();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
