import { beforeEach, describe, expect, it } from 'vitest';
import type { Deck } from '@/domain/types';
import { createEmptyDeck, isComplete, TOWER_PRINCESS_ID } from '@/domain/deck';
import { fixtureCards, lookupOf, makeDeck } from '@/domain/testing';
import {
  draftKeyFor,
  editorDeckEquals,
  editorDirty,
  emptySlotCount,
  firstEmptySlot,
  formatRelativeAge,
  loadDraft,
  reduceEditor,
  saveDraft,
  smartTargetSlot,
  type EditorState,
} from './editorState';

const cards = fixtureCards();
const lookup = lookupOf(cards.all);

function freshState(deck?: Deck): EditorState {
  const d = deck ?? createEmptyDeck('deck-x', 1000);
  return { deck: d, baseline: null, initial: d, activeSlot: null, swapSource: null };
}

describe('smartTargetSlot', () => {
  it('prefers the Evo slot for evo-capable cards', () => {
    const deck = createEmptyDeck('d', 1);
    expect(smartTargetSlot(deck, cards.tesla)).toBe(0);
  });

  it('prefers the Hero slot for hero-only cards and champions', () => {
    const deck = createEmptyDeck('d', 1);
    expect(smartTargetSlot(deck, cards.electroWizard)).toBe(1);
    expect(smartTargetSlot(deck, cards.goldenKnight)).toBe(1);
  });

  it('falls back to the first empty slot for plain cards', () => {
    const deck = createEmptyDeck('d', 1);
    expect(smartTargetSlot(deck, cards.skeletons)).toBe(0);
  });

  it('skips occupied special slots', () => {
    let deck = createEmptyDeck('d', 1);
    deck = { ...deck, slots: deck.slots.map((s) => (s.position === 0 ? { ...s, cardId: cards.tesla.id, form: 'evo' as const } : s)) };
    // Evo slot taken: another evo card goes to the first empty slot (1).
    expect(smartTargetSlot(deck, cards.knight)).toBe(1);
    // A hero-only card still finds its Hero slot.
    expect(smartTargetSlot(deck, cards.electroWizard)).toBe(1);
  });

  it('returns null when the deck is full', () => {
    const deck: Deck = {
      ...createEmptyDeck('d', 1),
      slots: createEmptyDeck('d', 1).slots.map((s, i) => ({ ...s, cardId: 100 + i })),
    };
    expect(smartTargetSlot(deck, cards.knight)).toBeNull();
  });
});

describe('reduceEditor — galleryTap', () => {
  it('places into the active slot and auto-activates the next empty slot', () => {
    let s = freshState();
    s = reduceEditor(s, { type: 'slotTap', position: 3 }, lookup);
    expect(s.activeSlot).toBe(3);
    s = reduceEditor(s, { type: 'galleryTap', cardId: cards.skeletons.id }, lookup);
    expect(s.deck.slots[3]!.cardId).toBe(cards.skeletons.id);
    expect(s.activeSlot).toBe(0); // first empty slot auto-activates
  });

  it('keeps the target active when the deck just filled up (replace mode)', () => {
    let deck = createEmptyDeck('d', 1);
    deck = {
      ...deck,
      slots: deck.slots.map((s, i) => (i === 7 ? s : { ...s, cardId: 100 + i })),
    };
    let s = freshState(deck);
    s = reduceEditor(s, { type: 'galleryTap', cardId: cards.skeletons.id }, lookup);
    expect(isComplete(s.deck)).toBe(true);
    expect(s.activeSlot).toBe(7);
    // A further tap replaces that same slot.
    s = reduceEditor(s, { type: 'galleryTap', cardId: cards.tesla.id }, lookup);
    expect(s.deck.slots[7]!.cardId).toBe(cards.tesla.id);
    expect(s.deck.slots[7]!.form).toBe('base'); // ordinary slot normalizes the form
  });

  it('selects the slot of an already-placed card instead of duplicating', () => {
    let s = freshState();
    s = reduceEditor(s, { type: 'galleryTap', cardId: cards.knight.id }, lookup);
    expect(s.deck.slots[0]!.cardId).toBe(cards.knight.id);
    s = reduceEditor(s, { type: 'galleryTap', cardId: cards.knight.id }, lookup);
    expect(s.activeSlot).toBe(0);
    expect(s.deck.slots.filter((sl) => sl.cardId === cards.knight.id)).toHaveLength(1);
  });

  it('tapping an in-deck card selects its slot even when another slot is active', () => {
    let s = freshState();
    s = reduceEditor(s, { type: 'galleryTap', cardId: cards.knight.id }, lookup); // → slot 0
    s = reduceEditor(s, { type: 'galleryTap', cardId: cards.skeletons.id }, lookup); // → slot 1
    expect(s.deck.slots[1]!.cardId).toBe(cards.skeletons.id);
    // Slot 3 selected, then tapping Knight (already placed) selects Knight's slot.
    s = reduceEditor(s, { type: 'slotTap', position: 3 }, lookup);
    s = reduceEditor(s, { type: 'galleryTap', cardId: cards.knight.id }, lookup);
    expect(s.activeSlot).toBe(0);
    expect(s.deck.slots[3]!.cardId).toBeNull();
    expect(s.deck.slots[0]!.cardId).toBe(cards.knight.id);
  });

  it('is a no-op on a full deck with no active slot', () => {
    const deck: Deck = {
      ...createEmptyDeck('d', 1),
      slots: createEmptyDeck('d', 1).slots.map((s, i) => ({ ...s, cardId: 100 + i })),
    };
    const s = freshState(deck);
    const next = reduceEditor({ ...s, activeSlot: null }, { type: 'galleryTap', cardId: cards.knight.id }, lookup);
    expect(next.deck).toBe(s.deck);
  });
});

