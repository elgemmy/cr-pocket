/**
 * Live online/offline status (navigator.onLine + online/offline events).
 * Used by the shell's offline banner; profile/API code shows its own states.
 */
import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

/** SSR / non-browser default: assume online. */
function getServerSnapshot(): boolean {
  return true;
}

/** True while the browser believes it has connectivity. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
