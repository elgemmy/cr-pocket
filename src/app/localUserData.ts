/**
 * Per-account browser data that is not stored under a uid-scoped key
 * (editor drafts, recent player searches). It must not leak to the next
 * account on a shared device, so it is wiped on sign-out and whenever a
 * different account signs in than the one that wrote it.
 */
import { draftKeyFor } from '@/features/editor/editorState';
import { RECENT_SEARCHES_KEY } from '@/features/player/recentSearches';

const DRAFT_PREFIX = draftKeyFor('');
export const LOCAL_OWNER_KEY = 'crpocket:localOwner:v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

function safeStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function clearLocalUserData(storage: StorageLike | null = safeStorage()): void {
  if (!storage) return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(DRAFT_PREFIX)) doomed.push(key);
    }
    doomed.push(RECENT_SEARCHES_KEY, LOCAL_OWNER_KEY);
    for (const key of doomed) storage.removeItem(key);
  } catch {
    // best-effort
  }
}

/** Call with the signed-in uid (or null when signed out). */
export function claimLocalUserData(uid: string | null, storage: StorageLike | null = safeStorage()): void {
  if (!storage) return;
  try {
    if (uid === null) {
      clearLocalUserData(storage);
      return;
    }
    const owner = storage.getItem(LOCAL_OWNER_KEY);
    if (owner !== uid) {
      // owner === null covers data written before ownership tracking existed.
      clearLocalUserData(storage);
      storage.setItem(LOCAL_OWNER_KEY, uid);
    }
  } catch {
    // best-effort
  }
}
