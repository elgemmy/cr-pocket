/**
 * Editor state: a tiny reducer around the pure domain functions in
 * src/domain/deck.ts so every UI interaction (tap-to-place, swap, forms)
 * stays predictable and unit-testable. No framework imports.
 */
import type { CatalogCard } from '@shared/types';
import type { Deck, SlotForm } from '@/domain/types';
import { placeCard, removeCard, swapSlots, setForm, type CardLookup } from '@/domain/deck';
import { DECK_SIZE, EVO_POSITION, HERO_POSITION } from '@/domain/slots';

export interface EditorState {
  /** Working copy (may be an unsaved draft). */
  deck: Deck;
  /** Last persisted snapshot; null for a brand-new deck. */
  baseline: Deck | null;
  /** The deck as loaded/created — dirty reference for unsaved new decks. */
  initial: Deck;
  /** Slot waiting for a gallery pick (or the replace target). */
  activeSlot: number | null;
  /** "Swap with…" armed from this slot position. */
  swapSource: number | null;
}

export type EditorAction =
  | { type: 'slotTap'; position: number }
  | { type: 'galleryTap'; cardId: number }
  | { type: 'remove'; position: number }
  | { type: 'setForm'; position: number; form: SlotForm }
  | { type: 'armSwap'; position: number | null }
  | { type: 'setTowerTroop'; id: number | null }
  | { type: 'rename'; name: string }
  | { type: 'setNotes'; notes: string }
  | { type: 'setCategories'; ids: string[] }
  | { type: 'saved'; deck: Deck };

export function firstEmptySlot(deck: Deck): number | null {
  const slot = deck.slots.find((s) => s.cardId == null);
  return slot ? slot.position : null;
}

export function emptySlotCount(deck: Deck): number {
  return deck.slots.filter((s) => s.cardId == null).length;
}

/**
 * Where a gallery tap drops a card when no slot is active. Cards that *can*
 * use a special form prefer their matching empty special slot (Evo-capable →
 * Evo slot, Hero/Champion → Hero slot), everything else fills the first empty
 * slot. Returns null when the deck is full.
 */
export function smartTargetSlot(deck: Deck, card: CatalogCard | undefined): number | null {
  const empty = deck.slots.filter((s) => s.cardId == null).map((s) => s.position);
  if (empty.length === 0) return null;
  if (card?.canEvo && empty.includes(EVO_POSITION)) return EVO_POSITION;
  if ((card?.canHero || card?.isChampion) && empty.includes(HERO_POSITION)) return HERO_POSITION;
  return Math.min(...empty);
}

export function reduceEditor(state: EditorState, action: EditorAction, lookup: CardLookup): EditorState {
  switch (action.type) {
    case 'slotTap': {
      const { position } = action;
      if (state.swapSource != null) {
        if (state.swapSource === position) return { ...state, swapSource: null };
        return {
          ...state,
          deck: swapSlots(state.deck, state.swapSource, position, lookup),
          swapSource: null,
          activeSlot: null,
        };
      }
      return { ...state, activeSlot: position };
    }

    case 'galleryTap': {
      const inDeck = state.deck.slots.find((s) => s.cardId === action.cardId);
      if (inDeck) {
        // Already placed: select its slot so it can be managed/replaced.
        return { ...state, activeSlot: inDeck.position, swapSource: null };
      }
      const target = state.activeSlot ?? smartTargetSlot(state.deck, lookup(action.cardId));
      if (target == null) return state; // full deck with no selection — UI shows a hint
      const deck = placeCard(state.deck, target, action.cardId, lookup);
      // Auto-activate the next empty slot; when the deck just filled up, keep
      // the target active so further gallery taps keep replacing it.
      return { ...state, deck, activeSlot: firstEmptySlot(deck) ?? target, swapSource: null };
    }

    case 'remove': {
      const deck = removeCard(state.deck, action.position);
      return { ...state, deck, activeSlot: action.position, swapSource: null };
    }

    case 'setForm':
      return { ...state, deck: setForm(state.deck, action.position, action.form, lookup) };

    case 'armSwap':
      return { ...state, swapSource: action.position };

    case 'setTowerTroop':
      return { ...state, deck: { ...state.deck, towerTroopId: action.id } };

    case 'rename':
      return { ...state, deck: { ...state.deck, name: action.name } };

    case 'setNotes':
      return { ...state, deck: { ...state.deck, notes: action.notes } };

    case 'setCategories':
      return { ...state, deck: { ...state.deck, categoryIds: action.ids } };

    case 'saved':
      return { ...state, baseline: action.deck, initial: action.deck };

    default:
      return state;
  }
}

