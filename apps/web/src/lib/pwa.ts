import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    listeners.forEach((notify) => notify());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((notify) => notify());
  });
}

/** "Install app" for the driver PWA (Android/desktop Chrome; iOS uses Share → Add to Home Screen). */
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(() => deferredPrompt !== null);
  useEffect(() => {
    const notify = () => setCanInstall(deferredPrompt !== null);
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  }, []);
  const installed = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;
  return {
    canInstall,
    installed,
    install: async () => {
      if (!deferredPrompt) return;
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      setCanInstall(false);
    },
  };
}

/**
 * Registers the Workbox service worker built by vite-plugin-pwa (production
 * builds only). Skipped inside Tauri: the desktop shell serves assets
 * itself and has its own updater.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || isTauri() || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error: unknown) => {
      console.warn('Service worker registration failed', error);
    });
  });
}
