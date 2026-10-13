/**
 * Recent player-tag searches (F2): the last few successfully loaded players,
 * persisted in localStorage so they survive reloads and give one-tap re-lookup.
 * Storage is best-effort — the pure helpers are exported for tests.
 */
import { useCallback, useState } from 'react';

export interface RecentSearch {
  /** Canonical tag with leading '#'. */
  tag: string;
  /** Last known player name ('' when unknown). */
  name: string;
  /** Epoch ms of the last successful lookup. */
  at: number;
}

export const MAX_RECENT_SEARCHES = 6;
export const RECENT_SEARCHES_KEY = 'crpocket:recentPlayers:v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Pure: add/move a search to the front, deduped by tag, newest first, capped. */
export function rememberSearch(list: RecentSearch[], tag: string, name: string, at: number): RecentSearch[] {
  const entry: RecentSearch = { tag, name, at };
  return [entry, ...list.filter((e) => e.tag !== tag)].slice(0, MAX_RECENT_SEARCHES);
}

/** Pure: drop one tag from the list. */
export function removeSearch(list: RecentSearch[], tag: string): RecentSearch[] {
  return list.filter((e) => e.tag !== tag);
}

function isRecentSearch(value: unknown): value is RecentSearch {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.tag === 'string' && typeof v.name === 'string' && typeof v.at === 'number';
}

export function loadRecentSearches(storage: StorageLike | null = safeStorage()): RecentSearch[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentSearch).slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export function saveRecentSearches(list: RecentSearch[], storage: StorageLike | null = safeStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list.slice(0, MAX_RECENT_SEARCHES)));
  } catch {
    // storage full / unavailable — recents simply don't persist
  }
}

function safeStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export interface RecentSearchesApi {
  items: RecentSearch[];
  /** Record a successful lookup (deduped, moved to front, persisted). */
  remember: (tag: string, name: string) => void;
  remove: (tag: string) => void;
}

export function useRecentSearches(): RecentSearchesApi {
  const [items, setItems] = useState<RecentSearch[]>(() => loadRecentSearches());

  const remember = useCallback((tag: string, name: string) => {
    setItems((prev) => {
      const next = rememberSearch(prev, tag, name, Date.now());
      saveRecentSearches(next);
      return next;
    });
  }, []);

  const remove = useCallback((tag: string) => {
    setItems((prev) => {
      const next = removeSearch(prev, tag);
      saveRecentSearches(next);
      return next;
    });
  }, []);

  return { items, remember, remove };
}
