// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../_lib/env';
import { onRequestGet as getCards } from './cards';
import { onRequestGet as getPlayer, requireTag } from './players/[tag]/index';
import { onRequestGet as getBattles } from './players/[tag]/battles';

import cardsFixture from '../../shared/fixtures/cards.json';
import playerA from '../../shared/fixtures/player-2CJV0LY8P.json';
import battlesA from '../../shared/fixtures/battles-2CJV0LY8P.json';

const ENV: Env = { CR_API_TOKEN: 'test-token', CR_API_BASE: 'https://proxy.test/v1' };

function ctx(path: string, params: Record<string, string> = {}, env: Env = ENV) {
  return {
    request: new Request(`https://cr-pocket.test${path}`),
    env,
    params,
    waitUntil: () => {},
    // Remaining EventContext fields are unused by these handlers.
  } as never;
}

function mockUpstream(status = 200, body: unknown = {}) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  // Node has no CacheStorage global; handlers degrade gracefully without it.
  expect(typeof (globalThis as Record<string, unknown>).caches).toBe('undefined');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requireTag', () => {
  it('normalizes case and optional #', () => {
    expect(requireTag('2cjv0ly8p')).toBe('#2CJV0LY8P');
    expect(requireTag('%232CJV0LY8P')).toBe('#2CJV0LY8P');
  });
  it('rejects bad tags', () => {
    expect(() => requireTag('DEMO0001')).toThrowError(/invalid player tag/i);
    expect(() => requireTag(undefined)).toThrowError(/invalid player tag/i);
  });
});

describe('GET /api/cards', () => {
  it('returns the normalized catalog with a day-long cache header', async () => {
    vi.stubGlobal('fetch', mockUpstream(200, cardsFixture));
    const res = await getCards(ctx('/api/cards'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('max-age=86400');
    const body = await res.json();
    expect(body.source).toBe('live');
    expect(body.cards).toHaveLength(123);
    expect(body.towerTroops).toHaveLength(4);
  });

  it('returns 503 not_configured without a token and never leaks it', async () => {
    const fetchMock = mockUpstream();
    vi.stubGlobal('fetch', fetchMock);
    const res = await getCards(ctx('/api/cards', {}, { CR_API_BASE: ENV.CR_API_BASE }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/players/:tag', () => {
  it('sends the bearer token upstream with a %23-encoded tag', async () => {
    const fetchMock = mockUpstream(200, playerA);
    vi.stubGlobal('fetch', fetchMock);
    const res = await getPlayer(ctx('/api/players/2CJV0LY8P', { tag: '2CJV0LY8P' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('max-age=60');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://proxy.test/v1/players/%232CJV0LY8P');
    expect((init as RequestInit).headers).toMatchObject({ authorization: 'Bearer test-token' });
    const body = await res.json();
    expect(body.summary.name).toBe('Clara');
    expect(body.currentDeck.cards).toHaveLength(8);
    expect(body.collection.length).toBeGreaterThan(40);
  });

  it('400s on a bad tag without calling upstream', async () => {
    const fetchMock = mockUpstream();
    vi.stubGlobal('fetch', fetchMock);
    const res = await getPlayer(ctx('/api/players/nope!', { tag: 'nope!' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'bad_tag' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps upstream 404 / 429 / 500 / network errors to shared error codes', async () => {
    for (const [status, code, http] of [
      [404, 'not_found', 404],
      [429, 'rate_limited', 429],
      [500, 'upstream', 502],
      [403, 'upstream', 502],
    ] as const) {
      vi.stubGlobal('fetch', mockUpstream(status, { reason: 'x' }));
      const res = await getPlayer(ctx('/api/players/2CJV0LY8P', { tag: '2CJV0LY8P' }));
      expect(res.status).toBe(http);
      expect(await res.json()).toMatchObject({ error: code });
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network down');
      }),
    );
    const res = await getPlayer(ctx('/api/players/2CJV0LY8P', { tag: '2CJV0LY8P' }));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'upstream' });
  });
});

describe('GET /api/players/:tag/battles', () => {
  it('reduces the battle log to the player\'s own decks', async () => {
    vi.stubGlobal('fetch', mockUpstream(200, battlesA));
    const res = await getBattles(ctx('/api/players/2CJV0LY8P/battles', { tag: '2CJV0LY8P' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('max-age=120');
    const body = await res.json();
    expect(body.tag).toBe('#2CJV0LY8P');
    expect(body.decks).toHaveLength(3);
    expect(body.skipped).toBe(2);
    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(url)).toBe('https://proxy.test/v1/players/%232CJV0LY8P/battlelog');
  });
});
