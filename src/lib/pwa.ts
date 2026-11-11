export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type Listener = () => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedState = false;
let initialized = false;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function initPWAInstallListener() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  installedState = isStandalone;

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    installedState = true;
    deferredPrompt = null;
    notify();
  });
}

export function subscribePWAState(listener: Listener): () => void {
  initPWAInstallListener();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPWAState() {
  return {
    deferredPrompt,
    isInstalled: installedState,
  };
}

export async function triggerPWAInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    installedState = true;
    deferredPrompt = null;
    notify();
    return true;
  }
  return false;
}
