/**
 * Firestore-backed LibraryRepo.
 *
 * Layout (spec §5):
 *   users/{uid}                    — profile: playerTag, categories, tagPromptDismissed,
 *                                    createdAt/updatedAt (serverTimestamp)
 *   users/{uid}/decks/{deckId}     — ONE DOC PER DECK, schemaVersion 1, client epoch-ms
 *                                    createdAt/updatedAt (numbers, per Deck type)
 *
 * Offline-first: writes are fired without awaiting; delivery is reported via
 * onSnapshot metadata ({ includeMetadataChanges: true }) and write promise
 * rejections surface as sync 'error' — success is never reported falsely.
 */
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type FirestoreError,
} from 'firebase/firestore';
import type { Deck, DeckSlot, DeckSource, UserProfile } from '@/domain/types';
import { getDb } from './firebase';
import {
  DEFAULT_PROFILE,
  deriveSyncState,
  type LibraryRepo,
  type LibrarySnapshot,
  type SnapshotMeta,
} from './repo';

const SLOT_FORMS = ['base', 'evo', 'hero', 'champion'] as const;
const SOURCE_KINDS = ['manual', 'link', 'player'] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Recursively drop `undefined` fields (Firestore rejects them). Plain objects only. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }
  if (isPlainObject(value) && value.constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (v !== undefined) out[key] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

function readableFirestoreError(err: unknown): string {
  const code = (err as FirestoreError | null)?.code ?? '';
  switch (code) {
    case 'permission-denied':
      return 'Permission denied by Firestore security rules. Try signing out and back in.';
    case 'resource-exhausted':
      return 'Firestore free-tier quota exceeded; changes will save once quota resets.';
    case 'unauthenticated':
      return 'Not signed in. Sign in again to save changes.';
    case 'unavailable':
      return 'Firestore is unreachable (network). Changes stay queued locally.';
    default:
      return `Save failed${code ? ` (${code})` : ''}. Your local copy is unchanged in memory.`;
  }
}

/** Defensive doc → Deck conversion. Returns null for malformed docs (skip, never crash). */
function deckFromDoc(id: string, data: DocumentData): Deck | null {
  try {
    if (data.schemaVersion !== 1) return null;
    if (typeof data.name !== 'string') return null;
    if (!Array.isArray(data.slots) || data.slots.length !== 8) return null;

    const slots: DeckSlot[] = [];
    for (let i = 0; i < 8; i++) {
      const raw: unknown = data.slots[i];
      if (!isPlainObject(raw)) return null;
      const form = (SLOT_FORMS as readonly string[]).includes(raw.form as string)
        ? (raw.form as DeckSlot['form'])
        : 'base';
      slots.push({
        position: typeof raw.position === 'number' ? raw.position : i,
        cardId: typeof raw.cardId === 'number' ? raw.cardId : null,
        form,
      });
    }

    const rawSource = isPlainObject(data.source) ? data.source : {};
    const source: DeckSource = {
      kind: (SOURCE_KINDS as readonly string[]).includes(rawSource.kind as string)
        ? (rawSource.kind as DeckSource['kind'])
        : 'manual',
    };
    if (typeof rawSource.playerTag === 'string') source.playerTag = rawSource.playerTag;
    if (typeof rawSource.playerName === 'string') source.playerName = rawSource.playerName;
    if (rawSource.context === 'current' || rawSource.context === 'recent') {
      source.context = rawSource.context;
    }
    if (typeof rawSource.playedAt === 'string') source.playedAt = rawSource.playedAt;

    return {
      id,
      schemaVersion: 1,
      name: data.name,
      notes: typeof data.notes === 'string' ? data.notes : '',
      favorite: data.favorite === true,
      slots,
      towerTroopId: typeof data.towerTroopId === 'number' ? data.towerTroopId : null,
      categoryIds: Array.isArray(data.categoryIds)
        ? data.categoryIds.filter((c): c is string => typeof c === 'string')
        : [],
      source,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

/** Defensive doc → UserProfile conversion (falls back to defaults per field). */
function profileFromDoc(data: DocumentData): UserProfile {
  const categories = Array.isArray(data.categories)
    ? data.categories
        .filter(
          (c): c is { id: string; name: string } =>
            isPlainObject(c) && typeof c.id === 'string' && typeof c.name === 'string',
        )
        .map((c) => ({ id: c.id, name: c.name }))
    : [];
  return {
    playerTag: typeof data.playerTag === 'string' ? data.playerTag : null,
    categories,
    tagPromptDismissed: data.tagPromptDismissed === true,
  };
}

function deckToDoc(deck: Deck): DocumentData {
  return stripUndefined({
    schemaVersion: 1 as const,
    name: deck.name,
    notes: deck.notes,
    favorite: deck.favorite,
    slots: deck.slots.map((s) => ({ position: s.position, cardId: s.cardId, form: s.form })),
    towerTroopId: deck.towerTroopId,
    categoryIds: [...deck.categoryIds],
    source: { ...deck.source },
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
  });
}

export function createFirestoreRepo(uid: string): LibraryRepo {
  const db = getDb();
  const profileRef = doc(db, 'users', uid);
  const decksCol = collection(db, 'users', uid, 'decks');

  let profile: UserProfile = DEFAULT_PROFILE;
  let decks: Deck[] = [];
  let profileMeta: SnapshotMeta | null = null;
  let decksMeta: SnapshotMeta | null = null;
  let profileExists = false;
  let writeError: string | null = null;
  let listenerError: string | null = null;
  let onChange: ((snap: LibrarySnapshot) => void) | null = null;

  function currentSync() {
    const base = deriveSyncState({ profileMeta, decksMeta, writeFailed: false });
    // A fully server-confirmed snapshot clears a sticky write error.
    if (base === 'synced') writeError = null;
    const failed = writeError ?? listenerError;
    return { sync: failed ? 'error' : base, error: failed };
  }

  function emit() {
    if (!onChange) return;
    const { sync, error } = currentSync();
    onChange({ decks: [...decks], profile, sync, error });
  }

  /** Fire-and-forget write tracking: never awaited, failures surface as sync 'error'. */
  function trackWrite(promise: Promise<void>) {
    promise.then(
      () => {
        // A later successful write clears a previous sticky error.
        writeError = null;
        emit();
      },
      (err) => {
        writeError = readableFirestoreError(err);
        emit();
      },
    );
  }

  return {
    subscribe(cb) {
      onChange = cb;
      emit(); // initial 'loading' snapshot

      const unsubProfile = onSnapshot(
        profileRef,
        { includeMetadataChanges: true },
        (snap) => {
          profileMeta = {
            hasPendingWrites: snap.metadata.hasPendingWrites,
            fromCache: snap.metadata.fromCache,
          };
          profileExists = snap.exists();
          profile = snap.exists() ? profileFromDoc(snap.data()) : DEFAULT_PROFILE;
          emit();
        },
        (err) => {
          listenerError = readableFirestoreError(err);
          emit();
        },
      );

      const unsubDecks = onSnapshot(
        decksCol,
        { includeMetadataChanges: true },
        (snap) => {
          decksMeta = {
            hasPendingWrites: snap.metadata.hasPendingWrites,
            fromCache: snap.metadata.fromCache,
          };
          const next: Deck[] = [];
          snap.forEach((d) => {
            const deck = deckFromDoc(d.id, d.data());
            if (deck) next.push(deck); // malformed docs are skipped, not fatal
          });
          decks = next;
          emit();
        },
        (err) => {
          listenerError = readableFirestoreError(err);
          emit();
        },
      );

      return () => {
        onChange = null;
        unsubProfile();
        unsubDecks();
      };
    },

    saveDeck(deck) {
      // Full-document set: last committed write wins for the same deck id (spec F7).
      trackWrite(setDoc(doc(decksCol, deck.id), deckToDoc(deck)));
    },

    deleteDeck(id) {
      trackWrite(deleteDoc(doc(decksCol, id)));
    },

    saveProfile(patch) {
      const data = stripUndefined({ ...patch }) as Record<string, unknown>;
      data.updatedAt = serverTimestamp();
      if (!profileExists) data.createdAt = serverTimestamp();
      trackWrite(setDoc(profileRef, data, { merge: true }));
    },
  };
}
