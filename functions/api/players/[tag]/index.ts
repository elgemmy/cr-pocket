import { normalizePlayer, normalizeTag } from '../../../../shared/normalize';
import type { ScPlayer } from '../../../../shared/supercell';
import { withEdgeCache } from '../../../_lib/cache';
import type { Env } from '../../../_lib/env';
import { ApiHttpError, errorResponse, jsonResponse } from '../../../_lib/errors';
import { allowRequest } from '../../../_lib/rateLimit';
import { fetchUpstream } from '../../../_lib/upstream';

const CACHE_SECONDS = 60; // profiles change often; keep it short

/** Extract and validate the :tag route param → canonical `#TAG` (throws bad_tag). */
export function requireTag(param: string | string[] | undefined): string {
  const raw = Array.isArray(param) ? param.join('/') : (param ?? '');
  const tag = normalizeTag(decodeURIComponent(raw));
  if (!tag) throw new ApiHttpError('bad_tag', 'Invalid player tag.');
  return tag;
}

/** GET /api/players/:tag — public profile, current deck, collection, tower troops. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env, params, waitUntil }) => {
  if (!(await allowRequest(request))) {
    return jsonResponse({ error: 'rate_limited', message: 'Too many requests. Slow down.' }, 429);
  }
  try {
    const tag = requireTag(params.tag);
    return await withEdgeCache(request, { waitUntil }, async () => {
      // `#` must be percent-encoded (%23) in the upstream path.
      const raw = await fetchUpstream(env, `/players/${encodeURIComponent(tag)}`);
      return jsonResponse(normalizePlayer(raw as ScPlayer, 'live'), 200, CACHE_SECONDS);
    });
  } catch (err) {
    return errorResponse(err);
  }
};
