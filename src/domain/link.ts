/**
 * The official copy-deck link.
 *
 * Verified shape (observed live on deckbeacon.app, Oct 2026, and matching the
 * links the game itself generates):
 *
 *   https://link.clashroyale.com/en/?clashroyale://copyDeck?deck=ID1;ID2;...;ID8&tt=TOWERID&l=Royals
 *
 * - `deck`: eight canonical card ids, ';'-separated.
 * - `tt`:   Tower Troop id (e.g. 159000000 = Tower Princess). Omitted by some
 *           generators; documented-but-unverified until a real-device test, so
 *           it is gated behind `TOWER_TROOP_LINK_VERIFIED` / an explicit option.
 * - `l`:    always "Royals" in every observed link.
 * - The inner `clashroyale://...` part is appended RAW (not percent-encoded).
 * - NO form/evo/hero/slot parameter exists in any observed link: forms do not
 *   survive the handoff. See docs/deck-link-notes.md.
 *
 * In observed deckbeacon/game links the card order is: Evo slot, Hero slot,
 * Wild slot, then the five ordinary cards. This is exposed as a *hint* only.
 */
import type { CatalogCard } from '@shared/types';
import type { Deck, SlotForm, SlotRole } from './types';
import { slotRole, SLOT_LABELS, FORM_LABELS } from './slots';
import { isComplete, type CardLookup } from './deck';

/**
 * Set to true only after a real-device test confirms the game honours `tt=`.
 * While false, buildDeckLink omits the tower troop unless explicitly overridden.
 */
export const TOWER_TROOP_LINK_VERIFIED = false;

export const COPY_DECK_LINK_BASE = 'https://link.clashroyale.com/en/';

export interface BuildDeckLinkOptions {
  /** Defaults to TOWER_TROOP_LINK_VERIFIED. */
  includeTowerTroop?: boolean;
}

/**
 * Build the official copy-deck URL. Returns null for an incomplete deck —
 * a partial deck must never produce a misleading game link.
 */
export function buildDeckLink(deck: Deck, options?: BuildDeckLinkOptions): string | null {
  if (!isComplete(deck)) return null;
  const ids = deck.slots.map((s) => s.cardId as number);
  let inner = `clashroyale://copyDeck?deck=${ids.join(';')}`;
  const includeTowerTroop = options?.includeTowerTroop ?? TOWER_TROOP_LINK_VERIFIED;
  if (includeTowerTroop && deck.towerTroopId != null) {
    inner += `&tt=${deck.towerTroopId}`;
  }
  inner += '&l=Royals';
  return `${COPY_DECK_LINK_BASE}?${inner}`;
}

export type ParseDeckLinkError = 'not_found' | 'wrong_count' | 'duplicate' | 'unknown_cards';

export interface ParsedDeckLink {
  cardIds: number[];
  towerTroopId: number | null;
  /** One entry per cardId. Official links carry no forms → all 'base'. */
  forms: SlotForm[];
  /**
   * Observed (unverified) ordering in official links: index 0 = Evo slot,
   * 1 = Hero slot, 2 = Wild slot. null when unknown (RoyaleAPI URLs).
   */
  specialSlotHint: [number, number, number] | null;
  source: 'official' | 'royaleapi';
}

export type ParseDeckLinkResult =
  | { ok: true; deck: ParsedDeckLink }
  | { ok: false; error: ParseDeckLinkError; message: string; unknownCards?: string[] };

function fail(error: ParseDeckLinkError, message: string, unknownCards?: string[]): ParseDeckLinkResult {
  return { ok: false, error, message, ...(unknownCards ? { unknownCards } : {}) };
}

/** Decode percent-encoded variants (YouTube descriptions etc.), safely. */
function decodeDeep(text: string): string {
  let out = text;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(out);
      if (next === out) break;
      out = next;
    } catch {
      break; // malformed escapes in surrounding text — keep last good value
    }
  }
  return out;
}

function checkIds(ids: number[], rawTokens: string[]): ParseDeckLinkResult | null {
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    const bad = rawTokens.filter((t) => {
      const n = Number(t);
      return !Number.isInteger(n) || n <= 0;
    });
    return fail('unknown_cards', `Link contains non-numeric or invalid card ids.`, bad);
  }
  if (ids.length !== 8) {
    return fail('wrong_count', `Expected 8 cards, got ${ids.length}.`);
  }
  const seen = new Set<number>();
  for (const id of ids) {
    if (seen.has(id)) return fail('duplicate', `Card id ${id} appears more than once.`);
    seen.add(id);
  }
  return null;
}

