// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  deckSignature,
  formFromBits,
  LEVEL_CAP,
  normalizeBattleDecks,
  normalizeCatalog,
  normalizeLevel,
  normalizePlayer,
  normalizeTag,
  parseBattleTime,
  unlockedFromBits,
} from './normalize';
import type { ScBattleLog, ScPlayer } from './supercell';

import cardsFixture from './fixtures/cards.json';
import playerA from './fixtures/player-2CJV0LY8P.json';
import battlesA from './fixtures/battles-2CJV0LY8P.json';
import playerB from './fixtures/player-9QRUGCP0Y.json';
import playerC from './fixtures/player-8PL2UCY0Q.json';

describe('normalizeTag', () => {
  it('accepts valid tags and canonicalizes', () => {
    expect(normalizeTag('2CJV0LY8P')).toBe('#2CJV0LY8P');
    expect(normalizeTag('#2cjv0ly8p')).toBe('#2CJV0LY8P');
    expect(normalizeTag('  #9QRUGCP0Y ')).toBe('#9QRUGCP0Y');
  });
  it('maps letter O to digit 0', () => {
    expect(normalizeTag('#2CJV0LY8P'.replace('0', 'O'))).toBe('#2CJV0LY8P');
  });
  it('rejects invalid tags', () => {
    expect(normalizeTag('')).toBeNull();
    expect(normalizeTag('#DEMO0001')).toBeNull(); // D, E, M not in tag alphabet
    expect(normalizeTag('#12')).toBeNull(); // too short, and 1 not allowed
    expect(normalizeTag('hello world')).toBeNull();
    expect(normalizeTag('#2CJV0LY8P2CJV0LY8P0')).toBeNull(); // too long
  });
});

describe('normalizeLevel', () => {
  it('applies level + (16 - maxLevel) per rarity', () => {
    expect(normalizeLevel(16, 16)).toBe(16); // common max
    expect(normalizeLevel(1, 14)).toBe(3); // rare 1 -> 3
    expect(normalizeLevel(1, 11)).toBe(6); // epic 1 -> 6
    expect(normalizeLevel(1, 8)).toBe(9); // legendary 1 -> 9
    expect(normalizeLevel(1, 6)).toBe(11); // champion 1 -> 11
    expect(normalizeLevel(6, 6)).toBe(16); // champion max
  });
  it('returns null for missing/invalid input instead of inventing a level', () => {
    expect(normalizeLevel(undefined, 14)).toBeNull();
    expect(normalizeLevel(5, undefined)).toBeNull();
    expect(normalizeLevel(NaN, 14)).toBeNull();
  });
});

describe('form bit field', () => {
  it('decodes played-as form for deck/battle context', () => {
    expect(formFromBits(undefined)).toBe('base');
    expect(formFromBits(0)).toBe('base');
    expect(formFromBits(1)).toBe('evo');
    expect(formFromBits(2)).toBe('hero');
  });
  it('decodes unlocked forms for collection context', () => {
    expect(unlockedFromBits(undefined)).toEqual({ evo: false, hero: false });
    expect(unlockedFromBits(1)).toEqual({ evo: true, hero: false });
    expect(unlockedFromBits(2)).toEqual({ evo: false, hero: true });
    expect(unlockedFromBits(3)).toEqual({ evo: true, hero: true });
  });
});

describe('parseBattleTime', () => {
  it('parses Supercell battle time format', () => {
    expect(parseBattleTime('20261012T201540.000Z')).toBe('2026-10-12T20:15:40.000Z');
  });
  it('returns null for malformed values', () => {
    expect(parseBattleTime('2026-10-12T20:15:40Z')).toBeNull();
    expect(parseBattleTime(undefined)).toBeNull();
    expect(parseBattleTime('garbage')).toBeNull();
  });
});

describe('normalizeCatalog (real captured /v1/cards fixture)', () => {
  const catalog = normalizeCatalog(cardsFixture, 'demo', '2026-10-13T00:00:00.000Z');

  it('splits standard cards and tower troops', () => {
    expect(catalog.cards).toHaveLength(123);
    expect(catalog.towerTroops.map((t) => t.name)).toEqual([
      'Tower Princess',
      'Cannoneer',
      'Dagger Duchess',
      'Royal Chef',
    ]);
    expect(catalog.source).toBe('demo');
  });

  it('marks Evo/Hero capability from the bit field, matching icon assets', () => {
    const knight = catalog.cards.find((c) => c.name === 'Knight')!;
    expect(knight.canEvo).toBe(true);
    expect(knight.canHero).toBe(true);
    expect(knight.art.evo).toContain('api-assets.clashroyale.com/cardevolutions/');
    expect(knight.art.hero).toContain('api-assets.clashroyale.com/cardheroes/');
    const hog = catalog.cards.find((c) => c.name === 'Hog Rider')!;
    expect(hog.canEvo).toBe(false);
    expect(hog.canHero).toBe(false);
    expect(hog.art.evo).toBeNull();
    expect(hog.art.hero).toBeNull();
  });

  it('handles champion rarity and missing elixir (Mirror)', () => {
    const queen = catalog.cards.find((c) => c.name === 'Archer Queen')!;
    expect(queen.isChampion).toBe(true);
    expect(queen.rarity).toBe('champion');
    const mirror = catalog.cards.find((c) => c.name === 'Mirror')!;
    expect(mirror.elixir).toBeNull();
  });

  it('reports the normalized level cap for every card', () => {
    expect(catalog.cards.every((c) => c.maxLevel === LEVEL_CAP)).toBe(true);
    expect(catalog.towerTroops.every((c) => c.elixir === null && !c.canEvo && !c.canHero)).toBe(true);
  });
});

