/**
 * Deck domain logic: creation, editing, validation, import from API-observed
 * decks, and identity (signature/dedup). Pure functions; no framework imports.
 */
import type { Catalog, CatalogCard, PlayedDeck, PlayedCard } from '@shared/types';
import type { Deck, DeckSlot, DeckSource, SlotForm } from './types';
import {
  DECK_SIZE,
  defaultFormFor,
  isFormAllowed,
  normalizeFormForRole,
  slotRole,
} from './slots';

/**
 * Tower Princess card id in the official API (tower troops live in the
 * 159xxxxxx range). Matches every observed copy-deck link
 * (`&tt=159000000`, see docs/deck-link-notes.md) — still verify against a live
 * /v1/cards response before trusting it in production.
 */
export const TOWER_PRINCESS_ID = 159000000;

/** Lookup abstraction so callers can pass a Catalog, a Map, or their own cache. */
export type CardLookup = (id: number) => CatalogCard | undefined;

export function lookupFromCatalog(catalog: Pick<Catalog, 'cards'>): CardLookup {
  const byId = new Map(catalog.cards.map((c) => [c.id, c]));
  return (id) => byId.get(id);
}

export class DeckError extends Error {
  readonly code:
    | 'invalid_position'
    | 'invalid_card_id'
    | 'empty_slot'
    | 'form_not_allowed'
    | 'wrong_count';
  constructor(code: DeckError['code'], message: string) {
    super(message);
    this.name = 'DeckError';
    this.code = code;
  }
}

export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Fallback for environments without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function emptySlots(): DeckSlot[] {
  return Array.from({ length: DECK_SIZE }, (_, position) => ({
    position,
    cardId: null,
    form: 'base' as SlotForm,
  }));
}

/** A fresh, unsaved editor draft: 8 empty slots, no tower troop, manual source. */
export function createEmptyDeck(id: string, now: number): Deck {
  return {
    id,
    schemaVersion: 1,
    name: 'New deck',
    notes: '',
    favorite: false,
    slots: emptySlots(),
    towerTroopId: null,
    categoryIds: [],
    source: { kind: 'manual' },
    createdAt: now,
    updatedAt: now,
  };
}

function isValidCardId(id: unknown): id is number {
  return typeof id === 'number' && Number.isInteger(id) && id > 0;
}

/** True when the deck has exactly 8 distinct, non-null, positive-integer card ids. */
export function isComplete(deck: Deck): boolean {
  if (deck.slots.length !== DECK_SIZE) return false;
  const ids = new Set<number>();
  for (const slot of deck.slots) {
    if (slot.cardId == null || !isValidCardId(slot.cardId)) return false;
    if (ids.has(slot.cardId)) return false;
    ids.add(slot.cardId);
  }
  return true;
}

export type DeckIssueCode =
  | 'incomplete'
  | 'invalid_card_id'
  | 'duplicate_card'
  | 'unknown_card'
  | 'form_not_allowed'
  | 'champion_slot'
  | 'unknown_tower_troop';

export interface DeckIssue {
  code: DeckIssueCode;
  severity: 'error' | 'warning';
  position?: number;
  cardId?: number;
  message: string;
}

/**
 * Structural + catalog validation. Never mutates. Unknown cards are a *warning*
 * (the catalog may be outdated; saved data must survive). A Champion sitting in
 * the Evo or an ordinary slot is a *warning* too: support docs say Champions
 * need the Hero or Wild slot, but exact in-game behaviour is unverified.
 */
