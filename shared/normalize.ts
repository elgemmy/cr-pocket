/**
 * Pure normalization: raw Supercell API shapes (`shared/supercell.ts`) → app-facing
 * contracts (`shared/types.ts`). Used identically by the Pages Functions (live mode)
 * and the client (demo mode), so both stay in agreement.
 *
 * Rules and sources are documented in docs/api-notes.md. Key ones:
 * - Level normalization: `normalized = level + (LEVEL_CAP - maxLevel)` using the card's
 *   own rarity-relative `maxLevel`. Missing level or maxLevel → null (never invented).
 * - `evolutionLevel` / `maxEvolutionLevel` are bit fields: 1 = Evo, 2 = Hero, 3 = both.
 *   Collection arrays = unlocked forms; deck/battle arrays = active/played-as form.
 */

import type {
  ApiForm,
  Catalog,
  CatalogCard,
  OwnedCard,
  PlayedCard,
  PlayedDeck,
  PlayerBattleDecks,
  PlayerProfile,
  PlayerSummary,
  Rarity,
} from './types';
import type {
  ScBattle,
  ScBattleLog,
  ScBattleParticipant,
  ScCardsResponse,
  ScCatalogCard,
  ScPlayer,
  ScPlayerCard,
} from './supercell';

/** Current in-game level cap on the normalized scale (all rarities top out here). */
export const LEVEL_CAP = 16;

/** Characters that actually occur in Clash Royale player tags (no 1, I, O, ...). */
export const TAG_CHARS = '0289PYLQGRJCUV';
const TAG_RE = new RegExp(`^#?[${TAG_CHARS}]{3,14}$`, 'i');

export type DataSource = 'live' | 'demo';

/**
 * Normalize a user-supplied player tag: trims, uppercases, accepts an optional leading
 * `#`, maps the commonly mistyped letter O to digit 0, and validates the alphabet.
 * Returns canonical `#TAG` or null when invalid.
 */
export function normalizeTag(raw: string): string | null {
  let t = raw.trim().toUpperCase();
  if (t.startsWith('#')) t = t.slice(1);
  t = t.replace(/O/g, '0');
  if (!TAG_RE.test(t)) return null;
  return `#${t}`;
}

/**
 * Convert a rarity-relative API level to the current in-game scale.
 * `normalized = level + (LEVEL_CAP - maxLevel)` — verified against the community docs
 * (see docs/api-notes.md). Returns null when either input is missing or non-finite;
 * callers must render null as "unknown", never guess.
 */
export function normalizeLevel(level: number | undefined | null, maxLevel: number | undefined | null): number | null {
  if (typeof level !== 'number' || typeof maxLevel !== 'number') return null;
  if (!Number.isFinite(level) || !Number.isFinite(maxLevel)) return null;
  return level + (LEVEL_CAP - maxLevel);
}

/** Bit-field decode for deck/battle context: the ONE form the card is played as. */
export function formFromBits(evolutionLevel: number | undefined | null): ApiForm {
  if (evolutionLevel === 1) return 'evo';
  if (evolutionLevel === 2) return 'hero';
  // 3 is documented as never occurring on a played deck (a slot plays evo OR hero);
  // if it ever appears we degrade to 'evo' rather than inventing a combined form.
  if (evolutionLevel === 3) return 'evo';
  return 'base';
}

/** Bit-field decode for collection context: which forms are unlocked. */
export function unlockedFromBits(evolutionLevel: number | undefined | null): { evo: boolean; hero: boolean } {
  const v = typeof evolutionLevel === 'number' ? evolutionLevel : 0;
  return { evo: (v & 1) === 1, hero: (v & 2) === 2 };
}

/**
 * Stable signature of a deck's identity: eight cards (sorted by id, then form) plus
 * the Tower Troop. Same cards with a different active form or Tower Troop = different
 * deck. Shared by client and server so duplicate detection agrees everywhere.
 */
export function deckSignature(cards: PlayedCard[], towerTroopId: number | null): string {
  const part = cards
    .map((c) => `${c.id}:${c.form}`)
    .sort()
    .join(',');
  return `${part}|tt:${towerTroopId ?? '-'}`;
}

/** Parse Supercell's `YYYYMMDDTHHmmss.sssZ` battle time to ISO 8601; null when malformed. */
export function parseBattleTime(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/.exec(raw.trim());
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] ?? ''}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary', 'champion'];

function toRarity(raw: string | undefined): Rarity {
  const r = (raw ?? '').toLowerCase() as Rarity;
  // A brand-new rarity degrades to 'common' rather than crashing the catalog; the card
  // remains usable by id/art. Documented in docs/api-notes.md.
  return RARITIES.includes(r) ? r : 'common';
}

function toCatalogCard(raw: ScCatalogCard, isTowerTroop: boolean): CatalogCard | null {
  if (typeof raw.id !== 'number' || typeof raw.name !== 'string') return null;
  const capability = typeof raw.maxEvolutionLevel === 'number' ? raw.maxEvolutionLevel : 0;
  return {
    id: raw.id,
    name: raw.name,
    elixir: typeof raw.elixirCost === 'number' ? raw.elixirCost : null,
    rarity: toRarity(raw.rarity),
    maxLevel: LEVEL_CAP,
    canEvo: !isTowerTroop && (capability & 1) === 1,
    canHero: !isTowerTroop && (capability & 2) === 2,
    isChampion: toRarity(raw.rarity) === 'champion',
    art: {
      base: raw.iconUrls?.medium ?? null,
      evo: raw.iconUrls?.evolutionMedium ?? null,
      hero: raw.iconUrls?.heroMedium ?? null,
    },
  };
}

