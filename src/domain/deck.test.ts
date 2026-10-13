import { describe, expect, it } from 'vitest';
import {
  averageElixir,
  createEmptyDeck,
  deckFromPlayed,
  deckSignature,
  DeckError,
  duplicateDeck,
  findDuplicate,
  isComplete,
  lookupFromCatalog,
  newId,
  placeCard,
  removeCard,
  setForm,
  swapSlots,
  touch,
  TOWER_PRINCESS_ID,
  validateDeck,
} from './deck';
import type { Catalog, PlayedDeck } from '@shared/types';
import { completeDeck, fixtureCards, lookupOf, makeCard, makeDeck } from './testing';

const fx = fixtureCards();
const lookup = lookupOf(fx.all);
const catalog: Catalog = { cards: fx.all, towerTroops: [], fetchedAt: '', source: 'demo' };

function deckWith(ids: (number | null)[], forms: Partial<Record<number, import('./types').SlotForm>> = {}) {
  const deck = makeDeck();
  return {
    ...deck,
    slots: deck.slots.map((s, i) => ({
      ...s,
      cardId: ids[i] ?? null,
      form: forms[i] ?? ('base' as const),
    })),
  };
}

// An 8-card deck drawn from the fixture catalog: evo/hero/wild specials + normals.
function playableDeck() {
  return deckWith(
    [
      fx.tesla.id, // evo slot
      fx.electroWizard.id, // hero slot
      fx.knight.id, // wild slot
      fx.skeletons.id,
      28000000,
      28000001,
      28000002,
      28000003,
    ],
    { 0: 'evo', 1: 'hero', 2: 'evo' },
  );
}

describe('TOWER_PRINCESS_ID', () => {
  it('is the observed tower troop id from live copy-deck links', () => {
    expect(TOWER_PRINCESS_ID).toBe(159000000);
  });
});

