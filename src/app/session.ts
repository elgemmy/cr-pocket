import { useAuth, initAuth } from '@/data/auth';
import { bindLibraryToAuth, useLibrary } from '@/data/libraryStore';
import { useCatalog } from '@/game/catalogStore';
import { useMyCollection } from '@/game/myCollectionStore';
import type { SyncPillState } from '@/ui/SyncPill';

let started = false;

/**
 * One-time app bootstrap: auth, library subscription, catalog, and the signed-in
 * user's own card collection (keyed by their saved, unverified player tag).
 */
export function startSession(): void {
  if (started) return;
  started = true;

  initAuth();
  bindLibraryToAuth();
  void useCatalog.getState().load();

  let lastUid: string | null = null;
  useAuth.subscribe((auth) => {
    const uid = auth.user?.uid ?? null;
    if (uid !== lastUid) {
      if (lastUid !== null) useMyCollection.getState().reset();
      lastUid = uid;
    }
  });

  let lastTag: string | null | undefined;
  useLibrary.subscribe((lib) => {
    const tag = lib.status === 'ready' ? lib.profile.playerTag : undefined;
    if (tag === undefined || tag === lastTag) return;
    lastTag = tag;
    void useMyCollection.getState().load(tag);
  });
}

/** Header pill state: demo mode is labelled as such instead of claiming cloud sync. */
export function useSyncPillState(): SyncPillState {
  const mode = useAuth((s) => s.mode);
  const sync = useLibrary((s) => s.sync);
  return mode === 'demo' ? 'demo' : sync;
}
