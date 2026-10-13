/**
 * Unsaved-changes guard for the editor: blocks in-app navigation (links, tab bar,
 * header buttons, back/forward) via react-router's `useBlocker`, and reloads / tab
 * closes via `beforeunload`. Requires the data router set up in App.tsx.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';
import { ConfirmDialog } from '@/ui';

export interface DirtyGuard {
  /** Render once near the page root. */
  dialog: React.ReactNode;
  /** True while a "Discard changes?" prompt is open. */
  prompting: boolean;
  /**
   * Let the next navigation through without prompting. Call right before navigating
   * after a save/duplicate, when `active` is still true for the current render.
   */
  allowNextNavigation: () => void;
}

export function useDirtyGuard(active: boolean, onDiscard: () => void): DirtyGuard {
  const bypass = useRef(false);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (bypass.current) {
      bypass.current = false;
      return false;
    }
    return active && currentLocation.pathname !== nextLocation.pathname;
  });

  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);

  const allowNextNavigation = useCallback(() => {
    bypass.current = true;
  }, []);

  const discard = useCallback(() => {
    onDiscard();
    if (blocker.state === 'blocked') blocker.proceed();
  }, [blocker, onDiscard]);

  const keepEditing = useCallback(() => {
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);

  const dialog = (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onClose={keepEditing}
      onConfirm={discard}
      title="Discard changes?"
      body="You have unsaved edits in this deck. Leaving now throws them away."
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      tone="danger"
    />
  );

  return { dialog, prompting: blocker.state === 'blocked', allowNextNavigation };
}
