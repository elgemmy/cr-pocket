import { describe, expect, it } from 'vitest';
import type { PlayedDeck } from '@shared/types';
import { fixtureCards, lookupOf, makeCard } from '@/domain/testing';
import {
  hideCurrentDupes,
  playedAvgElixir,
  playedMeta,
  prettifyMode,
  suggestDeckName,
  timeAgo,
} from './playerView';

const fx = fixtureCards();
const lookup = lookupOf(fx.all);

function played(ids: number[], towerTroopId: number | null = null, extra: Partial<PlayedDeck> = {}): PlayedDeck {
  return {
    cards: ids.map((id) => ({ id, form: 'base' as const })),
    towerTroopId,
    playedAt: null,
    mode: null,
    ...extra,
  };
}

describe('prettifyMode', () => {
  it('maps known modes to friendly labels', () => {
    expect(prettifyMode('Ladder')).toBe('Ladder');
    expect(prettifyMode('pathOfLegend')).toBe('Path of Legends');
    expect(prettifyMode('TeamVsTeam')).toBe('2v2 Battle');
  });

  it('de-camelizes and de-underscores unknown modes', () => {
    expect(prettifyMode('All_Random_Princess')).toBe('All Random Princess');
    expect(prettifyMode('someNewMode2027')).toBe('Some New Mode2027');
  });

  it('returns null for missing/blank modes', () => {
    expect(prettifyMode(null)).toBeNull();
    expect(prettifyMode('')).toBeNull();
  });
});

describe('timeAgo', () => {
  const now = Date.parse('2026-10-13T12:00:00Z');
  const at = (iso: string) => timeAgo(iso, now);

  it('formats recent times compactly', () => {
    expect(at('2026-10-13T11:59:40Z')).toBe('just now');
    expect(at('2026-10-13T11:45:00Z')).toBe('15m ago');
    expect(at('2026-10-13T10:00:00Z')).toBe('2h ago');
    expect(at('2026-10-10T12:00:00Z')).toBe('3d ago');
    expect(at('2026-09-01T12:00:00Z')).toBe('6w ago');
  });

  it('returns "" for unparseable timestamps and never goes negative', () => {
    expect(at('not a date')).toBe('');
    expect(at('2027-01-01T00:00:00Z')).toBe('just now');
  });
});

describe('playedMeta', () => {
  it('combines relative time and mode', () => {
    const now = Date.parse('2026-10-13T12:00:00Z');
    const d = played([1, 2, 3, 4, 5, 6, 7, 8], null, { playedAt: '2026-10-13T10:00:00Z', mode: 'Ladder' });
    expect(playedMeta(d, now)).toBe('Played 2h ago · Ladder');
  });

  it('omits unknown parts gracefully', () => {
    expect(playedMeta(played([1, 2, 3, 4, 5, 6, 7, 8]), 0)).toBe('');
    const modeOnly = played([1, 2, 3, 4, 5, 6, 7, 8], null, { mode: 'Ladder' });
    expect(playedMeta(modeOnly, 0)).toBe('Ladder');
  });
});

describe('hideCurrentDupes', () => {
  const ids = [26000000, 27000006, 26000042, 26000010, 28000000, 28000001, 28000002, 28000003];

  it('returns everything when there is no current deck', () => {
    const recent = [played(ids)];
    expect(hideCurrentDupes(recent, null)).toEqual(recent);
  });

  it('hides a recent deck identical to the current deck', () => {
    const current = played(ids, 159000000);
    const dupe = played(ids, 159000000, { playedAt: '2026-10-12T00:00:00Z', mode: 'Ladder' });
    const other = played([...ids.slice(0, 7), 28000004], 159000000);
    expect(hideCurrentDupes([dupe, other], current)).toEqual([other]);
  });

  it('keeps a recent deck with the same cards but a different Tower Troop', () => {
    const current = played(ids, 159000000);
    const variant = played(ids, 159000001);
    expect(hideCurrentDupes([variant], current)).toEqual([variant]);
  });

  it('keeps a recent deck with the same cards but a different active form', () => {
    const current = played(ids, null);
    const evoVariant: PlayedDeck = {
      ...played(ids, null),
      cards: ids.map((id, i) => ({ id, form: i === 0 ? ('evo' as const) : ('base' as const) })),
    };
    expect(hideCurrentDupes([evoVariant], current)).toEqual([evoVariant]);
  });
});

describe('playedAvgElixir', () => {
  it('averages known card costs to one decimal', () => {
    // knight 3, tesla 4, ewiz 4, skeletons 1 → 12/4 = 3
    const d = played([fx.knight.id, fx.tesla.id, fx.electroWizard.id, fx.skeletons.id]);
    expect(playedAvgElixir(d, lookup)).toBe(3);
  });

  it('returns null when any card or cost is unknown', () => {
    const unknownId = played([fx.knight.id, 99999999]);
    expect(playedAvgElixir(unknownId, lookup)).toBeNull();
    const unknownCost = played([fx.knight.id, fx.unknownElixir.id]);
    expect(playedAvgElixir(unknownCost, lookup)).toBeNull();
  });
});

describe('suggestDeckName', () => {
  it('names the deck after its two most expensive cards', () => {
    // all 4-cost except skeletons: Electro Wizard < Golden Knight < Tesla by name
    const ids = [fx.knight.id, fx.tesla.id, fx.electroWizard.id, fx.skeletons.id, fx.goldenKnight.id];
    expect(suggestDeckName(ids, lookup)).toBe('Electro Wizard · Golden Knight');
  });

  it('prefixes the owner name when given', () => {
    const ids = [fx.knight.id, fx.skeletons.id];
    expect(suggestDeckName(ids, lookup, 'Clara')).toBe("Clara's Knight · Skeletons");
  });

  it('falls back gracefully when cards are unknown', () => {
    const unknown = lookupOf([makeCard({ id: 1 })]);
    expect(suggestDeckName([111, 222], unknown, 'Clara')).toBe("Clara's deck");
    expect(suggestDeckName([111, 222], unknown)).toBe('Imported deck');
  });
});
