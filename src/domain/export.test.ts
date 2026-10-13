import { describe, expect, it } from 'vitest';
import {
  exportLibraryJson,
  LIBRARY_EXPORT_APP,
  LIBRARY_EXPORT_SCHEMA,
  parseLibraryJson,
} from './export';
import { completeDeck, makeDeck } from './testing';

describe('exportLibraryJson', () => {
  it('produces a versioned, self-describing pretty JSON document', () => {
    const deck = completeDeck();
    const json = exportLibraryJson([deck], {
      playerTag: '#C0G20PR2',
      categories: [],
      tagPromptDismissed: false,
    });
    const parsed = JSON.parse(json);
    expect(parsed.app).toBe(LIBRARY_EXPORT_APP);
    expect(parsed.schema).toBe(LIBRARY_EXPORT_SCHEMA);
    expect(typeof parsed.exportedAt).toBe('string');
    expect(parsed.profile).toEqual({ playerTag: '#C0G20PR2' });
    expect(parsed.decks).toHaveLength(1);
    expect(parsed.decks[0].id).toBe(deck.id);
    expect(json).toContain('\n'); // pretty-printed
  });

  it('handles a null profile', () => {
    const parsed = JSON.parse(exportLibraryJson([], null));
    expect(parsed.profile).toEqual({ playerTag: null });
  });
});

describe('parseLibraryJson', () => {
  it('round-trips an export', () => {
    const decks = [completeDeck({ id: 'a' }), makeDeck({ id: 'b', name: 'Draft' })];
    const json = exportLibraryJson(decks, {
      playerTag: '#ABC',
      categories: [],
      tagPromptDismissed: false,
    });
    const res = parseLibraryJson(json);
    expect(res.ok).toBe(true);
    expect(res.error).toBeNull();
    expect(res.decks).toEqual(decks);
    expect(res.profile).toEqual({ playerTag: '#ABC' });
    expect(res.skipped).toEqual([]);
  });

  it('fails cleanly on non-JSON', () => {
    const res = parseLibraryJson('{not json');
    expect(res).toMatchObject({ ok: false, error: 'invalid_json' });
  });

  it('fails cleanly on wrong top-level shape', () => {
    expect(parseLibraryJson('"hello"')).toMatchObject({ ok: false, error: 'invalid_shape' });
    expect(parseLibraryJson('{"app":"cr-pocket"}')).toMatchObject({
      ok: false,
      error: 'invalid_shape',
    });
  });

  it("rejects another app's export", () => {
    const res = parseLibraryJson(JSON.stringify({ app: 'other-app', decks: [] }));
    expect(res).toMatchObject({ ok: false, error: 'wrong_app' });
  });

  it('skips bad entries and keeps the good ones', () => {
    const good = completeDeck({ id: 'good' });
    const file = {
      app: LIBRARY_EXPORT_APP,
      schema: 1,
      exportedAt: 'x',
      profile: { playerTag: null },
      decks: [
        good,
        null, // not an object
        { id: 'no-slots' },
        { id: 'bad-form', slots: good.slots.map((s) => ({ ...s, form: 'mega' })) },
        { ...good, id: 'dupe-cards', slots: good.slots.map((s) => ({ ...s, cardId: 100 })) },
        { ...good, id: 'bad-version', schemaVersion: 99 },
      ],
    };
    const res = parseLibraryJson(JSON.stringify(file));
    expect(res.ok).toBe(true);
    expect(res.decks.map((d) => d.id)).toEqual(['good']);
    expect(res.skipped).toHaveLength(5);
    expect(res.skipped.map((s) => s.index)).toEqual([1, 2, 3, 4, 5]);
    expect(res.skipped[3]?.reason).toContain('duplicate');
    expect(res.skipped[4]?.reason).toContain('schemaVersion');
  });

  it('coerces missing optional fields to safe defaults', () => {
    const minimal = {
      id: 'm',
      slots: Array.from({ length: 8 }, (_, position) => ({ position, cardId: null, form: 'base' })),
    };
    const res = parseLibraryJson(JSON.stringify({ decks: [minimal] }), 777);
    expect(res.ok).toBe(true);
    const deck = res.decks[0]!;
    expect(deck.name).toBe('Imported deck');
    expect(deck.notes).toBe('');
    expect(deck.favorite).toBe(false);
    expect(deck.towerTroopId).toBeNull();
    expect(deck.categoryIds).toEqual([]);
    expect(deck.source).toEqual({ kind: 'manual' });
    expect(deck.createdAt).toBe(777);
    expect(deck.schemaVersion).toBe(1);
  });

  it('preserves source attribution when present', () => {
    const deck = {
      ...completeDeck({ id: 'src' }),
      source: { kind: 'player', playerTag: '#XYZ', playerName: 'Pro', context: 'recent', playedAt: '2026-10-01' },
    };
    const res = parseLibraryJson(JSON.stringify({ decks: [deck] }));
    expect(res.decks[0]?.source).toEqual({
      kind: 'player',
      playerTag: '#XYZ',
      playerName: 'Pro',
      context: 'recent',
      playedAt: '2026-10-01',
    });
  });

  it('drops invalid source kinds but keeps the deck', () => {
    const deck = { ...completeDeck({ id: 'src2' }), source: { kind: 'hacked' } };
    const res = parseLibraryJson(JSON.stringify({ decks: [deck] }));
    expect(res.decks[0]?.source).toEqual({ kind: 'manual' });
  });

  it('rejects slots with wrong length or positions', () => {
    const short = { id: 's', slots: [{ position: 0, cardId: 1, form: 'base' }] };
    const res = parseLibraryJson(JSON.stringify({ decks: [short] }));
    expect(res.decks).toHaveLength(0);
    expect(res.skipped[0]?.reason).toContain('8');
  });
});