describe('newId / createEmptyDeck', () => {
  it('generates unique ids', () => {
    expect(newId()).not.toBe(newId());
  });

  it('creates an 8-slot empty draft', () => {
    const deck = createEmptyDeck('abc', 1234);
    expect(deck.id).toBe('abc');
    expect(deck.slots).toHaveLength(8);
    expect(deck.slots.map((s) => s.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(deck.slots.every((s) => s.cardId === null && s.form === 'base')).toBe(true);
    expect(deck.towerTroopId).toBeNull();
    expect(deck.createdAt).toBe(1234);
    expect(deck.updatedAt).toBe(1234);
    expect(isComplete(deck)).toBe(false);
  });
});

describe('isComplete', () => {
  it('requires 8 distinct non-null positive integer ids', () => {
    expect(isComplete(completeDeck())).toBe(true);
    expect(isComplete(deckWith([1, 2, 3, 4, 5, 6, 7, null]))).toBe(false);
    expect(isComplete(deckWith([1, 2, 3, 4, 5, 6, 7, 7]))).toBe(false); // duplicate
    expect(isComplete(deckWith([1, 2, 3, 4, 5, 6, 7, -1]))).toBe(false);
    expect(isComplete(deckWith([1, 2, 3, 4, 5, 6, 7, 1.5]))).toBe(false);
  });
});

describe('validateDeck', () => {
  it('reports empty slots and duplicates as errors', () => {
    const issues = validateDeck(deckWith([1, 2, 3, 4, 5, 6, 7, 7]), lookup);
    expect(issues.some((i) => i.code === 'duplicate_card' && i.severity === 'error')).toBe(true);
    const incomplete = validateDeck(deckWith([1, 2, 3, 4, 5, 6, 7, null]), lookup);
    expect(incomplete.some((i) => i.code === 'incomplete')).toBe(true);
  });

  it('warns (not errors) about cards missing from the catalog', () => {
    const issues = validateDeck(completeDeck(), lookup);
    const unknown = issues.filter((i) => i.code === 'unknown_card');
    expect(unknown.length).toBeGreaterThan(0);
    expect(unknown.every((i) => i.severity === 'warning')).toBe(true);
  });

  it('flags a form the slot role does not allow', () => {
    const deck = deckWith([fx.tesla.id, 2, 3, 4, 5, 6, 7, 8], { 3: 'base' });
    // put tesla in a normal slot with an evo form
    const moved = { ...deck, slots: deck.slots.map((s) => (s.position === 3 ? { ...s, cardId: fx.tesla.id, form: 'evo' as const } : s.position === 0 ? { ...s, cardId: 42 } : s)) };
    const issues = validateDeck(moved, lookup);
    expect(issues.some((i) => i.code === 'form_not_allowed' && i.position === 3)).toBe(true);
  });

  it('warns when a champion sits in an ordinary slot (hero/wild required per support docs)', () => {
    const deck = deckWith([fx.tesla.id, fx.electroWizard.id, 3, fx.goldenKnight.id, 5, 6, 7, 8]);
    const issues = validateDeck(deck, lookup);
    expect(
      issues.some((i) => i.code === 'champion_slot' && i.position === 3 && i.severity === 'warning'),
    ).toBe(true);
  });

  it('accepts a champion in the hero or wild slot', () => {
    const heroDeck = deckWith([fx.tesla.id, fx.goldenKnight.id, 3, 4, 5, 6, 7, 8], { 1: 'champion' });
    expect(validateDeck(heroDeck, lookup).filter((i) => i.code === 'champion_slot')).toHaveLength(0);
    const wildDeck = deckWith([fx.tesla.id, fx.electroWizard.id, fx.goldenKnight.id, 4, 5, 6, 7, 8], {
      2: 'champion',
    });
    expect(validateDeck(wildDeck, lookup).filter((i) => i.code === 'champion_slot')).toHaveLength(0);
  });

  it('warns about unknown tower troops only when a tower lookup is provided', () => {
    const deck = { ...completeDeck(), towerTroopId: 999999 };
    expect(validateDeck(deck).some((i) => i.code === 'unknown_tower_troop')).toBe(false);
    const towerLookup = lookupOf([makeCard({ id: TOWER_PRINCESS_ID, name: 'Tower Princess' })]);
    expect(validateDeck(deck, undefined, towerLookup).some((i) => i.code === 'unknown_tower_troop')).toBe(true);
    const ok = { ...completeDeck(), towerTroopId: TOWER_PRINCESS_ID };
    expect(validateDeck(ok, undefined, towerLookup).some((i) => i.code === 'unknown_tower_troop')).toBe(false);
  });

  it('a valid playable deck has no errors', () => {
    const issues = validateDeck(playableDeck(), lookup);
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });
});

describe('averageElixir', () => {
  it('averages to one decimal', () => {
    // 4+4+3+1 + 4*4 = 28 → 3.5
    expect(averageElixir(playableDeck(), lookupOf([...fx.all, ...[28000000, 28000001, 28000002, 28000003].map((id) => makeCard({ id, elixir: 4 }))]))).toBe(3.5);
  });

  it('rounds correctly', () => {
    // 1+4+3+1 + 4*4 = 25 → 3.125 → 3.1
    const cheapEvo = makeCard({ id: 900, elixir: 1 });
    const lk = lookupOf([...fx.all, cheapEvo, ...[28000000, 28000001, 28000002, 28000003].map((id) => makeCard({ id, elixir: 4 }))]);
    const deck = deckWith([cheapEvo.id, fx.electroWizard.id, fx.knight.id, fx.skeletons.id, 28000000, 28000001, 28000002, 28000003]);
    expect(averageElixir(deck, lk)).toBe(3.1);
  });

  it('returns null when the deck is incomplete', () => {
    expect(averageElixir(makeDeck(), lookup)).toBeNull();
  });

  it('returns null when any card cost is unknown — never invents a cost', () => {
    const deck = deckWith([
      fx.unknownElixir.id,
      fx.electroWizard.id,
      fx.knight.id,
      fx.skeletons.id,
      28000000,
      28000001,
      28000002,
      28000003,
    ]);
    const lk = lookupOf([...fx.all, ...[28000000, 28000001, 28000002, 28000003].map((id) => makeCard({ id, elixir: 4 }))]);
    expect(averageElixir(deck, lk)).toBeNull();
  });
});

describe('placeCard', () => {
  it('places a card with the default form for the slot role', () => {
    let deck = makeDeck();
    deck = placeCard(deck, 0, fx.tesla.id, lookup);
    expect(deck.slots[0]).toMatchObject({ cardId: fx.tesla.id, form: 'evo' });
    deck = placeCard(deck, 1, fx.goldenKnight.id, lookup);
    expect(deck.slots[1]).toMatchObject({ cardId: fx.goldenKnight.id, form: 'champion' });
    deck = placeCard(deck, 3, fx.skeletons.id, lookup);
    expect(deck.slots[3]).toMatchObject({ cardId: fx.skeletons.id, form: 'base' });
  });

  it('assigns base form when the card is unknown to the catalog', () => {
    const deck = placeCard(makeDeck(), 0, 424242, lookup);
    expect(deck.slots[0]).toMatchObject({ cardId: 424242, form: 'base' });
  });

  it('swaps when the card already occupies another slot, keeping ids distinct', () => {
    let deck = deckWith([fx.tesla.id, fx.electroWizard.id, 3, 4, 5, 6, 7, 8], { 0: 'evo', 1: 'hero' });
    deck = placeCard(deck, 3, fx.tesla.id, lookup);
    expect(deck.slots[3]?.cardId).toBe(fx.tesla.id);
    expect(deck.slots[3]?.form).toBe('base'); // evo form downgraded in a normal slot
    expect(deck.slots[0]?.cardId).toBe(4); // swapped content of the target slot
    const ids = deck.slots.map((s) => s.cardId);
    expect(new Set(ids).size).toBe(8);
  });

  it('is a no-op when placing the same card on its own slot', () => {
    const deck = deckWith([fx.tesla.id, 2, 3, 4, 5, 6, 7, 8]);
    expect(placeCard(deck, 0, fx.tesla.id, lookup)).toBe(deck);
  });

  it('rejects invalid positions and ids', () => {
    expect(() => placeCard(makeDeck(), 8, 1)).toThrow(DeckError);
    expect(() => placeCard(makeDeck(), 0, -5)).toThrow(DeckError);
  });
});

describe('removeCard / swapSlots', () => {
  it('clears a slot', () => {
    const deck = removeCard(deckWith([1, 2, 3, 4, 5, 6, 7, 8], { 0: 'base' }), 2);
    expect(deck.slots[2]).toMatchObject({ cardId: null, form: 'base' });
  });

  it('swaps two slots and re-normalizes forms', () => {
    // evo tesla in slot 0, plain card in slot 3 → after swap tesla must be base
    let deck = deckWith([fx.tesla.id, 2, 3, fx.skeletons.id, 5, 6, 7, 8], { 0: 'evo' });
    deck = swapSlots(deck, 0, 3, lookup);
    expect(deck.slots[0]).toMatchObject({ cardId: fx.skeletons.id, form: 'base' });
    expect(deck.slots[3]).toMatchObject({ cardId: fx.tesla.id, form: 'base' });
  });

  it('keeps a valid form when swapping between compatible special slots', () => {
    // evo tesla in evo slot (0) ↔ evo-capable knight in wild slot (2)
    let deck = deckWith([fx.tesla.id, 2, fx.knight.id, 4, 5, 6, 7, 8], { 0: 'evo', 2: 'evo' });
    deck = swapSlots(deck, 0, 2, lookup);
    expect(deck.slots[0]).toMatchObject({ cardId: fx.knight.id, form: 'evo' });
    expect(deck.slots[2]).toMatchObject({ cardId: fx.tesla.id, form: 'evo' });
  });
});

describe('setForm', () => {
  it('sets a valid form', () => {
    const deck = deckWith([fx.knight.id, 2, 3, 4, 5, 6, 7, 8], { 0: 'evo' });
    const next = setForm(deck, 0, 'base', lookup);
    expect(next.slots[0]?.form).toBe('base');
  });

  it('lets the wild slot switch between evo and hero', () => {
    const deck = deckWith([1, 2, fx.knight.id, 4, 5, 6, 7, 8], { 2: 'evo' });
    expect(setForm(deck, 2, 'hero', lookup).slots[2]?.form).toBe('hero');
    expect(setForm(deck, 2, 'base', lookup).slots[2]?.form).toBe('base');
  });

  it('rejects forms the slot or card does not support', () => {
    const deck = deckWith([fx.tesla.id, 2, 3, 4, 5, 6, 7, 8]);
    expect(() => setForm(deck, 0, 'hero', lookup)).toThrow(/not available/); // tesla has no hero
    expect(() => setForm(deck, 3, 'evo', lookup)).toThrow(DeckError); // normal slot
  });

  it('rejects form changes on empty slots and unknown cards', () => {
    expect(() => setForm(makeDeck(), 0, 'evo', lookup)).toThrow(/empty slot/);
    const unknown = deckWith([424242, 2, 3, 4, 5, 6, 7, 8]);
    expect(() => setForm(unknown, 0, 'evo', lookup)).toThrow(/not in the current catalog/);
    expect(setForm(unknown, 0, 'base', lookup).slots[0]?.form).toBe('base');
  });
});

describe('duplicateDeck / touch', () => {
  it('creates an independent copy with new id, " copy" suffix and fresh timestamps', () => {
    const original = playableDeck();
    const copy = duplicateDeck(original, 9999, 'new-id');
    expect(copy.id).toBe('new-id');
    expect(copy.name).toBe(`${original.name} copy`);
    expect(copy.createdAt).toBe(9999);
    expect(copy.updatedAt).toBe(9999);
    expect(copy.slots).toEqual(original.slots);
    copy.slots[0]!.form = 'base';
    expect(original.slots[0]?.form).toBe('evo'); // deep enough copy
  });

  it('touch bumps only updatedAt', () => {
    const deck = makeDeck();
    const touched = touch(deck, 5555);
    expect(touched.updatedAt).toBe(5555);
    expect(touched.createdAt).toBe(deck.createdAt);
  });
});

describe('deckFromPlayed', () => {
  const source = { kind: 'player' as const, playerTag: '#ABC', playerName: 'Ash', context: 'current' as const };

  it('maps a clean observed deck to evo/hero/wild slots', () => {
    const played: PlayedDeck = {
      cards: [
        { id: fx.tesla.id, form: 'evo' },
        { id: fx.electroWizard.id, form: 'hero' },
        { id: fx.skeletons.id, form: 'base' },
        { id: 28000000, form: 'base' },
        { id: 28000001, form: 'base' },
        { id: 28000002, form: 'base' },
        { id: 28000003, form: 'base' },
        { id: 28000004, form: 'base' },
      ],
      towerTroopId: TOWER_PRINCESS_ID,
      playedAt: null,
      mode: null,
    };
    const { deck, needsFormReview } = deckFromPlayed(played, lookup, source, 123);
    expect(needsFormReview).toBe(false);
    expect(deck.slots[0]).toMatchObject({ cardId: fx.tesla.id, form: 'evo' });
    expect(deck.slots[1]).toMatchObject({ cardId: fx.electroWizard.id, form: 'hero' });
    expect(deck.slots[2]).toMatchObject({ cardId: fx.skeletons.id, form: 'base' });
    expect(deck.towerTroopId).toBe(TOWER_PRINCESS_ID);
    expect(deck.name).toBe("Ash's deck");
    expect(isComplete(deck)).toBe(true);
  });

  it('champions land in the hero slot with champion form even when the API says base', () => {
    const played: PlayedDeck = {
      cards: [
        { id: fx.tesla.id, form: 'evo' },
        { id: fx.goldenKnight.id, form: 'base' }, // API form for champions is not 'champion'
        { id: fx.skeletons.id, form: 'base' },
        { id: 28000000, form: 'base' },
        { id: 28000001, form: 'base' },
        { id: 28000002, form: 'base' },
        { id: 28000003, form: 'base' },
        { id: 28000004, form: 'base' },
      ],
      towerTroopId: null,
      playedAt: null,
      mode: null,
    };
    const { deck } = deckFromPlayed(played, lookup, source, 1);
    expect(deck.slots[1]).toMatchObject({ cardId: fx.goldenKnight.id, form: 'champion' });
  });

  it('a second evo goes to the wild slot and flags needsFormReview (ambiguous arrangement)', () => {
    const played: PlayedDeck = {
      cards: [
        { id: fx.tesla.id, form: 'evo' },
        { id: fx.knight.id, form: 'evo' },
        { id: fx.skeletons.id, form: 'base' },
        { id: 28000000, form: 'base' },
        { id: 28000001, form: 'base' },
        { id: 28000002, form: 'base' },
        { id: 28000003, form: 'base' },
        { id: 28000004, form: 'base' },
      ],
      towerTroopId: null,
      playedAt: null,
      mode: null,
    };
    const { deck, needsFormReview } = deckFromPlayed(played, lookup, source, 1);
    expect(needsFormReview).toBe(true);
    expect(deck.slots[0]?.form).toBe('evo');
    expect(deck.slots[2]).toMatchObject({ cardId: fx.knight.id, form: 'evo' });
  });

  it('overflow specials beyond the 3 special slots are downgraded to base and flagged', () => {
    const played: PlayedDeck = {
      cards: [
        { id: fx.tesla.id, form: 'evo' },
        { id: fx.knight.id, form: 'evo' },
        { id: fx.electroWizard.id, form: 'hero' },
        { id: fx.goldenKnight.id, form: 'base' }, // champion → 2nd hero-type, wild
        { id: 28000000, form: 'base' },
        { id: 28000001, form: 'base' },
        { id: 28000002, form: 'base' },
        // 4 specials total: evo, evo, hero, champion — one too many
        { id: 28000003, form: 'evo' }, // unknown card with an evo form: overflow
      ],
      towerTroopId: null,
      playedAt: null,
      mode: null,
    };
    const { deck, needsFormReview } = deckFromPlayed(played, lookup, source, 1);
    expect(needsFormReview).toBe(true);
    expect(deck.slots.filter((s) => s.form !== 'base')).toHaveLength(3);
    expect(isComplete(deck)).toBe(true);
    // every card preserved
    expect(new Set(deck.slots.map((s) => s.cardId)).size).toBe(8);
  });

  it('preserves unknown card ids instead of dropping them', () => {
    const played: PlayedDeck = {
      cards: Array.from({ length: 8 }, (_, i) => ({ id: 999000 + i, form: 'base' as const })),
      towerTroopId: null,
      playedAt: null,
      mode: null,
    };
    const { deck } = deckFromPlayed(played, lookupOf([]), { kind: 'link' }, 1);
    expect(isComplete(deck)).toBe(true);
    expect(deck.slots.map((s) => s.cardId)).toContain(999000);
  });

  it('throws on non-8-card records', () => {
    const played: PlayedDeck = {
      cards: [{ id: 1, form: 'base' }],
      towerTroopId: null,
      playedAt: null,
      mode: null,
    };
    expect(() => deckFromPlayed(played, lookup, source, 1)).toThrow(DeckError);
  });

  it('keeps towerTroopId null when the API does not report one', () => {
    const played: PlayedDeck = {
      cards: Array.from({ length: 8 }, (_, i) => ({ id: 100 + i, form: 'base' as const })),
      towerTroopId: null,
      playedAt: null,
      mode: null,
    };
    expect(deckFromPlayed(played, lookup, source, 1).deck.towerTroopId).toBeNull();
  });
});

describe('deckSignature / findDuplicate', () => {
  it('same cards + forms + tower troop ⇒ same signature, regardless of ordinary order', () => {
    const a = deckWith([1, 2, 3, 4, 5, 6, 7, 8], { 0: 'evo' });
    const shuffled = deckWith([1, 2, 3, 8, 7, 6, 5, 4], { 0: 'evo' });
    expect(deckSignature(a)).toBe(deckSignature(shuffled));
  });

  it('different forms are distinct variants', () => {
    const evo = deckWith([1, 2, 3, 4, 5, 6, 7, 8], { 0: 'evo' });
    const base = deckWith([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(deckSignature(evo)).not.toBe(deckSignature(base));
  });

  it('different tower troops are distinct variants', () => {
    const a = { ...completeDeck(), towerTroopId: TOWER_PRINCESS_ID };
    const b = { ...completeDeck(), towerTroopId: 159000001 };
    const c = completeDeck(); // null tower troop
    expect(deckSignature(a)).not.toBe(deckSignature(b));
    expect(deckSignature(a)).not.toBe(deckSignature(c));
  });

  it('findDuplicate ignores the candidate itself', () => {
    const deck = completeDeck({ id: 'self' });
    const library = [deck, { ...completeDeck({ id: 'other' }) }];
    expect(findDuplicate(library, deck)?.id).toBe('other');
    expect(findDuplicate([deck], deck)).toBeUndefined();
  });
});

describe('lookupFromCatalog', () => {
  it('builds a lookup from a catalog', () => {
    const lk = lookupFromCatalog(catalog);
    expect(lk(fx.tesla.id)?.name).toBe('Tesla');
    expect(lk(424242)).toBeUndefined();
  });
});
