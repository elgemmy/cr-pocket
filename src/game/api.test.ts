import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_TAGS, gameApi, GameApiError } from './api';

// These tests run against demo mode (VITE_GAME_API is unset in tests).

describe('gameApi demo mode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getCatalog returns the normalized catalog from the fixture', async () => {
    const catalog = await gameApi.getCatalog();
    expect(catalog.source).toBe('demo');
    expect(catalog.cards.length).toBeGreaterThan(100);
    expect(catalog.towerTroops.length).toBeGreaterThan(0);
    const knight = catalog.cards.find((c) => c.id === 26000000)!;
    expect(knight.art.evo).toContain('api-assets.clashroyale.com');
  }, 15000);

  it('getPlayer normalizes case and optional #', async () => {
    const profile = await gameApi.getPlayer('2cjv0ly8p');
    expect(profile.summary.tag).toBe('#2CJV0LY8P');
    expect(profile.summary.name).toBe('Clara');
    expect(profile.source).toBe('demo');
    expect(profile.collection.length).toBeGreaterThan(40);
  }, 15000);

  it('getPlayer throws bad_tag for invalid tags', async () => {
    await expect(gameApi.getPlayer('not a tag')).rejects.toMatchObject({
      name: 'GameApiError',
      code: 'bad_tag',
    } satisfies Partial<GameApiError>);
  });

  it('getPlayer throws not_found for a valid but unknown tag', async () => {
    await expect(gameApi.getPlayer(DEMO_TAGS.missing)).rejects.toMatchObject({ code: 'not_found' });
  }, 15000);

  it('getBattleDecks returns deduped own decks with skipped count', async () => {
    const result = await gameApi.getBattleDecks('#2CJV0LY8P');
    expect(result.decks).toHaveLength(3);
    expect(result.skipped).toBe(2);
    expect(result.decks.every((d) => d.cards.length === 8)).toBe(true);
    expect(result.source).toBe('demo');
  }, 15000);

  it('simulates network latency (>= 250ms)', async () => {
    const start = Date.now();
    await gameApi.getPlayer(DEMO_TAGS.newbie);
    expect(Date.now() - start).toBeGreaterThanOrEqual(250);
  }, 15000);
});
