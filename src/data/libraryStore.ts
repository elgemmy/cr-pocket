/**
 * Library store: the single entry point UI components use for decks/profile/categories.
 * Wired to auth via `bindLibraryToAuth()` (call once at startup alongside initAuth()).
 *
 * Isolation (spec F1/F7): on sign-out or account switch the previous user's
 * listeners are detached and in-memory state is cleared BEFORE the next user's
 * data can appear. In firebase mode the local Firestore cache is also wiped
 * (see firebase.ts / docs/data-and-sync.md).
 */
import { create } from 'zustand';
import type { Deck, SyncState, UserProfile } from '@/domain/types';
import { appMode } from '@/config';
import { useAuth } from './auth';
import { resetFirestorePersistence } from './firebase';
import { createRepo, DEFAULT_PROFILE, type LibraryRepo } from './repo';

export type LibraryStatus = 'idle' | 'loading' | 'ready';

export interface LibraryState {
  status: LibraryStatus;
  /** uid whose data is currently loaded; null when signed out. */
  uid: string | null;
  /** Sorted by updatedAt descending (recently edited first). */
  decks: Deck[];
  profile: UserProfile;
  sync: SyncState;
  error: string | null;

  saveDeck: (deck: Deck) => void;
  deleteDeck: (id: string) => void;
  /** Returns the category id (existing one when the name already exists, case-insensitive). */
  upsertCategory: (name: string) => string;
  renameCategory: (id: string, name: string) => void;
  /** Removes the category only; decks keep existing with the id removed from categoryIds. */
  deleteCategory: (id: string) => void;
  toggleFavorite: (deckId: string) => void;
  /** Normalizes to uppercase with a single leading '#'; null clears the tag. */
  setPlayerTag: (tag: string | null) => void;
  dismissTagPrompt: () => void;
}

let repo: LibraryRepo | null = null;
let unsubscribe: (() => void) | null = null;

export function normalizePlayerTag(tag: string): string | null {
  const cleaned = tag.trim().toUpperCase().replace(/^#+/, '').replace(/\s+/g, '');
  return cleaned ? `#${cleaned}` : null;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useLibrary = create<LibraryState>()((_set, get) => ({
  status: 'idle',
  uid: null,
  decks: [],
  profile: DEFAULT_PROFILE,
  sync: 'loading',
  error: null,

  saveDeck(deck) {
    repo?.saveDeck(deck);
  },

  deleteDeck(id) {
    repo?.deleteDeck(id);
  },

  upsertCategory(name) {
    const trimmed = name.trim();
    if (!trimmed) return '';
    const existing = get().profile.categories.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing.id;
    const id = newId();
    repo?.saveProfile({ categories: [...get().profile.categories, { id, name: trimmed }] });
    return id;
  },

  renameCategory(id, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const categories = get().profile.categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c));
    repo?.saveProfile({ categories });
  },

  deleteCategory(id) {
    const { profile, decks } = get();
    repo?.saveProfile({ categories: profile.categories.filter((c) => c.id !== id) });
    // Decks must survive category deletion: only strip the id from their categoryIds.
    for (const deck of decks) {
      if (deck.categoryIds.includes(id)) {
        repo?.saveDeck({ ...deck, categoryIds: deck.categoryIds.filter((c) => c !== id) });
      }
    }
  },

  toggleFavorite(deckId) {
    const deck = get().decks.find((d) => d.id === deckId);
    if (!deck) return;
    repo?.saveDeck({ ...deck, favorite: !deck.favorite, updatedAt: Date.now() });
  },

  setPlayerTag(tag) {
    repo?.saveProfile({ playerTag: tag ? normalizePlayerTag(tag) : null });
  },

  dismissTagPrompt() {
    repo?.saveProfile({ tagPromptDismissed: true });
  },
}));

/** Attach a fresh repo for `uid`; any previous user's repo is torn down first. */
export function startLibrary(uid: string): void {
  stopLibrary();
  repo = createRepo(uid);
  useLibrary.setState({
    status: 'loading',
    uid,
    decks: [],
    profile: DEFAULT_PROFILE,
    sync: 'loading',
    error: null,
  });
  unsubscribe = repo.subscribe((snap) => {
    const decks = [...snap.decks].sort((a, b) => b.updatedAt - a.updatedAt);
    useLibrary.setState({
      status: 'ready',
      decks,
      profile: snap.profile,
      sync: snap.sync,
      error: snap.error,
    });
  });
}

/** Detach listeners and clear all in-memory user data immediately. */
export function stopLibrary(): void {
  const hadFirebaseRepo = repo !== null && appMode === 'firebase';
  unsubscribe?.();
  unsubscribe = null;
  repo = null;
  useLibrary.setState({
    status: 'idle',
    uid: null,
    decks: [],
    profile: DEFAULT_PROFILE,
    sync: 'loading',
    error: null,
  });
  if (hadFirebaseRepo) {
    // Fire-and-forget: terminate + wipe the on-disk cache for shared-device safety.
    void resetFirestorePersistence();
  }
}

let bound = false;

/** Subscribe the library to auth changes. Call once at startup, next to initAuth(). */
export function bindLibraryToAuth(): void {
  if (bound) return;
  bound = true;

  let activeUid: string | null = null;
  const apply = (status: string, uid: string | null) => {
    const next = status === 'signedIn' ? uid : null;
    if (next === activeUid) return;
    activeUid = next;
    if (next) startLibrary(next);
    else stopLibrary();
  };

  useAuth.subscribe((state) => apply(state.status, state.user?.uid ?? null));
  const current = useAuth.getState();
  apply(current.status, current.user?.uid ?? null);
}
