/**
 * Pure library filtering/search helpers (spec F3) — unit-tested, no React.
 */
import type { Deck } from '@/domain/types';

/** Which slice of the library is on screen. */
export type LibraryView = { kind: 'all' } | { kind: 'favorites' } | { kind: 'category'; id: string };

/** Decks belonging to a view (before text search). Input order is preserved. */
export function decksInView(decks: Deck[], view: LibraryView): Deck[] {
  switch (view.kind) {
    case 'all':
      return decks;
    case 'favorites':
      return decks.filter((d) => d.favorite);
    case 'category':
      return decks.filter((d) => d.categoryIds.includes(view.id));
  }
}

/** Number of decks in a view (used for chip counts). */
export function countInView(decks: Deck[], view: LibraryView): number {
  return decksInView(decks, view).length;
}

/**
 * True when a deck matches the search text: deck name OR any of its eight
 * card names (case-insensitive substring). Card names come from the catalog
 * via `cardNameOf`; unknown cards simply don't contribute a name.
 * An empty/whitespace query matches everything.
 */
export function deckMatchesQuery(
  deck: Deck,
  query: string,
  cardNameOf: (cardId: number) => string | undefined,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (deck.name.toLowerCase().includes(q)) return true;
  for (const slot of deck.slots) {
    if (slot.cardId == null) continue;
    const name = cardNameOf(slot.cardId);
    if (name && name.toLowerCase().includes(q)) return true;
  }
  return false;
}

/** View filter + text search, in one pass. Order (updatedAt desc) is preserved. */
export function filterLibraryDecks(
  decks: Deck[],
  view: LibraryView,
  query: string,
  cardNameOf: (cardId: number) => string | undefined,
): Deck[] {
  return decksInView(decks, view).filter((d) => deckMatchesQuery(d, query, cardNameOf));
}
