/**
 * Client game-data layer. Two modes, selected by `gameApiMode` (src/config.ts):
 * - `live`: calls the Pages Functions under `/api/*` (which proxy the official API).
 * - `demo`: normalizes bundled fixtures through the SAME shared/normalize.ts pipeline
 *   with a simulated 300–600 ms latency, so demo behavior matches live behavior.
 */

import { gameApiMode } from '@/config';
import { normalizeBattleDecks, normalizeCatalog, normalizePlayer, normalizeTag } from '@shared/normalize';
import type { ApiErrorBody, ApiErrorCode, Catalog, PlayerBattleDecks, PlayerProfile } from '@shared/types';
import type { ScBattleLog, ScCardsResponse, ScPlayer } from '@shared/supercell';

export class GameApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GameApiError';
  }
}

const ERROR_CODES: readonly ApiErrorCode[] = ['bad_tag', 'not_found', 'rate_limited', 'upstream', 'not_configured', 'offline'];

function toErrorCode(raw: unknown): ApiErrorCode {
  return ERROR_CODES.includes(raw as ApiErrorCode) ? (raw as ApiErrorCode) : 'upstream';
}

async function liveGet<T>(path: string): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new GameApiError('offline', 'You appear to be offline. Reconnect to look up live game data.');
  }
  let res: Response;
  try {
    res = await fetch(path, { headers: { accept: 'application/json' } });
  } catch {
    throw new GameApiError('offline', 'Could not reach the server. Check your connection.');
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON body (e.g. an HTML error page from the platform)
  }
  if (!res.ok) {
    const errBody = body as Partial<ApiErrorBody> | null;
    throw new GameApiError(
      toErrorCode(errBody?.error),
      typeof errBody?.message === 'string' ? errBody.message : `Request failed with status ${res.status}.`,
    );
  }
  return body as T;
}

/* ---------------------------------- demo ---------------------------------- */

/** Demo player tags (valid CR tag alphabet: 0289PYLQGRJCUV). Unknown valid tags → not_found. */
export const DEMO_TAGS = {
  /** Clara — mid-level, varied rarities, evo+hero unlocks, 2v2/duel/event battles, dupes. */
  varied: '#2CJV0LY8P',
  /** Maximus — fully maxed account, every form unlocked, champion in deck. */
  maxed: '#9QRUGCP0Y',
  /** Nadia — new player, tiny collection, 7-card current deck, no clan. */
  newbie: '#8PL2UCY0Q',
  /** Valid format but no fixture — exercises the not-found path. */
  missing: '#0V0V0V0V',
} as const;

const DEMO_PLAYER_LOADERS: Record<string, () => Promise<{ default: ScPlayer }>> = {
  [DEMO_TAGS.varied]: () => import('@shared/fixtures/player-2CJV0LY8P.json') as Promise<{ default: ScPlayer }>,
  [DEMO_TAGS.maxed]: () => import('@shared/fixtures/player-9QRUGCP0Y.json') as Promise<{ default: ScPlayer }>,
  [DEMO_TAGS.newbie]: () => import('@shared/fixtures/player-8PL2UCY0Q.json') as Promise<{ default: ScPlayer }>,
};

const DEMO_BATTLE_LOADERS: Record<string, () => Promise<{ default: ScBattleLog }>> = {
  [DEMO_TAGS.varied]: () => import('@shared/fixtures/battles-2CJV0LY8P.json') as Promise<{ default: ScBattleLog }>,
  [DEMO_TAGS.maxed]: () => import('@shared/fixtures/battles-9QRUGCP0Y.json') as Promise<{ default: ScBattleLog }>,
  [DEMO_TAGS.newbie]: () => import('@shared/fixtures/battles-8PL2UCY0Q.json') as Promise<{ default: ScBattleLog }>,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Simulated network latency so loading states are real in demo mode. */
function demoLatency(): Promise<void> {
  return sleep(300 + Math.random() * 300);
}

function demoTag(raw: string): string {
  const tag = normalizeTag(raw);
  if (!tag) throw new GameApiError('bad_tag', `"${raw}" is not a valid player tag.`);
  return tag;
}

async function demoPlayer(raw: string): Promise<ScPlayer> {
  const tag = demoTag(raw);
  await demoLatency();
  const loader = DEMO_PLAYER_LOADERS[tag];
  if (!loader) throw new GameApiError('not_found', `No player found for tag ${tag}.`);
  return (await loader()).default;
}

async function demoBattles(raw: string): Promise<{ tag: string; log: ScBattleLog }> {
  const tag = demoTag(raw);
  await demoLatency();
  const loader = DEMO_BATTLE_LOADERS[tag];
  if (!loader) throw new GameApiError('not_found', `No player found for tag ${tag}.`);
  return { tag, log: (await loader()).default };
}

/* ---------------------------------- API ----------------------------------- */

export const gameApi = {
  async getCatalog(): Promise<Catalog> {
    if (gameApiMode === 'live') return liveGet<Catalog>('/api/cards');
    await demoLatency();
    const raw = (await import('@shared/fixtures/cards.json')).default as ScCardsResponse;
    return normalizeCatalog(raw, 'demo');
  },

  async getPlayer(tag: string): Promise<PlayerProfile> {
    if (gameApiMode === 'live') {
      const normalized = demoTag(tag); // validation is client-side too; server re-validates
      return liveGet<PlayerProfile>(`/api/players/${encodeURIComponent(normalized)}`);
    }
    return normalizePlayer(await demoPlayer(tag), 'demo');
  },

  async getBattleDecks(tag: string): Promise<PlayerBattleDecks> {
    if (gameApiMode === 'live') {
      const normalized = demoTag(tag);
      return liveGet<PlayerBattleDecks>(`/api/players/${encodeURIComponent(normalized)}/battles`);
    }
    const { tag: normalized, log } = await demoBattles(tag);
    return normalizeBattleDecks(log, normalized, 'demo');
  },
};

export type GameApi = typeof gameApi;