export function validateDeck(
  deck: Deck,
  lookup?: CardLookup,
  towerLookup?: CardLookup,
): DeckIssue[] {
  const issues: DeckIssue[] = [];
  const seen = new Map<number, number>();

  if (deck.slots.length !== DECK_SIZE) {
    issues.push({
      code: 'incomplete',
      severity: 'error',
      message: `Deck has ${deck.slots.length} slots, expected ${DECK_SIZE}.`,
    });
  }

  for (const slot of deck.slots) {
    if (slot.cardId == null) {
      issues.push({
        code: 'incomplete',
        severity: 'error',
        position: slot.position,
        message: `Slot ${slot.position} is empty.`,
      });
      continue;
    }
    if (!isValidCardId(slot.cardId)) {
      issues.push({
        code: 'invalid_card_id',
        severity: 'error',
        position: slot.position,
        cardId: slot.cardId,
        message: `Slot ${slot.position} has an invalid card id.`,
      });
      continue;
    }
    const firstSeen = seen.get(slot.cardId);
    if (firstSeen !== undefined) {
      issues.push({
        code: 'duplicate_card',
        severity: 'error',
        position: slot.position,
        cardId: slot.cardId,
        message: `Card ${slot.cardId} appears in slots ${firstSeen} and ${slot.position}.`,
      });
    } else {
      seen.set(slot.cardId, slot.position);
    }

    const card = lookup?.(slot.cardId);
    if (lookup && !card) {
      issues.push({
        code: 'unknown_card',
        severity: 'warning',
        position: slot.position,
        cardId: slot.cardId,
        message: `Card ${slot.cardId} is not in the current catalog.`,
      });
      continue;
    }
    if (card) {
      const role = slotRole(slot.position);
      if (!isFormAllowed(role, slot.form, card)) {
        issues.push({
          code: 'form_not_allowed',
          severity: 'error',
          position: slot.position,
          cardId: slot.cardId,
          message: `Form '${slot.form}' is not available in the ${role} slot for ${card.name}.`,
        });
      }
      if (card.isChampion && (role === 'evo' || role === 'normal')) {
        issues.push({
          code: 'champion_slot',
          severity: 'warning',
          position: slot.position,
          cardId: slot.cardId,
          message: `${card.name} is a Champion and can only be used in the Hero or Wild slot.`,
        });
      }
    }
  }

  if (deck.towerTroopId != null) {
    if (!isValidCardId(deck.towerTroopId)) {
      issues.push({
        code: 'unknown_tower_troop',
        severity: 'warning',
        message: `Tower troop id ${deck.towerTroopId} is invalid.`,
      });
    } else if (towerLookup && !towerLookup(deck.towerTroopId)) {
      issues.push({
        code: 'unknown_tower_troop',
        severity: 'warning',
        message: `Tower troop ${deck.towerTroopId} is not in the current catalog.`,
      });
    }
  }

  return issues;
}

/**
 * Average elixir across the 8 cards, rounded to one decimal. Returns null when
 * the deck is incomplete or any card cost is unknown — never invent a cost.
 */
export function averageElixir(deck: Deck, lookup: CardLookup): number | null {
  if (!isComplete(deck)) return null;
  let sum = 0;
  for (const slot of deck.slots) {
    const cost = lookup(slot.cardId as number)?.elixir;
    if (cost == null) return null;
    sum += cost;
  }
  return Math.round((sum / DECK_SIZE) * 10) / 10;
}

function withSlot(deck: Deck, position: number, slot: DeckSlot): Deck {
  const slots = deck.slots.map((s) => (s.position === position ? slot : s));
  return { ...deck, slots };
}

function assertPosition(position: number): void {
  if (!Number.isInteger(position) || position < 0 || position >= DECK_SIZE) {
    throw new DeckError('invalid_position', `Invalid slot position: ${position}`);
  }
}

/** Normalize one occupied slot's form against its role. */
function normalizedSlot(slot: DeckSlot, lookup?: CardLookup): DeckSlot {
  if (slot.cardId == null) return { ...slot, form: 'base' };
  const card = lookup?.(slot.cardId);
  if (!card) return slot; // unknown card: preserve as-is
  const form = normalizeFormForRole(slotRole(slot.position), slot.form, card);
  return form === slot.form ? slot : { ...slot, form };
}

/**
 * Place a card into a slot. If the card already occupies another slot the two
 * slots swap contents (cards stay distinct). Fresh placements get the slot's
 * default form (e.g. a Champion dropped on the Hero slot becomes 'champion');
 * forms are re-normalized against the destination role.
 */
export function placeCard(
  deck: Deck,
  position: number,
  cardId: number,
  lookup?: CardLookup,
): Deck {
  assertPosition(position);
  if (!isValidCardId(cardId)) {
    throw new DeckError('invalid_card_id', `Invalid card id: ${cardId}`);
  }
  const target = deck.slots[position];
  if (!target) throw new DeckError('invalid_position', `Invalid slot position: ${position}`);
  if (target.cardId === cardId) return deck;

  const existing = deck.slots.find((s) => s.cardId === cardId);
  let next: Deck;
  if (existing) {
    // Swap the two slots' contents.
    next = withSlot(deck, position, { ...target, cardId, form: existing.form });
    next = withSlot(next, existing.position, {
      ...existing,
      cardId: target.cardId,
      form: target.cardId == null ? 'base' : target.form,
    });
  } else {
    const card = lookup?.(cardId);
    const form = card ? defaultFormFor(slotRole(position), card) : 'base';
    next = withSlot(deck, position, { ...target, cardId, form });
  }

  // Re-normalize the affected slots.
  const slots = next.slots.map((s) =>
    s.position === position || s.position === existing?.position ? normalizedSlot(s, lookup) : s,
  );
  return { ...next, slots };
}