describe('reduceEditor — swap / remove / forms', () => {
  it('armSwap + slotTap swaps two slots and re-normalizes forms', () => {
    let s = freshState();
    s = reduceEditor(s, { type: 'galleryTap', cardId: cards.tesla.id }, lookup); // evo slot, form evo
    s = reduceEditor(s, { type: 'galleryTap', cardId: cards.skeletons.id }, lookup);
    expect(s.deck.slots[0]!.form).toBe('evo');
    s = reduceEditor(s, { type: 'armSwap', position: 0 }, lookup);
    expect(s.swapSource).toBe(0);
    s = reduceEditor(s, { type: 'slotTap', position: 5 }, lookup);
    expect(s.swapSource).toBeNull();
    expect(s.deck.slots[5]!.cardId).toBe(cards.tesla.id);
    expect(s.deck.slots[5]!.form).toBe('base'); // ordinary slot restores base portrait
    expect(s.deck.slots[0]!.cardId).toBeNull(); // swapped with an empty slot
  });

  it('tapping the armed slot again cancels the swap', () => {
    let s = freshState();
    s = reduceEditor(s, { type: 'armSwap', position: 2 }, lookup);
    s = reduceEditor(s, { type: 'slotTap', position: 2 }, lookup);
    expect(s.swapSource).toBeNull();
  });

  it('remove empties the slot and activates it for a quick refill', () => {
    let s = freshState();
    s = reduceEditor(s, { type: 'galleryTap', cardId: cards.knight.id }, lookup);
    s = reduceEditor(s, { type: 'remove', position: 0 }, lookup);
    expect(s.deck.slots[0]!.cardId).toBeNull();
    expect(s.activeSlot).toBe(0);
  });

  it('setForm switches a dual-form Wild slot between evo and hero', () => {
    let deck = createEmptyDeck('d', 1);
    deck = {
      ...deck,
      slots: deck.slots.map((sl) =>
        sl.position === 2 ? { ...sl, cardId: cards.knight.id, form: 'evo' as const } : sl,
      ),
    };
    let s = freshState(deck);
    s = reduceEditor(s, { type: 'setForm', position: 2, form: 'hero' }, lookup);
    expect(s.deck.slots[2]!.form).toBe('hero');
    s = reduceEditor(s, { type: 'setForm', position: 2, form: 'evo' }, lookup);
    expect(s.deck.slots[2]!.form).toBe('evo');
  });

  it('setTowerTroop / rename / setNotes update the deck', () => {
    let s = freshState();
    s = reduceEditor(s, { type: 'setTowerTroop', id: TOWER_PRINCESS_ID }, lookup);
    expect(s.deck.towerTroopId).toBe(TOWER_PRINCESS_ID);
    s = reduceEditor(s, { type: 'rename', name: 'Ladder push' }, lookup);
    s = reduceEditor(s, { type: 'setNotes', notes: 'try poison' }, lookup);
    expect(s.deck.name).toBe('Ladder push');
    expect(s.deck.notes).toBe('try poison');
  });
});

