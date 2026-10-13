/**
 * Library repository contract shared by the Firestore and demo implementations,
 * plus the pure sync-state derivation (spec F7).
 */
import type { Deck, SyncState, UserProfile } from '@/domain/types';
import { appMode } from '@/config';
import { createDemoRepo } from './demoRepo';
import { createFirestoreRepo } from './firestoreRepo';

export interface LibrarySnapshot {
  decks: Deck[];
  profile: UserProfile;
  sync: SyncState;
  error: string | null;
}

export type Unsubscribe = () => void;

/**
 * Offline-first contract: writes return immediately (never awaited by callers);
 * delivery/acknowledgement is reported through the snapshot's `sync`/`error`.
 */
export interface LibraryRepo {
  subscribe(onChange: (snap: LibrarySnapshot) => void): Unsubscribe;
  saveDeck(deck: Deck): void;
  deleteDeck(id: string): void;
  saveProfile(patch: Partial<UserProfile>): void;
}

export const DEFAULT_PROFILE: UserProfile = {
  playerTag: null,
  categories: [],
  tagPromptDismissed: false,
};

/** Metadata of the latest snapshot seen for one Firestore target. */
export interface SnapshotMeta {
  hasPendingWrites: boolean;
  fromCache: boolean;
}

/**
 * Honest sync state (spec F7):
 * - 'error':   a write failed (permission denied, quota, …). Sticky — the caller
 *              clears it on the next server-confirmed snapshot or successful write.
 * - 'loading': not all snapshot streams have delivered at least once.
 * - 'pending': a local write has not been committed by the server yet.
 * - 'cached':  everything visible comes from the local cache (no fresh server data).
 * - 'synced':  no pending writes AND every latest snapshot is server-confirmed.
 */
export function deriveSyncState(input: {
  profileMeta: SnapshotMeta | null;
  decksMeta: SnapshotMeta | null;
  writeFailed: boolean;
}): SyncState {
  const { profileMeta, decksMeta, writeFailed } = input;
  if (writeFailed) return 'error';
  if (!profileMeta || !decksMeta) return 'loading';
  if (profileMeta.hasPendingWrites || decksMeta.hasPendingWrites) return 'pending';
  if (profileMeta.fromCache || decksMeta.fromCache) return 'cached';
  return 'synced';
}

export function createRepo(uid: string): LibraryRepo {
  return appMode === 'firebase' ? createFirestoreRepo(uid) : createDemoRepo(uid);
}