/** Clear a slot (back to an empty draft slot). */
export function removeCard(deck: Deck, position: number): Deck {
  assertPosition(position);
  const slot = deck.slots[position];
  if (!slot) throw new DeckError('invalid_position', `Invalid slot position: ${position}`);
  if (slot.cardId == null) return deck;
  return withSlot(deck, position, { ...slot, cardId: null, form: 'base' });
}

/** Swap two slots' cards; forms are re-normalized against the new roles. */
export function swapSlots(deck: Deck, a: number, b: number, lookup?: CardLookup): Deck {
  assertPosition(a);
  assertPosition(b);
  if (a === b) return deck;
  const slotA = deck.slots[a];
  const slotB = deck.slots[b];
  if (!slotA || !slotB) throw new DeckError('invalid_position', 'Invalid slot position');
  let next = withSlot(deck, a, { ...slotA, cardId: slotB.cardId, form: slotB.form });
  next = withSlot(next, b, { ...slotB, cardId: slotA.cardId, form: slotA.form });
  const slots = next.slots.map((s) =>
    s.position === a || s.position === b ? normalizedSlot(s, lookup) : s,
  );
  return { ...next, slots };
}

/** Set the active form of an occupied slot, validating against the slot role. */
export function setForm(
  deck: Deck,
  position: number,
  form: SlotForm,
  lookup?: CardLookup,
): Deck {
  assertPosition(position);
  const slot = deck.slots[position];
  if (!slot) throw new DeckError('invalid_position', `Invalid slot position: ${position}`);
  if (slot.cardId == null) {
    throw new DeckError('empty_slot', `Cannot set a form on empty slot ${position}.`);
  }
  const card = lookup?.(slot.cardId);
  if (card && !isFormAllowed(slotRole(position), form, card)) {
    throw new DeckError(
      'form_not_allowed',
      `Form '${form}' is not available in the ${slotRole(position)} slot for ${card.name}.`,
    );
  }
  if (!card && form !== 'base') {
    // Unknown card (outdated catalog): don't invent form support.
    throw new DeckError(
      'form_not_allowed',
      `Card ${slot.cardId} is not in the current catalog; only 'base' form is safe.`,
    );
  }
  return withSlot(deck, position, { ...slot, form });
}

/** Independent copy: new id, "<name> copy", fresh timestamps. */
export function duplicateDeck(deck: Deck, now: number, id: string = newId()): Deck {
  return {
    ...deck,
    id,
    name: `${deck.name} copy`,
    slots: deck.slots.map((s) => ({ ...s })),
    categoryIds: [...deck.categoryIds],
    source: { ...deck.source },
    createdAt: now,
    updatedAt: now,
  };
}

/** Bump updatedAt (call after any user edit you intend to persist). */
export function touch(deck: Deck, now: number): Deck {
  return { ...deck, updatedAt: now };
}

export interface DeckFromPlayedResult {
  deck: Deck;
  /**
   * true when special-slot placement had to be guessed (e.g. two Evo cards —
   * the API does not tell us which one sat in the Evo slot vs the Wild slot),
   * or when detected forms exceeded the available special slots and some were
   * downgraded. The UI should prompt the user to review the Evo/Hero/Wild slots.
   */
  needsFormReview: boolean;
}

type SpecialKind = 'evo' | 'hero';

function effectiveForm(played: PlayedCard, card: CatalogCard | undefined): SlotForm {
  // A Champion card is always its champion form when it occupies a special slot.
  if (card?.isChampion) return 'champion';
  // Trust the observed API form even if the catalog doesn't know the form yet
  // (outdated catalog must not corrupt observed data).
  if (played.form === 'evo') return 'evo';
  if (played.form === 'hero') return 'hero';
  return 'base';
}

