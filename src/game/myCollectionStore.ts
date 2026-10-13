/**
 * Zustand store for the SIGNED-IN user's own card collection, loaded via their saved
 * player tag. Levels come from this store (never from a browsed player's profile).
 * The last result per tag is cached in localStorage with a timestamp; `reset()`
 * clears everything on sign-out so no data leaks between accounts.
 */

import { create } from 'zustand';
import { gameApi, GameApiError } from './api';
import { normalizeTag } from '@shared/normalize';
import type { OwnedCard } from '@shared/types';

const STORAGE_PREFIX = 'crpocket:collection:v1:';

export type CollectionStatus = 'idle' | 'loading' | 'ready' | 'error';

interface MyCollectionState {
  /** Canonical `#TAG` currently loaded, or null. */
  tag: string | null;
  owned: Map<number, OwnedCard>;
  towerTroops: Map<number, OwnedCard>;
  status: CollectionStatus;
  error: string | null;
  /** Epoch ms of the last successful fetch (null when showing only cached/none). */
  updatedAt: number | null;
  /** Load a tag's collection (cached copy shown immediately, then refreshed). null resets. */
  load: (tag: string | null) => Promise<void>;
  /** Re-fetch the current tag. */
  refresh: () => Promise<void>;
  /** Clear state AND cached copies — call on sign-out / account switch. */
  reset: () => void;
}

interface PersistedCollection {
  savedAt: number;
  collection: OwnedCard[];
  towerTroops: OwnedCard[];
}

function readPersisted(tag: string): PersistedCollection | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + tag);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCollection;
    return Array.isArray(parsed.collection) ? parsed : null;
  } catch {
    return null;
  }
}

function writePersisted(tag: string, data: PersistedCollection): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + tag, JSON.stringify(data));
  } catch {
    // best effort
  }
}

function clearPersisted(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) doomed.push(key);
    }
    for (const key of doomed) localStorage.removeItem(key);
  } catch {
    // best effort
  }
}

function toMap(cards: OwnedCard[]): Map<number, OwnedCard> {
  return new Map(cards.map((c) => [c.id, c]));
}

const EMPTY = { owned: new Map<number, OwnedCard>(), towerTroops: new Map<number, OwnedCard>() };

export const useMyCollection = create<MyCollectionState>((set, get) => ({
  tag: null,
  ...EMPTY,
  status: 'idle',
  error: null,
  updatedAt: null,

  load: async (rawTag) => {
    const tag = rawTag ? normalizeTag(rawTag) : null;
    if (!tag) {
      set({ tag: null, ...EMPTY, status: 'idle', error: null, updatedAt: null });
      return;
    }
    const cached = readPersisted(tag);
    set({
      tag,
      status: cached ? 'ready' : 'loading',
      error: null,
      owned: cached ? toMap(cached.collection) : new Map(),
      towerTroops: cached ? toMap(cached.towerTroops) : new Map(),
      updatedAt: cached?.savedAt ?? null,
    });
    try {
      const profile = await gameApi.getPlayer(tag);
      const savedAt = Date.now();
      writePersisted(tag, { savedAt, collection: profile.collection, towerTroops: profile.towerTroops });
      set({
        owned: toMap(profile.collection),
        towerTroops: toMap(profile.towerTroops),
        status: 'ready',
        error: null,
        updatedAt: savedAt,
      });
    } catch (err) {
      const message = err instanceof GameApiError ? err.message : 'Failed to load your card collection.';
      set({ status: cached ? 'ready' : 'error', error: message });
    }
  },

  refresh: async () => {
    const { tag } = get();
    if (!tag) return;
    await get().load(tag);
  },

  reset: () => {
    clearPersisted();
    set({ tag: null, ...EMPTY, status: 'idle', error: null, updatedAt: null });
  },
}));
