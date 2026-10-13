/**
 * Slot roles and special-form rules (March 2026 deck slot rework).
 *
 * Verified rules (see docs/deck-link-notes.md for sources):
 * - 8-card deck: 1 Evolution slot (Evolutions only), 1 Hero slot (Heroes and
 *   Champions), 1 Wild slot (Evolutions, Heroes, Champions), 5 ordinary slots.
 * - In the Wild slot a card with both Evo and Hero forms activates the
 *   Evolution by default; the player can switch forms in-game.
 * - Supercell support: "To use special card forms or Champion Cards, you'll
 *   need to place them in the right slot in your deck." — we read this as
 *   Champions requiring the Hero or Wild slot; a Champion in an ordinary slot
 *   is surfaced as a *warning* (validateDeck), never a hard block, because the
 *   exact in-game behaviour still needs a real-device check.
 */
import type { CatalogCard, OwnedCard } from '@shared/types';
import type { Deck, DeckSlot, SlotForm, SlotRole } from './types';

export const DECK_SIZE = 8;
export const EVO_POSITION = 0;
export const HERO_POSITION = 1;
export const WILD_POSITION = 2;

/** Slot roles derive from position: 0 = Evo, 1 = Hero, 2 = Wild, 3..7 = ordinary. */
export function slotRole(position: number): SlotRole {
  if (position === EVO_POSITION) return 'evo';
  if (position === HERO_POSITION) return 'hero';
  if (position === WILD_POSITION) return 'wild';
  if (position >= 3 && position < DECK_SIZE) return 'normal';
  throw new RangeError(`Invalid slot position: ${position}`);
}

export const SLOT_LABELS: Record<SlotRole, string> = {
  evo: 'Evo',
  hero: 'Hero',
  wild: 'Wild',
  normal: 'Normal',
};

export const FORM_LABELS: Record<SlotForm, string> = {
  base: 'Base',
  evo: 'Evo',
  hero: 'Hero',
  champion: 'Champion',
};

/** Forms that can be *activated* in a slot of the given role for this card. */
export function allowedForms(role: SlotRole, card: CatalogCard): SlotForm[] {
  const forms: SlotForm[] = ['base'];
  switch (role) {
    case 'evo':
      if (card.canEvo) forms.push('evo');
      break;
    case 'hero':
      if (card.canHero) forms.push('hero');
      if (card.isChampion) forms.push('champion');
      break;
    case 'wild':
      // Wild = union of Evo / Hero / Champion, whichever applies to the card.
      if (card.canEvo) forms.push('evo');
      if (card.canHero) forms.push('hero');
      if (card.isChampion) forms.push('champion');
      break;
    case 'normal':
      break;
  }
  return forms;
}

export function isFormAllowed(role: SlotRole, form: SlotForm, card: CatalogCard): boolean {
  return allowedForms(role, card).includes(form);
}

/**
 * Form the game activates by default when the card sits in this slot.
 * Wild slot defaults to Evolution when a card has both forms (per RoyaleAPI's
 * mid-March 2026 update notes); Champions become 'champion' in Hero/Wild.
 */
export function defaultFormFor(role: SlotRole, card: CatalogCard): SlotForm {
  switch (role) {
    case 'evo':
      return card.canEvo ? 'evo' : 'base';
    case 'hero':
      if (card.isChampion) return 'champion';
      return card.canHero ? 'hero' : 'base';
    case 'wild':
      if (card.isChampion) return 'champion';
      if (card.canEvo) return 'evo';
      if (card.canHero) return 'hero';
      return 'base';
    case 'normal':
      return 'base';
  }
}

/**
 * Keep a form if the destination role allows it, otherwise downgrade to 'base'
 * (e.g. moving an Evo card into an ordinary slot restores the base portrait).
 */
export function normalizeFormForRole(role: SlotRole, form: SlotForm, card: CatalogCard): SlotForm {
  return isFormAllowed(role, form, card) ? form : 'base';
}

/**
 * Re-normalize every occupied slot's form against its role. Cards missing from
 * the catalog are left untouched (the catalog may just be outdated — never
 * corrupt saved data because of it). Returns the deck unchanged-in-place shape:
 * a new Deck object only when something changed.
 */
export function normalizeFormsOnMove(
  deck: Deck,
  lookup: (id: number) => CatalogCard | undefined,
): Deck {
  let changed = false;
  const slots = deck.slots.map((slot) => {
    if (slot.cardId == null || slot.form === 'base') return slot;
    const card = lookup(slot.cardId);
    if (!card) return slot;
    const next = normalizeFormForRole(slotRole(slot.position), slot.form, card);
    if (next === slot.form) return slot;
    changed = true;
    return { ...slot, form: next };
  });
  return changed ? { ...deck, slots } : deck;
}

export interface Portrait {
  url: string | null;
  /** true when the requested form's art was missing and base art is shown. */
  usedFallback: boolean;
}

/**
 * Artwork for a slot. Evo uses art.evo, Hero/Champion use art.hero, with the
 * base portrait as fallback (and `usedFallback` set) when the alternate asset
 * is missing. Never returns a different card's art.
 */
export function portraitFor(card: CatalogCard, form: SlotForm): Portrait {
  let url: string | null = null;
  if (form === 'evo') url = card.art.evo;
  else if (form === 'hero' || form === 'champion') url = card.art.hero;
  if (url != null) return { url, usedFallback: false };
  return { url: card.art.base, usedFallback: form !== 'base' };
}

export type OwnershipWarning = 'unknown' | 'not_owned' | 'form_locked';

/**
 * Ownership hint for a slot (warn, never block — aspirational decks are legal).
 * - `owned === undefined`: no profile/collection loaded → 'unknown'
 * - `owned === null`: collection loaded, card absent → 'not_owned'
 * - form unlocked flags come from the collection `evolutionLevel` bit field.
 * Champions have no separate unlock flag in OwnedCard: owning the card is enough.
 */
export function ownershipWarning(
  card: CatalogCard,
  form: SlotForm,
  owned?: OwnedCard | null,
): OwnershipWarning | null {
  if (owned === undefined) return 'unknown';
  if (owned === null) return 'not_owned';
  if (form === 'evo' && card.canEvo && !owned.evoUnlocked) return 'form_locked';
  if (form === 'hero' && card.canHero && !owned.heroUnlocked) return 'form_locked';
  return null;
}

/** Helper for UI: the role a slot currently displays, from its position. */
export function slotRoleOf(slot: DeckSlot): SlotRole {
  return slotRole(slot.position);
}
