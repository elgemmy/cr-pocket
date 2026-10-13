/**
 * Turn a parsed deck link into a CR Pocket draft deck.
 *
 * - Official `clashroyale://copyDeck` links carry card ids in slot order
 *   (observed: index 0 = Evo, 1 = Hero, 2 = Wild) but NO active forms — we
 *   honor the order 1:1 and keep forms base, except Champions in the
 *   Hero/Wild slot which display their champion form. Nothing to review.
 * - RoyaleAPI URLs carry form markers (-ev1 / -hero) but no slot order, so we
 *   reuse the played-deck inference; ambiguous special-slot placement sets
 *   `needsFormReview` and the editor prompts the user (spec F5).
 */
import type { ApiForm, PlayedDeck, SlotForm } from '@shared/types';
import { deckFromPlayed, newId, type CardLookup, type DeckFromPlayedResult } from '@/domain/deck';
import type { ParsedDeckLink } from '@/domain/link';
import { HERO_POSITION, WILD_POSITION } from '@/domain/slots';
import type { Deck, DeckSlot } from '@/domain/types';

function toApiForm(form: SlotForm): ApiForm {
  if (form === 'evo') return 'evo';
  if (form === 'hero' || form === 'champion') return 'hero';
  return 'base';
}

export function draftFromParsedLink(
  parsed: ParsedDeckLink,
  lookup: CardLookup,
  now: number = Date.now(),
): DeckFromPlayedResult {
  if (parsed.source === 'official' && parsed.specialSlotHint) {
    const slots: DeckSlot[] = parsed.cardIds.map((id, position) => {
      const card = lookup(id);
      const form: SlotForm =
        card?.isChampion && (position === HERO_POSITION || position === WILD_POSITION) ? 'champion' : 'base';
      return { position, cardId: id, form };
    });
    const deck: Deck = {
      id: newId(),
      schemaVersion: 1,
      name: 'Imported deck',
      notes: '',
      favorite: false,
      slots,
      towerTroopId: parsed.towerTroopId,
      categoryIds: [],
      source: { kind: 'link' },
      createdAt: now,
      updatedAt: now,
    };
    return { deck, needsFormReview: false };
  }

  // RoyaleAPI (or a link without slot hints): forms known, order unknown.
  const played: PlayedDeck = {
    cards: parsed.cardIds.map((id, i) => ({ id, form: toApiForm(parsed.forms[i] ?? 'base') })),
    towerTroopId: parsed.towerTroopId,
    playedAt: null,
    mode: null,
  };
  return deckFromPlayed(played, lookup, { kind: 'link' }, now);
}
