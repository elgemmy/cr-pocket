import { normalizeCatalog } from '../../shared/normalize';
import type { ScCardsResponse } from '../../shared/supercell';
import { withEdgeCache } from '../_lib/cache';
import type { Env } from '../_lib/env';
import { errorResponse, jsonResponse } from '../_lib/errors';
import { allowRequest } from '../_lib/rateLimit';
import { fetchUpstream } from '../_lib/upstream';

const CACHE_SECONDS = 60 * 60 * 24; // card catalog changes only with game updates

/** GET /api/cards — full card + tower troop catalog, normalized. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  if (!(await allowRequest(request))) {
    return jsonResponse({ error: 'rate_limited', message: 'Too many requests. Slow down.' }, 429);
  }
  try {
    return await withEdgeCache(request, { waitUntil }, async () => {
      const raw = await fetchUpstream(env, '/cards');
      return jsonResponse(normalizeCatalog(raw as ScCardsResponse, 'live'), 200, CACHE_SECONDS);
    });
  } catch (err) {
    return errorResponse(err);
  }
};
