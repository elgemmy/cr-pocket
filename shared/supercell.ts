/**
 * Raw Supercell Clash Royale API response shapes, as actually observed on the wire
 * (see docs/api-notes.md for sources). Everything here is optional-tolerant: the API
 * omits fields rather than sending nulls in many places, so treat absence as normal.
 *
 * These types describe what we *consume*, not the complete upstream schema.
 */

export interface ScIconUrls {
  /** Always present on cards. */
  medium?: string;
  /** Present iff the card has an Evolution form (`maxEvolutionLevel & 1`). */
  evolutionMedium?: string;
  /** Present iff the card has a Hero form (`maxEvolutionLevel & 2`). */
  heroMedium?: string;
  [variant: string]: string | undefined;
}

/** Catalog card shape from `GET /v1/cards` (`items` and `supportItems`). */
export interface ScCatalogCard {
  name?: string;
  id?: number;
  /** Rarity-relative API level cap (common 16, rare 14, epic 11, legendary 8, champion 6). */
  maxLevel?: number;
  /** Bit field: 1 = Evo-capable, 2 = Hero-capable, 3 = both. Absent = neither. Tower Troops omit it. */
  maxEvolutionLevel?: number;
  /** Absent on some cards (e.g. Mirror) and on all Tower Troops. */
  elixirCost?: number;
  iconUrls?: ScIconUrls;
  /** Lowercase: common | rare | epic | legendary | champion */
  rarity?: string;
}

export interface ScCardsResponse {
  items?: ScCatalogCard[];
  /** Tower Troops (no elixirCost / maxEvolutionLevel). */
  supportItems?: ScCatalogCard[];
}

/**
 * Card as it appears inside a player profile (`cards`, `currentDeck`,
 * `currentDeckSupportCards`, `supportCards`) or a battle-log participant
 * (`cards`, `supportCards`). All catalog fields plus player state.
 */
export interface ScPlayerCard extends ScCatalogCard {
  /** Rarity-relative level (normalize with `level + (16 - maxLevel)`). */
  level?: number;
  /**
   * Bit field (1 = Evo, 2 = Hero, 3 = both). Semantics depend on the array:
   * - `cards[]` (collection): unlocked forms (3 possible).
   * - `currentDeck[]` / battle-log `cards`: active/played-as form (never 3).
   */
  evolutionLevel?: number;
  /** Copies in stash; 0 for maxed or currently-equipped cards. Volatile. */
  count?: number;
  /** Cosmetic star level. */
  starLevel?: number;
}

export interface ScArena {
  id?: number;
  name?: string;
  rawName?: string;
}

export interface ScClan {
  tag?: string;
  name?: string;
  badgeId?: number;
}

/** `GET /v1/players/{playerTag}` (subset we use). */
export interface ScPlayer {
  tag?: string;
  name?: string;
  /** Deprecated by Supercell in 2026; reported for completeness only. */
  expLevel?: number;
  kingTowerLevel?: number;
  trophies?: number;
  bestTrophies?: number;
  arena?: ScArena;
  /** Absent entirely when the player has no clan. */
  clan?: ScClan;
  role?: string;
  /** Up to 8 cards; 7-card and empty decks occur in the wild. */
  currentDeck?: ScPlayerCard[];
  /** The one Tower Troop in the current deck; sometimes `[]`. */
  currentDeckSupportCards?: ScPlayerCard[];
  /** Full card collection with levels. */
  cards?: ScPlayerCard[];
  /** Tower Troops collection with levels. */
  supportCards?: ScPlayerCard[];
  [extra: string]: unknown;
}

/** One participant in a battle (`team[]` / `opponent[]`; 2 entries per side in 2v2). */
export interface ScBattleParticipant {
  tag?: string;
  name?: string;
  crowns?: number;
  /** Played deck; 8 cards for standard modes, 12 for boat defense, 16/24 for duels, [] for some events. */
  cards?: ScPlayerCard[];
  /** Tower Troop used; may be `[]`. */
  supportCards?: ScPlayerCard[];
  startingTrophies?: number;
  trophyChange?: number;
  clan?: ScClan;
  [extra: string]: unknown;
}

/** One entry of `GET /v1/players/{playerTag}/battlelog` (a bare array, no paging). */
export interface ScBattle {
  /** e.g. PvP, pathOfLegend, trail, clanMate, clanMate2v2, riverRaceDuel, boatBattle, unknown */
  type?: string;
  /** `YYYYMMDDTHHmmss.sssZ` (no dashes/colons). */
  battleTime?: string;
  arena?: ScArena;
  gameMode?: { id?: number; name?: string };
  deckSelection?: string;
  team?: ScBattleParticipant[];
  opponent?: ScBattleParticipant[];
  [extra: string]: unknown;
}

export type ScBattleLog = ScBattle[];