/** `GET /cards` response → Catalog. Tower Troops (`supportItems`) are kept separate. */
export function normalizeCatalog(raw: ScCardsResponse, source: DataSource, fetchedAt = new Date().toISOString()): Catalog {
  const cards = (raw.items ?? [])
    .map((c) => toCatalogCard(c, false))
    .filter((c): c is CatalogCard => c !== null);
  const towerTroops = (raw.supportItems ?? [])
    .map((c) => toCatalogCard(c, true))
    .filter((c): c is CatalogCard => c !== null);
  return { cards, towerTroops, fetchedAt, source };
}

function toOwnedCard(raw: ScPlayerCard): OwnedCard | null {
  if (typeof raw.id !== 'number') return null;
  const { evo, hero } = unlockedFromBits(raw.evolutionLevel);
  // count === 0 is normal for maxed/equipped cards — the card is still owned.
  return { id: raw.id, level: normalizeLevel(raw.level, raw.maxLevel), evoUnlocked: evo, heroUnlocked: hero };
}

function toPlayedCards(raw: ScPlayerCard[]): PlayedCard[] {
  const out: PlayedCard[] = [];
  for (const c of raw) {
    if (typeof c.id !== 'number') return [];
    out.push({ id: c.id, form: formFromBits(c.evolutionLevel) });
  }
  return out;
}

function towerTroopIdOf(supportCards: ScPlayerCard[] | undefined): number | null {
  const first = supportCards?.[0];
  return typeof first?.id === 'number' ? first.id : null;
}

/** A deck only counts when it has exactly eight valid cards. */
export function toPlayedDeck(
  cards: ScPlayerCard[] | undefined,
  supportCards: ScPlayerCard[] | undefined,
  playedAt: string | null,
  mode: string | null,
): PlayedDeck | null {
  if (!Array.isArray(cards) || cards.length !== 8) return null;
  const played = toPlayedCards(cards);
  if (played.length !== 8) return null;
  return { cards: played, towerTroopId: towerTroopIdOf(supportCards), playedAt, mode };
}

function toSummary(raw: ScPlayer): PlayerSummary {
  return {
    tag: typeof raw.tag === 'string' ? raw.tag : '',
    name: typeof raw.name === 'string' ? raw.name : '',
    trophies: typeof raw.trophies === 'number' ? raw.trophies : null,
    bestTrophies: typeof raw.bestTrophies === 'number' ? raw.bestTrophies : null,
    arena: typeof raw.arena?.name === 'string' ? raw.arena.name : null,
    expLevel: typeof raw.expLevel === 'number' ? raw.expLevel : null,
    clan:
      raw.clan && typeof raw.clan.tag === 'string' && typeof raw.clan.name === 'string'
        ? { tag: raw.clan.tag, name: raw.clan.name }
        : null,
  };
}

/** `GET /players/{tag}` response → PlayerProfile. */
export function normalizePlayer(raw: ScPlayer, source: DataSource, fetchedAt = new Date().toISOString()): PlayerProfile {
  return {
    summary: toSummary(raw),
    currentDeck: toPlayedDeck(raw.currentDeck, raw.currentDeckSupportCards, null, null),
    collection: (raw.cards ?? []).map(toOwnedCard).filter((c): c is OwnedCard => c !== null),
    towerTroops: (raw.supportCards ?? []).map(toOwnedCard).filter((c): c is OwnedCard => c !== null),
    fetchedAt,
    source,
  };
}

/** Find the searched player inside one side of a battle (2v2 sides have 2 entries). */
function findParticipant(side: ScBattleParticipant[] | undefined, tag: string): ScBattleParticipant | null {
  for (const p of side ?? []) {
    if (typeof p.tag === 'string' && p.tag.toUpperCase() === tag.toUpperCase()) return p;
  }
  return null;
}

function battleModeLabel(battle: ScBattle): string | null {
  return battle.gameMode?.name ?? battle.type ?? null;
}

/**
 * `GET /players/{tag}/battlelog` response → the searched player's own recent decks.
 *
 * Reduction rules (docs/api-notes.md):
 * - Only the searched player's own `team[]` entry is read — never the opponent's deck,
 *   and in 2v2 the correct teammate entry is picked by tag.
 * - Only exactly-8-card decks qualify (duels report 16/24 cards, boat defense 12,
 *   some events 0 — all skipped and counted in `skipped`).
 * - Decks are deduplicated by `deckSignature` and returned most-recent first.
 */
export function normalizeBattleDecks(
  raw: ScBattleLog,
  tag: string,
  source: DataSource,
  fetchedAt = new Date().toISOString(),
): PlayerBattleDecks {
  const wanted = normalizeTag(tag) ?? tag;
  const decks: PlayedDeck[] = [];
  let skipped = 0;

  for (const battle of raw ?? []) {
    const me = findParticipant(battle.team, wanted);
    if (!me) {
      skipped += 1;
      continue;
    }
    const deck = toPlayedDeck(me.cards, me.supportCards, parseBattleTime(battle.battleTime), battleModeLabel(battle));
    if (!deck) {
      skipped += 1;
      continue;
    }
    decks.push(deck);
  }

  decks.sort((a, b) => (b.playedAt ?? '').localeCompare(a.playedAt ?? ''));

  const seen = new Set<string>();
  const deduped = decks.filter((d) => {
    const sig = deckSignature(d.cards, d.towerTroopId);
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });

  return { tag: wanted, decks: deduped, skipped, fetchedAt, source };
}
