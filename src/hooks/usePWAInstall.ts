import { useEffect, useState } from 'react';
import {
  getPWAState,
  subscribePWAState,
  triggerPWAInstallPrompt,
} from '../lib/pwa';

function detectInAppBrowser(ua: string): boolean {
  return /fban|fbav|instagram|whatsapp|line\/|micromessenger|snapchat|tiktok|; wv\)/i.test(ua);
}

export function usePWAInstall() {
  const initial = getPWAState();
  const [isInstallable, setIsInstallable] = useState(Boolean(initial.deferredPrompt));
  const [isInstalled, setIsInstalled] = useState(initial.isInstalled);
  const [isIOS, setIsIOS] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    const sync = () => {
      const state = getPWAState();
      setIsInstallable(Boolean(state.deferredPrompt));
      setIsInstalled(state.isInstalled);
    };
    sync();
    const unsub = subscribePWAState(sync);

    const ua = window.navigator.userAgent || '';
    const lowerUa = ua.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(lowerUa));
    setIsInAppBrowser(detectInAppBrowser(ua));
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    return unsub;
  }, []);

  const install = async () => {
    return triggerPWAInstallPrompt();
  };

  return {
    isInstallable,
    isInstalled,
    isIOS,
    isInAppBrowser,
    isInIframe,
    install,
  };
}
