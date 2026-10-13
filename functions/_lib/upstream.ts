import { apiBase, type Env } from './env';
import { ApiHttpError } from './errors';

/**
 * GET a path from the upstream Clash Royale API (via the configured proxy base).
 *
 * - 503 `not_configured` when no token secret is set (demo deployments).
 * - Maps upstream statuses: 400 → bad_tag, 404 → not_found, 429 → rate_limited,
 *   403 (bad token / IP not allowlisted) and 5xx/network failures → upstream.
 * - The token is only ever sent in the Authorization header upstream — never logged,
 *   never included in error messages.
 */
export async function fetchUpstream(env: Env, path: string): Promise<unknown> {
  const token = env.CR_API_TOKEN;
  if (!token) {
    throw new ApiHttpError('not_configured', 'Game API token is not configured on this deployment.');
  }
  let res: Response;
  try {
    res = await fetch(`${apiBase(env)}${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    });
  } catch {
    throw new ApiHttpError('upstream', 'Could not reach the game API.');
  }
  if (res.status === 400) throw new ApiHttpError('bad_tag', 'The game API rejected the request parameters.');
  if (res.status === 404) throw new ApiHttpError('not_found', 'Player not found.');
  if (res.status === 429) throw new ApiHttpError('rate_limited', 'The game API rate limit was hit. Try again shortly.');
  if (!res.ok) throw new ApiHttpError('upstream', `The game API returned status ${res.status}.`);
  try {
    return (await res.json()) as unknown;
  } catch {
    throw new ApiHttpError('upstream', 'The game API returned an unreadable response.');
  }
}
