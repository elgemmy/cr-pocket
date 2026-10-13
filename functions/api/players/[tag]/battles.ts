import { normalizeBattleDecks } from '../../../../shared/normalize';
import type { ScBattleLog } from '../../../../shared/supercell';
import { withEdgeCache } from '../../../_lib/cache';
import type { Env } from '../../../_lib/env';
import { errorResponse, jsonResponse } from '../../../_lib/errors';
import { allowRequest } from '../../../_lib/rateLimit';
import { fetchUpstream } from '../../../_lib/upstream';
import { requireTag } from './index';

const CACHE_SECONDS = 120; // battle logs append over time; a couple minutes is fresh enough

/** GET /api/players/:tag/battles — recent battles reduced to the player's own 8-card decks. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env, params, waitUntil }) => {
  if (!(await allowRequest(request))) {
    return jsonResponse({ error: 'rate_limited', message: 'Too many requests. Slow down.' }, 429);
  }
  try {
    const tag = requireTag(params.tag);
    return await withEdgeCache(request, { waitUntil }, async () => {
      const raw = await fetchUpstream(env, `/players/${encodeURIComponent(tag)}/battlelog`);
      return jsonResponse(normalizeBattleDecks(raw as ScBattleLog, tag, 'live'), 200, CACHE_SECONDS);
    });
  } catch (err) {
    return errorResponse(err);
  }
};