describe('dirty tracking', () => {
  it('a pristine new deck is not dirty; edits make it dirty; saved clears it', () => {
    let s = freshState();
    expect(editorDirty(s)).toBe(false);
    s = reduceEditor(s, { type: 'galleryTap', cardId: cards.knight.id }, lookup);
    expect(editorDirty(s)).toBe(true);
    s = reduceEditor(s, { type: 'saved', deck: s.deck }, lookup);
    expect(editorDirty(s)).toBe(false);
  });

  it('existing decks compare against the baseline, ignoring timestamps and category order', () => {
    const stored = { ...makeDeck({ name: 'A' }), categoryIds: ['x', 'y'], updatedAt: 5 };
    const s: EditorState = { deck: { ...stored, updatedAt: 999 }, baseline: stored, initial: stored, activeSlot: null, swapSource: null };
    expect(editorDirty(s)).toBe(false);
    const reordered: EditorState = { ...s, deck: { ...s.deck, categoryIds: ['y', 'x'] } };
    expect(editorDirty(reordered)).toBe(false);
    const renamed: EditorState = { ...s, deck: { ...s.deck, name: 'B' } };
    expect(editorDirty(renamed)).toBe(true);
  });

  it('editorDeckEquals detects form and tower-troop changes', () => {
    const a = makeDeck();
    expect(editorDeckEquals(a, { ...a, towerTroopId: TOWER_PRINCESS_ID })).toBe(false);
    const slots = a.slots.map((sl, i) => (i === 0 ? { ...sl, form: 'evo' as const } : sl));
    expect(editorDeckEquals(a, { ...a, slots })).toBe(false);
  });
});

describe('draft persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a draft per route key', () => {
    const deck = createEmptyDeck('d1', 1);
    saveDraft('new', deck, 1000);
    const env = loadDraft('new', 2000);
    expect(env?.savedAt).toBe(1000);
    expect(env?.deck.id).toBe('d1');
    expect(loadDraft('other', 2000)).toBeNull();
    expect(draftKeyFor('new')).not.toBe(draftKeyFor('abc'));
  });

  it('expires drafts older than the TTL', () => {
    saveDraft('new', createEmptyDeck('d1', 1), 1000);
    const now = 1000 + 8 * 24 * 60 * 60 * 1000;
    expect(loadDraft('new', now)).toBeNull();
    expect(localStorage.getItem(draftKeyFor('new'))).toBeNull();
  });

  it('rejects corrupt or malformed drafts', () => {
    localStorage.setItem(draftKeyFor('new'), '{not json');
    expect(loadDraft('new')).toBeNull();
    localStorage.setItem(draftKeyFor('new'), JSON.stringify({ savedAt: 1, deck: { id: 'x', slots: [] } }));
    expect(loadDraft('new')).toBeNull();
  });
});

describe('formatRelativeAge', () => {
  it('formats minutes, hours, days', () => {
    const now = 1_000_000_000;
    expect(formatRelativeAge(now, now)).toBe('just now');
    expect(formatRelativeAge(now, now - 5 * 60_000)).toBe('5m ago');
    expect(formatRelativeAge(now, now - 3 * 3_600_000)).toBe('3h ago');
    expect(formatRelativeAge(now, now - 2 * 86_400_000)).toBe('2d ago');
    expect(formatRelativeAge(now, now + 1000)).toBe('just now'); // clock skew clamps
  });
});

describe('firstEmptySlot / emptySlotCount', () => {
  it('reports the first empty position and the count', () => {
    const deck = createEmptyDeck('d', 1);
    expect(firstEmptySlot(deck)).toBe(0);
    expect(emptySlotCount(deck)).toBe(8);
    const filled: Deck = { ...deck, slots: deck.slots.map((s) => ({ ...s, cardId: 200 + s.position })) };
    expect(firstEmptySlot(filled)).toBeNull();
    expect(emptySlotCount(filled)).toBe(0);
  });
});
