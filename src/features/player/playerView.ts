/**
 * View helpers for the player-search page: deduping recent decks against the
 * current deck, mode/relative-time labels, average elixir for API-observed
 * decks, and playful default deck names. Pure functions; unit-tested.
 */
import { deckSignature as playedDeckSignature } from '@shared/normalize';
import type { CatalogCard, PlayedDeck } from '@shared/types';
import type { CardLookup } from '@/domain/deck';

/**
 * Hide recent decks that are the exact same variant as the current deck
 * (same 8 cards + forms + Tower Troop) so the profile doesn't show a
 * confusing duplicate (spec F2).
 */
export function hideCurrentDupes(recent: PlayedDeck[], current: PlayedDeck | null): PlayedDeck[] {
  if (!current) return recent;
  const currentSig = playedDeckSignature(current.cards, current.towerTroopId);
  return recent.filter((d) => playedDeckSignature(d.cards, d.towerTroopId) !== currentSig);
}

/** Known game-mode names → friendly labels (keyed by lowercase, separators stripped). */
const KNOWN_MODES: Record<string, string> = {
  ladder: 'Ladder',
  pathoflegend: 'Path of Legends',
  teamvsteam: '2v2 Battle',
  pvp: 'PvP',
};

/** Prettify a raw game-mode/battle-type label: "TeamVsTeam" → "2v2 Battle", "All_Random_Princess" → "All Random Princess". */
export function prettifyMode(mode: string | null): string | null {
  if (!mode) return null;
  const known = KNOWN_MODES[mode.replace(/[\s_]+/g, '').toLowerCase()];
  if (known) return known;
  const spaced = mode
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!spaced) return null;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** "just now" / "5m ago" / "2h ago" / "3d ago" / "2w ago"; '' for unparseable input. */
export function timeAgo(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/** "Played 2h ago · Ladder" — parts omitted individually when unknown. */
export function playedMeta(played: PlayedDeck, now: number): string {
  const parts: string[] = [];
  if (played.playedAt) {
    const ago = timeAgo(played.playedAt, now);
    if (ago) parts.push(`Played ${ago}`);
  }
  const mode = prettifyMode(played.mode);
  if (mode) parts.push(mode);
  return parts.join(' · ');
}

/** Average elixir of an API-observed deck; null when any cost is unknown (never invented). */
export function playedAvgElixir(played: PlayedDeck, lookup: CardLookup): number | null {
  if (played.cards.length === 0) return null;
  let sum = 0;
  for (const c of played.cards) {
    const cost = lookup(c.id)?.elixir;
    if (cost == null) return null;
    sum += cost;
  }
  return Math.round((sum / played.cards.length) * 10) / 10;
}

/**
 * Playful default name from the deck's two most expensive cards:
 * "Clara's Hog Rider · Fireball" / "Hog Rider · Fireball". Falls back to
 * "<Name>'s deck" / "Imported deck" when the cards aren't in the catalog.
 */
export function suggestDeckName(cardIds: number[], lookup: CardLookup, ownerName?: string | null): string {
  const known = cardIds
    .map((id) => lookup(id))
    .filter((c): c is CatalogCard => c !== undefined)
    .sort((a, b) => (b.elixir ?? -1) - (a.elixir ?? -1) || a.name.localeCompare(b.name));
  const top = known.slice(0, 2).map((c) => c.name);
  const owner = ownerName?.trim();
  if (owner) return top.length > 0 ? `${owner}'s ${top.join(' · ')}` : `${owner}'s deck`;
  return top.length > 0 ? top.join(' · ') : 'Imported deck';
}
