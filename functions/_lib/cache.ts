/**
 * Edge caching via the Cache API (`caches.default`), keyed on the request URL.
 * Degrades silently when the Cache API is unavailable (local vitest, non-Cloudflare
 * runtimes) so handlers stay testable.
 */

function defaultCache(): Cache | null {
  try {
    return typeof caches !== 'undefined' ? caches.default : null;
  } catch {
    return null;
  }
}

export interface CacheContext {
  waitUntil(promise: Promise<unknown>): void;
}

/** Return a cached response for `request`, or run `produce`, cache and return its result. */
export async function withEdgeCache(
  request: Request,
  ctx: CacheContext,
  produce: () => Promise<Response>,
): Promise<Response> {
  const cache = defaultCache();
  if (!cache || request.method !== 'GET') return produce();
  try {
    const hit = await cache.match(request);
    if (hit) {
      const res = new Response(hit.body, hit);
      res.headers.set('x-cr-pocket-cache', 'hit');
      return res;
    }
  } catch {
    // fall through to produce
  }
  const res = await produce();
  // Only cache successful JSON responses; errors must not stick to the edge.
  if (res.ok) {
    try {
      ctx.waitUntil(cache.put(request, res.clone()));
    } catch {
      // best effort
    }
  }
  return res;
}
