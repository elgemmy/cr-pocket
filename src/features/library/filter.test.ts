import { describe, expect, it } from 'vitest';
import { makeDeck } from '@/data/testUtils';
import { countInView, deckMatchesQuery, decksInView, filterLibraryDecks } from './filter';
import { relativeTime } from './relativeTime';

const KNOWN: Record<number, string> = {
  26000000: 'Knight',
  26000001: 'Archers',
  26000002: 'Goblins',
  26000003: 'Giant',
  26000004: 'P.E.K.K.A',
  26000005: 'Minions',
  26000006: 'Balloon',
  26000007: 'Witch',
};
const cardNameOf = (id: number) => KNOWN[id];

describe('decksInView', () => {
  const decks = [
    makeDeck({ id: 'a', favorite: true, categoryIds: ['ladder'] }),
    makeDeck({ id: 'b', categoryIds: ['ladder', 'fun'] }),
    makeDeck({ id: 'c', favorite: true }),
  ];

  it('returns everything for the all view', () => {
    expect(decksInView(decks, { kind: 'all' })).toHaveLength(3);
  });

  it('filters favorites', () => {
    expect(decksInView(decks, { kind: 'favorites' }).map((d) => d.id)).toEqual(['a', 'c']);
  });

  it('filters by category membership', () => {
    expect(decksInView(decks, { kind: 'category', id: 'ladder' }).map((d) => d.id)).toEqual(['a', 'b']);
    expect(decksInView(decks, { kind: 'category', id: 'fun' }).map((d) => d.id)).toEqual(['b']);
    expect(decksInView(decks, { kind: 'category', id: 'nope' })).toHaveLength(0);
  });

  it('counts match the view', () => {
    expect(countInView(decks, { kind: 'all' })).toBe(3);
    expect(countInView(decks, { kind: 'favorites' })).toBe(2);
    expect(countInView(decks, { kind: 'category', id: 'ladder' })).toBe(2);
  });
});

describe('deckMatchesQuery', () => {
  const deck = makeDeck({ name: 'Hog Cycle 2.6' });

  it('matches everything on an empty query', () => {
    expect(deckMatchesQuery(deck, '', cardNameOf)).toBe(true);
    expect(deckMatchesQuery(deck, '   ', cardNameOf)).toBe(true);
  });

  it('matches deck name case-insensitively', () => {
    expect(deckMatchesQuery(deck, 'hog', cardNameOf)).toBe(true);
    expect(deckMatchesQuery(deck, 'CYCLE', cardNameOf)).toBe(true);
    expect(deckMatchesQuery(deck, 'zap bait', cardNameOf)).toBe(false);
  });

  it('matches card names from the catalog', () => {
    expect(deckMatchesQuery(deck, 'balloon', cardNameOf)).toBe(true);
    expect(deckMatchesQuery(deck, 'archer', cardNameOf)).toBe(true);
    // Golem (26000009) is not among the deck's slots 26000000–26000007.
    expect(deckMatchesQuery(deck, 'golem', cardNameOf)).toBe(false);
  });

  it('ignores cards the catalog does not know', () => {
    const withUnknown = makeDeck({
      name: 'Mystery',
      slots: Array.from({ length: 8 }, (_, i) => ({ position: i, cardId: 99900000 + i, form: 'base' as const })),
    });
    expect(deckMatchesQuery(withUnknown, 'knight', cardNameOf)).toBe(false);
  });
});

describe('filterLibraryDecks', () => {
  // Distinct slots so card-name matches are deliberate (makeDeck defaults to Knight…Witch).
  const slots = (firstId: number) =>
    Array.from({ length: 8 }, (_, i) => ({ position: i, cardId: firstId + i, form: 'base' as const }));

  it('combines view and query, preserving order', () => {
    const decks = [
      makeDeck({ id: 'a', name: 'Ladder Rush', favorite: true, slots: slots(26000000), updatedAt: 3000 }),
      makeDeck({ id: 'b', name: 'Bridge Spam', slots: slots(99900000), updatedAt: 2000 }),
      makeDeck({ id: 'c', name: 'Bait', slots: slots(26000000), updatedAt: 1000 }),
    ];
    // "Knight" hits a and c via the card in their slots; b's cards are unknown to the catalog.
    expect(filterLibraryDecks(decks, { kind: 'all' }, 'knight', cardNameOf).map((d) => d.id)).toEqual(['a', 'c']);
    expect(filterLibraryDecks(decks, { kind: 'favorites' }, 'knight', cardNameOf).map((d) => d.id)).toEqual(['a']);
    expect(filterLibraryDecks(decks, { kind: 'all' }, 'bridge', cardNameOf).map((d) => d.id)).toEqual(['b']);
  });
});

describe('relativeTime', () => {
  const now = 10_000_000_000;

  it('buckets recent times', () => {
    expect(relativeTime(now, now)).toBe('just now');
    expect(relativeTime(now - 30_000, now)).toBe('just now');
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5m ago');
    expect(relativeTime(now - 2 * 3_600_000, now)).toBe('2h ago');
    expect(relativeTime(now - 3 * 86_400_000, now)).toBe('3d ago');
    expect(relativeTime(now - 14 * 86_400_000, now)).toBe('2w ago');
  });

  it('treats slight future timestamps (clock skew) as just now', () => {
    expect(relativeTime(now + 10_000, now)).toBe('just now');
  });
});
