/**
 * Contracts shared by the Pages Functions (`functions/`) and the web client (`src/`).
 * Everything here is normalized, app-facing data. Raw Supercell API shapes live in
 * `shared/supercell.ts` and are converted by `shared/normalize.ts`.
 */

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'champion';

/** Active form of a card inside a deck slot. `champion` = a Champion card active in a Hero-capable slot. */
export type SlotForm = 'base' | 'evo' | 'hero' | 'champion';

/** Form flags reported by the API (`evolutionLevel` bit field: 1 = evo, 2 = hero). */
export type ApiForm = 'base' | 'evo' | 'hero';

export interface CardArt {
  base: string | null;
  evo: string | null;
  hero: string | null;
}

export interface CatalogCard {
  id: number;
  name: string;
  /** null when the API does not report a cost (e.g. some special cards). */
  elixir: number | null;
  rarity: Rarity;
  /** In-game max level on the current scale (normalized). */
  maxLevel: number;
  /** Card has an Evolution form in the current catalog. */
  canEvo: boolean;
  /** Card has a Hero form in the current catalog. */
  canHero: boolean;
  isChampion: boolean;
  art: CardArt;
}

export interface Catalog {
  cards: CatalogCard[];
  towerTroops: CatalogCard[];
  fetchedAt: string;
  source: 'live' | 'demo';
}

export interface OwnedCard {
  id: number;
  /** Normalized to the current in-game level scale. null = unknown. */
  level: number | null;
  /** Unlocked forms from the collection `evolutionLevel` bit field. */
  evoUnlocked: boolean;
  heroUnlocked: boolean;
}

export interface PlayedCard {
  id: number;
  /** Form the player actually had active when this deck was observed. */
  form: ApiForm;
}

export interface PlayerSummary {
  tag: string;
  name: string;
  trophies: number | null;
  bestTrophies: number | null;
  arena: string | null;
  expLevel: number | null;
  clan: { tag: string; name: string } | null;
}

export interface PlayedDeck {
  /** Eight cards in the order the API returned them. */
  cards: PlayedCard[];
  towerTroopId: number | null;
  /** ISO timestamp of the observation (battle time); null for the current deck. */
  playedAt: string | null;
  /** Human-readable game mode / battle type, when known. */
  mode: string | null;
}

export interface PlayerProfile {
  summary: PlayerSummary;
  /** null when the player's current deck is empty or not a valid 8-card deck. */
  currentDeck: PlayedDeck | null;
  collection: OwnedCard[];
  towerTroops: OwnedCard[];
  fetchedAt: string;
  source: 'live' | 'demo';
}

export interface PlayerBattleDecks {
  tag: string;
  /** Deduplicated, most recent first. Only the searched player's own 8-card decks. */
  decks: PlayedDeck[];
  /** Battle entries skipped (unsupported format, not 8 cards, player not found in team, …). */
  skipped: number;
  fetchedAt: string;
  source: 'live' | 'demo';
}

export type ApiErrorCode = 'bad_tag' | 'not_found' | 'rate_limited' | 'upstream' | 'not_configured' | 'offline';

export interface ApiErrorBody {
  error: ApiErrorCode;
  message: string;
}
