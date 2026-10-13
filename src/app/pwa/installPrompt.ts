/**
 * PWA install prompt ("beforeinstallprompt") captured at module level so the
 * event is never missed, exposed as a hook. The app shell shows a small
 * "Install app" affordance while `canInstall` is true; Settings can reuse
 * this hook for a larger row.
 */
import { useCallback, useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // We surface our own affordance instead of the browser mini-infobar.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    emit();
  });
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): boolean {
  return deferredPrompt !== null && !installed;
}

export interface InstallPrompt {
  /** True when the browser offered an install prompt we can still trigger. */
  canInstall: boolean;
  /** True after the app was installed via any surface. */
  installed: boolean;
  /** Trigger the browser install dialog. No-op when unavailable. */
  promptInstall: () => Promise<void>;
}

export function useInstallPrompt(): InstallPrompt {
  const canInstall = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const promptInstall = useCallback(async () => {
    const promptEvent = deferredPrompt;
    if (!promptEvent) return;
    deferredPrompt = null;
    emit();
    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => undefined);
  }, []);
  return { canInstall, installed, promptInstall };
}
