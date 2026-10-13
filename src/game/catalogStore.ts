/**
 * Zustand store for the card catalog (cards + tower troops). The last successfully
 * loaded catalog is persisted to localStorage so the app can render card art/names
 * offline after the first visit.
 */

import { create } from 'zustand';
import { gameApi, GameApiError } from './api';
import type { Catalog, CatalogCard } from '@shared/types';

const STORAGE_KEY = 'crpocket:catalog:v1';

export type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error';

interface CatalogState {
  catalog: Catalog | null;
  status: CatalogStatus;
  error: string | null;
  /** Load the catalog if not already loading/ready (uses the persisted copy first). */
  load: () => Promise<void>;
  /** Force a fresh fetch, replacing the persisted copy on success. */
  refresh: () => Promise<void>;
  /** Look up a card OR tower troop by id. */
  byId: (id: number) => CatalogCard | undefined;
}

function readPersisted(): Catalog | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { catalog?: Catalog };
    return parsed.catalog && Array.isArray(parsed.catalog.cards) ? parsed.catalog : null;
  } catch {
    return null;
  }
}

function writePersisted(catalog: Catalog): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), catalog }));
  } catch {
    // storage full / unavailable — catalog still works in memory
  }
}

export const useCatalog = create<CatalogState>((set, get) => ({
  catalog: null,
  status: 'idle',
  error: null,

  load: async () => {
    const { status, catalog } = get();
    if (status === 'loading') return;
    if (status === 'ready' && catalog) return;
    const persisted = catalog ?? readPersisted();
    if (persisted) set({ catalog: persisted, status: 'ready' });
    else set({ status: 'loading' });
    try {
      const fresh = await gameApi.getCatalog();
      writePersisted(fresh);
      set({ catalog: fresh, status: 'ready', error: null });
    } catch (err) {
      // Keep the persisted catalog visible if we have one; report the failure honestly.
      const message = err instanceof GameApiError ? err.message : 'Failed to load the card catalog.';
      set(persisted ? { error: message } : { status: 'error', error: message });
    }
  },

  refresh: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading', error: null });
    try {
      const fresh = await gameApi.getCatalog();
      writePersisted(fresh);
      set({ catalog: fresh, status: 'ready', error: null });
    } catch (err) {
      const message = err instanceof GameApiError ? err.message : 'Failed to refresh the card catalog.';
      set({ status: get().catalog ? 'ready' : 'error', error: message });
    }
  },

  byId: (id) => {
    const { catalog } = get();
    return catalog?.cards.find((c) => c.id === id) ?? catalog?.towerTroops.find((c) => c.id === id);
  },
}));
