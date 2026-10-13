import type { Deck } from '@/domain/types';

/** Minimal valid deck factory for data-layer tests. */
export function makeDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: overrides.id ?? `deck-${Math.random().toString(36).slice(2, 8)}`,
    schemaVersion: 1,
    name: 'Test Deck',
    notes: '',
    favorite: false,
    slots: Array.from({ length: 8 }, (_, i) => ({
      position: i,
      cardId: 26000000 + i,
      form: 'base' as const,
    })),
    towerTroopId: null,
    categoryIds: [],
    source: { kind: 'manual' },
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}
