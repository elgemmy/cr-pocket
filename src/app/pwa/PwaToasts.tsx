/**
 * Service-worker lifecycle feedback.
 *
 * The app uses `registerType: 'autoUpdate'` with `injectRegister: false`
 * (see vite.config.ts), so this component is the ONLY registration path:
 * `useRegisterSW` registers the SW, auto-applies updates (autoUpdate mode
 * reloads the page when a new SW activates), and tells us when the app shell
 * is fully precached — surfaced once as a subtle toast.
 */
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from '@/ui/Toast';

export function PwaToasts() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
  } = useRegisterSW({
    onRegisterError(error) {
      // Never block the UI on SW problems — the app works without it online.
      console.warn('[cr-pocket] service worker registration failed:', error);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    toast.success('CR Pocket is ready to work offline');
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady]);

  return null;
}
