import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { initPWAInstallListener } from './lib/pwa';
import App from './App.tsx';
import './index.css';

initPWAInstallListener();
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(<App />);