/** Equality for dirty tracking: every user-editable field, ignoring timestamps. */
export function editorDeckEquals(a: Deck, b: Deck): boolean {
  if (a.name !== b.name || a.notes !== b.notes || a.favorite !== b.favorite) return false;
  if (a.towerTroopId !== b.towerTroopId) return false;
  if (a.slots.length !== b.slots.length) return false;
  for (let i = 0; i < a.slots.length; i += 1) {
    const sa = a.slots[i]!;
    const sb = b.slots[i]!;
    if (sa.cardId !== sb.cardId || sa.form !== sb.form) return false;
  }
  const catA = [...a.categoryIds].sort();
  const catB = [...b.categoryIds].sort();
  return catA.length === catB.length && catA.every((c, i) => c === catB[i]);
}

/** Dirty = the working copy differs from the saved deck (or from the fresh template). */
export function editorDirty(state: EditorState): boolean {
  return !editorDeckEquals(state.deck, state.baseline ?? state.initial);
}

/* ---------------------------------------------------------------------------
 * Unsaved-draft persistence (per route: 'new' or the deck id).
 * Drafts protect against accidental reloads; a newer saved deck always wins
 * over a stale draft (compare savedAt vs the deck's updatedAt).
 * ------------------------------------------------------------------------ */

const DRAFT_PREFIX = 'crpocket:draft:v1:';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface DraftEnvelope {
  savedAt: number;
  deck: Deck;
}

export function draftKeyFor(routeKey: string): string {
  return DRAFT_PREFIX + routeKey;
}

function isDraftDeckShape(deck: unknown): deck is Deck {
  const d = deck as Partial<Deck> | null;
  return Boolean(
    d &&
      typeof d.id === 'string' &&
      typeof d.name === 'string' &&
      Array.isArray(d.slots) &&
      d.slots.length === DECK_SIZE,
  );
}

export function loadDraft(routeKey: string, now: number = Date.now()): DraftEnvelope | null {
  try {
    const raw = localStorage.getItem(draftKeyFor(routeKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DraftEnvelope>;
    if (typeof parsed?.savedAt !== 'number' || !isDraftDeckShape(parsed.deck)) return null;
    if (now - parsed.savedAt > DRAFT_TTL_MS) {
      clearDraft(routeKey);
      return null;
    }
    return { savedAt: parsed.savedAt, deck: parsed.deck };
  } catch {
    return null;
  }
}

export function saveDraft(routeKey: string, deck: Deck, now: number = Date.now()): void {
  try {
    const envelope: DraftEnvelope = { savedAt: now, deck };
    localStorage.setItem(draftKeyFor(routeKey), JSON.stringify(envelope));
  } catch {
    // storage full/unavailable — drafts are a safety net, never a blocker
  }
}

export function clearDraft(routeKey: string): void {
  try {
    localStorage.removeItem(draftKeyFor(routeKey));
  } catch {
    // best effort
  }
}

/* ------------------------------ small helpers ---------------------------- */

/** "just now" / "5m ago" / "3h ago" / "2d ago" — for the collection header. */
export function formatRelativeAge(now: number, then: number): string {
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
