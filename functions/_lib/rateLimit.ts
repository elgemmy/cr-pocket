/**
 * Best-effort per-IP rate limiting.
 *
 * Pages Functions cannot use the Workers `ratelimit` binding (it is not among the
 * binding types Pages supports), so this is a lightweight Cache-API token counter:
 * one entry per client IP per minute window. It is intentionally modest protection
 * against casual abuse, NOT a hard guarantee — Cache API entries are per-colo and
 * can be evicted. Documented in docs/api-notes.md. If real abuse appears, front the
 * site with Cloudflare WAF rate-limiting rules (dashboard) instead.
 */

export const RATE_LIMIT_PER_MINUTE = 60;

function defaultCache(): Cache | null {
  try {
    return typeof caches !== 'undefined' ? caches.default : null;
  } catch {
    return null;
  }
}

/** Returns true when the request is allowed, false when the IP exceeded the limit. */
export async function allowRequest(request: Request, limit = RATE_LIMIT_PER_MINUTE): Promise<boolean> {
  const cache = defaultCache();
  if (!cache) return true; // no Cache API (tests/local): allow
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const minute = Math.floor(Date.now() / 60_000);
  const key = new Request(`https://rate-limit.internal/${encodeURIComponent(ip)}/${minute}`);
  try {
    const hit = await cache.match(key);
    const count = hit ? Number.parseInt(await hit.text(), 10) || 0 : 0;
    if (count >= limit) return false;
    const headers = new Headers({ 'content-type': 'text/plain' });
    // Expire shortly after the window ends so keys don't linger.
    headers.set('expires', new Date((minute + 2) * 60_000).toUTCString());
    await cache.put(key, new Response(String(count + 1), { headers }));
    return true;
  } catch {
    return true; // fail open: rate limiting must never break the API
  }
}
