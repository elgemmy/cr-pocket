import { useMemo } from 'react';
import type { CatalogCard, OwnedCard, PlayedDeck } from '@shared/types';
import type { Deck, SlotForm } from '@/domain/types';
import type { CardLookup } from '@/domain/deck';
import { ownershipWarning } from '@/domain/slots';
import { useCatalog } from '@/game/catalogStore';
import { useMyCollection } from '@/game/myCollectionStore';
import type { CardArtOwnership, DeckPreviewCard } from '@/ui';

export interface CardContext {
  /** Main-deck cards by id. */
  lookup: CardLookup;
  /** Tower troops by id. */
  towerLookup: CardLookup;
  cards: CatalogCard[];
  towerTroops: CatalogCard[];
  catalogReady: boolean;
  /**
   * The signed-in user's own collection, or null when no tag is set / not loaded.
   * When non-null, a missing id means "not owned".
   */
  owned: Map<number, OwnedCard> | null;
}

/** Catalog + the signed-in user's own collection (never a browsed player's). */
export function useCardContext(): CardContext {
  const catalog = useCatalog((s) => s.catalog);
  const owned = useMyCollection((s) => s.owned);
  const collectionStatus = useMyCollection((s) => s.status);
  const tag = useMyCollection((s) => s.tag);

  return useMemo(() => {
    const cards = catalog?.cards ?? [];
    const towerTroops = catalog?.towerTroops ?? [];
    const byId = new Map(cards.map((c) => [c.id, c]));
    const towerById = new Map(towerTroops.map((c) => [c.id, c]));
    const hasCollection = Boolean(tag) && collectionStatus === 'ready' && owned.size > 0;
    return {
      lookup: (id: number) => byId.get(id),
      towerLookup: (id: number) => towerById.get(id),
      cards,
      towerTroops,
      catalogReady: Boolean(catalog),
      owned: hasCollection ? owned : null,
    };
  }, [catalog, owned, collectionStatus, tag]);
}

/** Map an owned-collection entry to the arg shape `ownershipWarning` expects. */
export function ownedArg(owned: Map<number, OwnedCard> | null, id: number): OwnedCard | null | undefined {
  if (!owned) return undefined;
  return owned.get(id) ?? null;
}

export function cardOwnership(
  card: CatalogCard | undefined,
  form: SlotForm,
  owned: Map<number, OwnedCard> | null,
): CardArtOwnership | undefined {
  if (!card || !owned) return undefined;
  return ownershipWarning(card, form, ownedArg(owned, card.id)) ?? 'owned';
}

export function cardLevel(owned: Map<number, OwnedCard> | null, id: number | null): number | null | undefined {
  if (!owned || id == null) return undefined;
  return owned.get(id)?.level ?? null;
}

/** Preview cards for a saved/draft deck, in slot order. */
export function deckPreviewCards(deck: Pick<Deck, 'slots'>, ctx: CardContext): DeckPreviewCard[] {
  return deck.slots.map((slot) => {
    if (slot.cardId == null) return { card: null };
    const card = ctx.lookup(slot.cardId) ?? null;
    return {
      card,
      unknownId: card ? undefined : slot.cardId,
      form: slot.form,
      level: cardLevel(ctx.owned, slot.cardId),
      ownership: cardOwnership(card ?? undefined, slot.form, ctx.owned),
    };
  });
}

/** Preview cards for an API-observed deck (forms are what the player had active). */
export function playedPreviewCards(played: PlayedDeck, ctx: CardContext): DeckPreviewCard[] {
  return played.cards.map((c) => {
    const card = ctx.lookup(c.id) ?? null;
    const form: SlotForm = c.form === 'base' && card?.isChampion ? 'champion' : c.form;
    return {
      card,
      unknownId: card ? undefined : c.id,
      form,
      level: cardLevel(ctx.owned, c.id),
      ownership: cardOwnership(card ?? undefined, form, ctx.owned),
    };
  });
}