describe('normalizePlayer', () => {
  it('normalizes levels to the in-game scale and decodes unlocks (Clara)', () => {
    const profile = normalizePlayer(playerA as ScPlayer, 'demo');
    const byId = new Map(profile.collection.map((c) => [c.id, c]));
    expect(byId.get(26000000)).toMatchObject({ level: 16, evoUnlocked: true, heroUnlocked: true }); // Knight maxed, count=0, evo+hero
    expect(byId.get(26000001)).toMatchObject({ level: 14, evoUnlocked: true, heroUnlocked: false }); // Archers
    expect(byId.get(26000003)).toMatchObject({ level: 14, evoUnlocked: false, heroUnlocked: true }); // Giant hero-only
    expect(byId.get(26000072)).toMatchObject({ level: 13 }); // Archer Queen champion API 3 -> 13
    expect(byId.get(28000011)).toMatchObject({ level: 13 }); // The Log legendary API 5 -> 13
  });

  it('keeps maxed count=0 cards as owned', () => {
    const profile = normalizePlayer(playerA as ScPlayer, 'demo');
    const knight = profile.collection.find((c) => c.id === 26000000)!;
    expect(knight.level).toBe(16);
  });

  it('reads current deck forms and tower troop', () => {
    const profile = normalizePlayer(playerA as ScPlayer, 'demo');
    expect(profile.currentDeck).not.toBeNull();
    expect(profile.currentDeck!.cards).toHaveLength(8);
    expect(profile.currentDeck!.towerTroopId).toBe(159000000); // Tower Princess
    const musk = profile.currentDeck!.cards.find((c) => c.id === 26000014)!;
    const iceGolem = profile.currentDeck!.cards.find((c) => c.id === 26000038)!;
    expect(musk.form).toBe('evo');
    expect(iceGolem.form).toBe('hero');
    expect(profile.currentDeck!.playedAt).toBeNull();
  });

  it('returns null currentDeck when it is not exactly 8 cards (Nadia)', () => {
    const profile = normalizePlayer(playerC as ScPlayer, 'demo');
    expect(profile.currentDeck).toBeNull();
    expect(profile.summary.clan).toBeNull(); // no clan key at all
  });

  it('handles a fully maxed collection (Maximus)', () => {
    const profile = normalizePlayer(playerB as ScPlayer, 'demo');
    expect(profile.collection).toHaveLength(123);
    expect(profile.collection.every((c) => c.level === 16)).toBe(true);
    expect(profile.towerTroops).toHaveLength(4);
    expect(profile.towerTroops.every((t) => t.level === 16)).toBe(true);
  });
});

describe('normalizeBattleDecks', () => {
  const result = normalizeBattleDecks(battlesA as ScBattleLog, '#2CJV0LY8P', 'demo');

  it('keeps only the searched player\'s own 8-card decks, most recent first, deduped', () => {
    expect(result.skipped).toBe(2); // duel (16 cards) + All Random Princess (0 cards)
    expect(result.decks).toHaveLength(3); // hog 2.6 (dup removed), lavaloons (2v2), golem
    // most recent first
    expect(result.decks[0]!.playedAt).toBe('2026-10-12T20:15:40.000Z');
    expect(result.decks[1]!.playedAt).toBe('2026-10-12T18:40:22.000Z');
    expect(result.decks[2]!.playedAt).toBe('2026-10-10T22:11:44.000Z');
  });

  it('picks the searched player out of a 2v2 team and carries the tower troop', () => {
    const lavaloon = result.decks[1]!;
    expect(lavaloon.mode).toBe('TeamVsTeam');
    expect(lavaloon.towerTroopId).toBe(159000002); // Dagger Duchess, not Tower Princess
    expect(lavaloon.cards.map((c) => c.id)).toContain(26000029); // Lava Hound is Clara's, not teammate's
  });

  it('handles empty supportCards and absent forms', () => {
    const golem = result.decks[2]!;
    expect(golem.towerTroopId).toBeNull();
    expect(golem.cards.every((c) => c.form === 'base')).toBe(true);
    expect(golem.mode).toBe('Ladder');
  });

  it('matches the tag case-insensitively and without #', () => {
    const r2 = normalizeBattleDecks(battlesA as ScBattleLog, '2cjv0ly8p', 'demo');
    expect(r2.decks).toHaveLength(3);
  });

  it('skips battles where the player is not in the team', () => {
    const r = normalizeBattleDecks(battlesA as ScBattleLog, '#9QRUGCP0Y', 'demo');
    expect(r.decks).toHaveLength(0);
    expect(r.skipped).toBe(6);
  });

  it('dedupes by signature: same cards + different tower troop are distinct', () => {
    const sigA = deckSignature(result.decks[0]!.cards, 159000000);
    const sigB = deckSignature(result.decks[0]!.cards, 159000001);
    expect(sigA).not.toBe(sigB);
    const sigC = deckSignature([...result.decks[0]!.cards].reverse(), 159000000);
    expect(sigC).toBe(sigA); // order-independent
  });
});

describe('deckSignature', () => {
  it('distinguishes forms', () => {
    const base = deckSignature([{ id: 1, form: 'base' }], null);
    const evo = deckSignature([{ id: 1, form: 'evo' }], null);
    expect(base).not.toBe(evo);
  });
});