/**
 * Convert an API-observed deck (8 cards + played forms) into CR Pocket slots.
 *
 * Inference: the first Evo-active card takes the Evo slot, the first
 * Hero/Champion takes the Hero slot, and one remaining special takes the Wild
 * slot. The API does not report *which* special slot a card occupied, so when
 * two cards share a special kind (two Evos, or two Hero-form cards) the exact
 * arrangement is a guess → `needsFormReview: true`. Specials that don't fit in
 * the three special slots are downgraded to base (and also trigger review).
 * Unknown card ids are preserved as base-form cards.
 */
export function deckFromPlayed(
  played: PlayedDeck,
  lookup: CardLookup,
  source: DeckSource,
  now: number = Date.now(),
): DeckFromPlayedResult {
  if (played.cards.length !== DECK_SIZE) {
    throw new DeckError(
      'wrong_count',
      `PlayedDeck has ${played.cards.length} cards, expected ${DECK_SIZE}.`,
    );
  }

  interface Entry {
    played: PlayedCard;
    form: SlotForm;
    kind: SpecialKind | null;
  }
  const entries: Entry[] = played.cards.map((pc) => {
    const form = effectiveForm(pc, lookup(pc.id));
    const kind: SpecialKind | null = form === 'evo' ? 'evo' : form === 'hero' || form === 'champion' ? 'hero' : null;
    return { played: pc, form, kind };
  });

  const evoEntries = entries.filter((e) => e.kind === 'evo');
  const heroEntries = entries.filter((e) => e.kind === 'hero');

  let needsFormReview = evoEntries.length > 1 || heroEntries.length > 1;

  // Pre-assign the special slots; everything else fills the remaining
  // positions (including unused special slots) in API order.
  const preassigned = new Map<number, Entry>();
  if (evoEntries[0]) preassigned.set(0, evoEntries[0]);
  if (heroEntries[0]) preassigned.set(1, heroEntries[0]);
  const wildCandidate = evoEntries[1] ?? heroEntries[1];
  if (wildCandidate) preassigned.set(2, wildCandidate);

  const assignedSet = new Set(preassigned.values());
  const queue = entries.filter((e) => !assignedSet.has(e));

  const slots: DeckSlot[] = [];
  for (let position = 0; position < DECK_SIZE; position += 1) {
    const pre = preassigned.get(position);
    if (pre) {
      slots.push({ position, cardId: pre.played.id, form: pre.form });
      continue;
    }
    const entry = queue.shift();
    if (!entry) {
      // Defensive: 8 cards and ≤3 pre-assignments always fill 8 slots.
      slots.push({ position, cardId: null, form: 'base' });
      continue;
    }
    if (entry.kind !== null) {
      // A special that did not fit the three special slots: downgrade to base
      // (game-invalid otherwise) and flag for review.
      needsFormReview = true;
    }
    slots.push({ position, cardId: entry.played.id, form: entry.kind === null ? entry.form : 'base' });
  }

  const name =
    source.kind === 'player' && source.playerName ? `${source.playerName}'s deck` : 'Imported deck';

  const deck: Deck = {
    id: newId(),
    schemaVersion: 1,
    name,
    notes: '',
    favorite: false,
    slots,
    // null = unknown; the UI shows the Tower Princess default in that case.
    towerTroopId: played.towerTroopId,
    categoryIds: [],
    source,
    createdAt: now,
    updatedAt: now,
  };
  return { deck, needsFormReview };
}

/**
 * Identity signature for dedup: the set of card ids *with their active forms*
 * plus the tower troop. Same 8 cards with a different Evo/Hero/Wild
 * configuration or a different Tower Troop = a distinct deck variant.
 * (Slot positions of ordinary cards do not affect identity.)
 */
export function deckSignature(deck: Deck): string {
  const cards = deck.slots
    .filter((s): s is DeckSlot & { cardId: number } => s.cardId != null)
    .map((s) => `${s.cardId}:${s.form}`)
    .sort();
  // null means "default Tower Princess" across the app, so an explicit Princess id is the same variant.
  const tt = deck.towerTroopId == null || deck.towerTroopId === TOWER_PRINCESS_ID ? 'default' : deck.towerTroopId;
  return `${cards.join(';')}|tt:${tt}`;
}

/** First library deck that is the same variant as `candidate` (ignoring its own id). */
export function findDuplicate(decks: Deck[], candidate: Deck): Deck | undefined {
  const sig = deckSignature(candidate);
  return decks.find((d) => d.id !== candidate.id && deckSignature(d) === sig);
}