function parseOfficial(text: string): ParseDeckLinkResult | null {
  // Matches both the full https://link.clashroyale.com/... wrapper and a bare
  // clashroyale://copyDeck?... pasted on its own or inside larger text.
  const m = /clashroyale:\/\/copydeck\?([^\s"'<>)\]]+)/i.exec(text);
  if (!m || m[1] == null) return null;
  const params = new URLSearchParams(m[1].replace(/&amp;/gi, '&'));
  const deckParam = params.get('deck');
  if (!deckParam) return fail('wrong_count', 'copyDeck link has no deck parameter.');
  const tokens = deckParam.split(';').filter((t) => t.trim() !== '');
  const ids = tokens.map((t) => Number(t.trim()));
  const invalid = checkIds(ids, tokens);
  if (invalid) return invalid;

  let towerTroopId: number | null = null;
  const tt = params.get('tt');
  if (tt != null && tt !== '') {
    const n = Number(tt);
    if (Number.isInteger(n) && n > 0) towerTroopId = n;
  }

  return {
    ok: true,
    deck: {
      cardIds: ids,
      towerTroopId,
      forms: ids.map(() => 'base' as SlotForm),
      specialSlotHint: [0, 1, 2],
      source: 'official',
    },
  };
}

/** RoyaleAPI card key: lowercase, dots/apostrophes removed, other separators → '-'. */
export function royaleApiKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseRoyaleApi(
  text: string,
  catalog?: { cards: CatalogCard[] },
): ParseDeckLinkResult | null {
  const m = /royaleapi\.com\/decks\/stats\/([^\s"'<>?#]+)/i.exec(text);
  if (!m || m[1] == null) return null;
  if (!catalog) {
    return fail(
      'unknown_cards',
      'A card catalog is required to resolve RoyaleAPI deck URLs (card keys are names, not ids).',
    );
  }
  const byKey = new Map<string, CatalogCard>();
  for (const card of catalog.cards) {
    byKey.set(royaleApiKey(card.name), card);
  }

  const ids: number[] = [];
  const forms: SlotForm[] = [];
  const unknown: string[] = [];
  for (const rawKey of m[1].split(',')) {
    let key = rawKey.trim().toLowerCase();
    let form: SlotForm = 'base';
    // RoyaleAPI marks variants with -ev1 (evolution) and -hero suffixes.
    if (key.endsWith('-ev1')) {
      form = 'evo';
      key = key.slice(0, -4);
    } else if (key.endsWith('-hero')) {
      form = 'hero';
      key = key.slice(0, -5);
    }
    const card = byKey.get(key);
    if (!card) {
      unknown.push(rawKey.trim());
      continue;
    }
    if (card.isChampion && form === 'base') form = 'champion';
    ids.push(card.id);
    forms.push(form);
  }
  if (unknown.length > 0) {
    return fail('unknown_cards', `Unknown card keys: ${unknown.join(', ')}`, unknown);
  }
  const invalid = checkIds(ids, m[1].split(','));
  if (invalid) return invalid;
  return {
    ok: true,
    deck: { cardIds: ids, towerTroopId: null, forms, specialSlotHint: null, source: 'royaleapi' },
  };
}

/**
 * Parse a deck link out of arbitrary pasted text. Accepts:
 * - the full https://link.clashroyale.com/en/?clashroyale://copyDeck?... URL
 * - a bare clashroyale://copyDeck?... deep link
 * - percent-encoded variants and links embedded in larger text
 * - RoyaleAPI deck URLs (https://royaleapi.com/decks/stats/key,key,...) —
 *   keys are slugified card names, so a catalog is required for those.
 */
export function parseDeckLink(
  text: string,
  catalog?: { cards: CatalogCard[] },
): ParseDeckLinkResult {
  if (!text || !text.trim()) return fail('not_found', 'No deck link found in the input.');
  const decoded = decodeDeep(text);
  // Try the official link first (raw text, then progressively decoded forms).
  for (const candidate of [text, decoded]) {
    const official = parseOfficial(candidate);
    if (official) return official;
  }
  const rapi = parseRoyaleApi(decoded, catalog) ?? parseRoyaleApi(text, catalog);
  if (rapi) return rapi;
  return fail('not_found', 'No Clash Royale copy-deck link found in the input.');
}

export interface FormReminder {
  position: number;
  role: SlotRole;
  roleLabel: string;
  cardId: number;
  cardName: string;
  form: SlotForm;
  formLabel: string;
}

/**
 * "Set these forms in-game after import": the copy-deck link does not carry
 * Evo/Hero/Champion activation, so list every non-base form the user must
 * re-apply manually in Clash Royale.
 */
export function formsReminder(deck: Deck, lookup: CardLookup): FormReminder[] {
  const reminders: FormReminder[] = [];
  for (const slot of deck.slots) {
    if (slot.cardId == null || slot.form === 'base') continue;
    const role = slotRole(slot.position);
    reminders.push({
      position: slot.position,
      role,
      roleLabel: SLOT_LABELS[role],
      cardId: slot.cardId,
      cardName: lookup(slot.cardId)?.name ?? `Unknown card ${slot.cardId}`,
      form: slot.form,
      formLabel: FORM_LABELS[slot.form],
    });
  }
  return reminders;
}
