/**
 * Test fixtures for the domain modules (not shipped in UI code).
 */
import type { CatalogCard, OwnedCard } from '@shared/types';
import type { Deck, DeckSlot, SlotForm } from './types';
import type { CardLookup } from './deck';

let counter = 0;

export function makeCard(partial: Partial<CatalogCard> = {}): CatalogCard {
  counter += 1;
  return {
    id: 26000000 + counter,
    name: `Card ${counter}`,
    elixir: 3,
    rarity: 'common',
    maxLevel: 16,
    canEvo: false,
    canHero: false,
    isChampion: false,
    art: { base: `https://art/${26000000 + counter}.png`, evo: null, hero: null },
    ...partial,
  };
}

/** Realistic fixture set covering every form capability combination. */
export function fixtureCards(): {
  knight: CatalogCard; // evo + hero
  tesla: CatalogCard; // evo only
  electroWizard: CatalogCard; // hero only
  skeletons: CatalogCard; // plain
  goldenKnight: CatalogCard; // champion
  unknownElixir: CatalogCard;
  all: CatalogCard[];
} {
  const knight = makeCard({
    id: 26000000,
    name: 'Knight',
    elixir: 3,
    canEvo: true,
    canHero: true,
    art: {
      base: 'https://art/knight.png',
      evo: 'https://art/knight-evo.png',
      hero: 'https://art/knight-hero.png',
    },
  });
  const tesla = makeCard({
    id: 27000006,
    name: 'Tesla',
    elixir: 4,
    canEvo: true,
    art: { base: 'https://art/tesla.png', evo: 'https://art/tesla-evo.png', hero: null },
  });
  const electroWizard = makeCard({
    id: 26000042,
    name: 'Electro Wizard',
    elixir: 4,
    canHero: true,
    // hero art missing on purpose, to exercise fallback
    art: { base: 'https://art/ewiz.png', evo: null, hero: null },
  });
  const skeletons = makeCard({ id: 26000010, name: 'Skeletons', elixir: 1 });
  const goldenKnight = makeCard({
    id: 26000074,
    name: 'Golden Knight',
    elixir: 4,
    rarity: 'champion',
    isChampion: true,
    art: { base: 'https://art/gk.png', evo: null, hero: 'https://art/gk-hero.png' },
  });
  const unknownElixir = makeCard({ id: 26999999, name: 'Mystery', elixir: null });
  return {
    knight,
    tesla,
    electroWizard,
    skeletons,
    goldenKnight,
    unknownElixir,
    all: [knight, tesla, electroWizard, skeletons, goldenKnight, unknownElixir],
  };
}

export function lookupOf(cards: CatalogCard[]): CardLookup {
  const map = new Map(cards.map((c) => [c.id, c]));
  return (id) => map.get(id);
}

export function makeOwned(partial: Partial<OwnedCard> = {}): OwnedCard {
  return { id: 26000000, level: 11, evoUnlocked: false, heroUnlocked: false, ...partial };
}

export function makeDeck(partial: Partial<Deck> = {}): Deck {
  const slots: DeckSlot[] = Array.from({ length: 8 }, (_, position) => ({
    position,
    cardId: null,
    form: 'base' as SlotForm,
  }));
  return {
    id: 'deck-1',
    schemaVersion: 1,
    name: 'Test deck',
    notes: '',
    favorite: false,
    slots,
    towerTroopId: null,
    categoryIds: [],
    source: { kind: 'manual' },
    createdAt: 1000,
    updatedAt: 1000,
    ...partial,
  };
}

/** A complete 8-card deck; fills any empty slot with a dummy id (100+position). */
export function completeDeck(partial: Partial<Deck> = {}): Deck {
  const { slots, ...rest } = partial;
  const base = makeDeck(rest);
  const filled = (slots ?? base.slots).map((s, i) => ({ ...s, cardId: s.cardId ?? 100 + i }));
  return { ...base, slots: filled };
}
