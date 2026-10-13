import { describe, expect, it } from 'vitest';
import {
  buildDeckLink,
  formsReminder,
  parseDeckLink,
  royaleApiKey,
  TOWER_TROOP_LINK_VERIFIED,
} from './link';
import { TOWER_PRINCESS_ID } from './deck';
import { completeDeck, fixtureCards, lookupOf, makeCard } from './testing';

const fx = fixtureCards();
const lookup = lookupOf(fx.all);

// Real link observed live on deckbeacon.app (Oct 2026).
const OBSERVED =
  'https://link.clashroyale.com/en/?clashroyale://copyDeck?deck=26000001;26000000;27000006;26000010;26000030;28000011;28000000;27000008&tt=159000000&l=Royals';
const OBSERVED_IDS = [26000001, 26000000, 27000006, 26000010, 26000030, 28000011, 28000000, 27000008];

describe('buildDeckLink', () => {
  it('builds the official raw-inner link format', () => {
    const deck = completeDeck({
      slots: completeDeck().slots.map((s, i) => ({ ...s, cardId: OBSERVED_IDS[i]! })),
    });
    const link = buildDeckLink(deck);
    expect(link).toBe(
      'https://link.clashroyale.com/en/?clashroyale://copyDeck?deck=26000001;26000000;27000006;26000010;26000030;28000011;28000000;27000008&l=Royals',
    );
  });

  it('returns null for an incomplete deck', () => {
    expect(buildDeckLink(completeDeck({ slots: completeDeck().slots.slice(0, 7) }))).toBeNull();
    const withNull = completeDeck();
    withNull.slots[4]!.cardId = null;
    expect(buildDeckLink(withNull)).toBeNull();
  });

  it(`omits the tower troop while TOWER_TROOP_LINK_VERIFIED is false`, () => {
    expect(TOWER_TROOP_LINK_VERIFIED).toBe(false);
    const deck = { ...completeDeck(), towerTroopId: TOWER_PRINCESS_ID };
    expect(buildDeckLink(deck)).not.toContain('tt=');
    expect(buildDeckLink(deck, {})).not.toContain('tt=');
  });

  it('includes &tt= only when explicitly opted in', () => {
    const deck = { ...completeDeck(), towerTroopId: TOWER_PRINCESS_ID };
    const link = buildDeckLink(deck, { includeTowerTroop: true });
    expect(link).toContain(`&tt=${TOWER_PRINCESS_ID}&l=Royals`);
  });

  it('never emits tt for a null tower troop', () => {
    expect(buildDeckLink(completeDeck(), { includeTowerTroop: true })).not.toContain('tt=');
  });
});

describe('parseDeckLink — official links', () => {
  it('parses a real observed link', () => {
    const res = parseDeckLink(OBSERVED);
    expect(res).toMatchObject({ ok: true });
    if (!res.ok) return;
    expect(res.deck.cardIds).toEqual(OBSERVED_IDS);
    expect(res.deck.towerTroopId).toBe(159000000);
    expect(res.deck.forms).toEqual(Array(8).fill('base'));
    expect(res.deck.source).toBe('official');
    expect(res.deck.specialSlotHint).toEqual([0, 1, 2]);
  });

  it('parses a bare clashroyale:// deep link', () => {
    const res = parseDeckLink('clashroyale://copyDeck?deck=1;2;3;4;5;6;7;8&l=Royals');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.deck.cardIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(res.deck.towerTroopId).toBeNull();
    }
  });

  it('parses a link embedded in YouTube-description-like text', () => {
    const text = `Best deck this season! 🔥\nCopy it here: ${OBSERVED}\nSubscribe for more`;
    const res = parseDeckLink(text);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.deck.cardIds).toEqual(OBSERVED_IDS);
  });

  it('parses percent-encoded variants', () => {
    const inner = 'clashroyale://copyDeck?deck=1;2;3;4;5;6;7;8&tt=159000000&l=Royals';
    const encoded = `https://link.clashroyale.com/en/?${encodeURIComponent(inner)}`;
    const res = parseDeckLink(encoded);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.deck.cardIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(res.deck.towerTroopId).toBe(159000000);
    }
  });

  it('handles &amp; from HTML contexts', () => {
    const res = parseDeckLink(
      'clashroyale://copyDeck?deck=1;2;3;4;5;6;7;8&amp;tt=159000000&amp;l=Royals',
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.deck.towerTroopId).toBe(159000000);
  });

  it('buildDeckLink output round-trips through parseDeckLink', () => {
    const deck = { ...completeDeck(), towerTroopId: TOWER_PRINCESS_ID };
    const link = buildDeckLink(deck, { includeTowerTroop: true });
    expect(link).not.toBeNull();
    const res = parseDeckLink(link!);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.deck.cardIds).toEqual(deck.slots.map((s) => s.cardId));
      expect(res.deck.towerTroopId).toBe(TOWER_PRINCESS_ID);
    }
  });

  it('rejects wrong card counts', () => {
    const res = parseDeckLink('clashroyale://copyDeck?deck=1;2;3;4;5;6;7');
    expect(res).toMatchObject({ ok: false, error: 'wrong_count' });
  });

  it('rejects duplicate cards', () => {
    const res = parseDeckLink('clashroyale://copyDeck?deck=1;2;3;4;5;6;7;7');
    expect(res).toMatchObject({ ok: false, error: 'duplicate' });
  });

  it('rejects non-numeric ids', () => {
    const res = parseDeckLink('clashroyale://copyDeck?deck=1;2;3;4;5;6;7;abc');
    expect(res).toMatchObject({ ok: false, error: 'unknown_cards' });
    if (!res.ok) expect(res.unknownCards).toContain('abc');
  });

  it("returns 'not_found' for unrelated text", () => {
    expect(parseDeckLink('check out my awesome deck bro')).toMatchObject({
      ok: false,
      error: 'not_found',
    });
    expect(parseDeckLink('')).toMatchObject({ ok: false, error: 'not_found' });
    expect(parseDeckLink('https://example.com/deck?id=123')).toMatchObject({
      ok: false,
      error: 'not_found',
    });
  });
});

describe('parseDeckLink — RoyaleAPI URLs', () => {
  const rapiCatalog = {
    cards: [
      fx.knight,
      fx.tesla,
      fx.skeletons,
      makeCard({ id: 26000026, name: 'Princess' }),
      makeCard({ id: 28000004, name: 'Goblin Barrel' }),
      makeCard({ id: 26000030, name: 'Ice Spirit' }),
      makeCard({ id: 28000011, name: 'The Log' }),
      makeCard({ id: 26000040, name: 'Dart Goblin' }),
    ],
  };

  it('maps slugified card names to ids via the catalog', () => {
    const res = parseDeckLink(
      'https://royaleapi.com/decks/stats/knight,tesla,skeletons,princess,goblin-barrel,ice-spirit,the-log,dart-goblin',
      rapiCatalog,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.deck.cardIds).toEqual([
        fx.knight.id,
        fx.tesla.id,
        fx.skeletons.id,
        26000026,
        28000004,
        26000030,
        28000011,
        26000040,
      ]);
      expect(res.deck.source).toBe('royaleapi');
      expect(res.deck.towerTroopId).toBeNull();
    }
  });

  it('detects forms from -ev1 / -hero suffixes', () => {
    const res = parseDeckLink(
      'https://royaleapi.com/decks/stats/knight-hero,tesla-ev1,skeletons,princess,goblin-barrel,ice-spirit,the-log,dart-goblin',
      rapiCatalog,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.deck.forms[0]).toBe('hero');
      expect(res.deck.forms[1]).toBe('evo');
      expect(res.deck.forms[2]).toBe('base');
    }
  });

  it('marks champions as champion form', () => {
    const res = parseDeckLink(
      `https://royaleapi.com/decks/stats/golden-knight,tesla,skeletons,princess,goblin-barrel,ice-spirit,the-log,dart-goblin`,
      { cards: [...rapiCatalog.cards, fx.goldenKnight] },
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.deck.forms[0]).toBe('champion');
  });

  it('requires a catalog for RoyaleAPI URLs', () => {
    const res = parseDeckLink('https://royaleapi.com/decks/stats/knight,tesla');
    expect(res).toMatchObject({ ok: false, error: 'unknown_cards' });
  });

  it('reports unknown card keys', () => {
    const res = parseDeckLink(
      'https://royaleapi.com/decks/stats/knight,tesla,skeletons,princess,goblin-barrel,ice-spirit,the-log,brand-new-card',
      rapiCatalog,
    );
    expect(res).toMatchObject({ ok: false, error: 'unknown_cards' });
    if (!res.ok) expect(res.unknownCards).toEqual(['brand-new-card']);
  });
});

describe('royaleApiKey', () => {
  it('slugifies card names the way RoyaleAPI does', () => {
    expect(royaleApiKey('P.E.K.K.A')).toBe('pekka');
    expect(royaleApiKey('Mini P.E.K.K.A')).toBe('mini-pekka');
    expect(royaleApiKey('The Log')).toBe('the-log');
    expect(royaleApiKey('Royal Hogs')).toBe('royal-hogs');
    expect(royaleApiKey("King's Custom")).toBe('kings-custom');
  });
});

describe('formsReminder', () => {
  it('lists every non-base form with role and card name', () => {
    const base = completeDeck();
    const deck = {
      ...base,
      slots: base.slots.map((s, i) =>
        i === 0
          ? { ...s, cardId: fx.tesla.id, form: 'evo' as const }
          : i === 1
            ? { ...s, cardId: fx.goldenKnight.id, form: 'champion' as const }
            : i === 2
              ? { ...s, cardId: fx.knight.id, form: 'hero' as const }
              : s,
      ),
    };
    const reminders = formsReminder(deck, lookup);
    expect(reminders).toHaveLength(3);
    expect(reminders[0]).toMatchObject({
      position: 0,
      role: 'evo',
      roleLabel: 'Evo',
      cardName: 'Tesla',
      form: 'evo',
      formLabel: 'Evo',
    });
    expect(reminders[1]).toMatchObject({ role: 'hero', cardName: 'Golden Knight', form: 'champion' });
    expect(reminders[2]).toMatchObject({ role: 'wild', cardName: 'Knight', form: 'hero' });
  });

  it('is empty for an all-base deck', () => {
    expect(formsReminder(completeDeck(), lookup)).toEqual([]);
  });

  it('labels unknown cards by id without crashing', () => {
    const base = completeDeck();
    const deck = {
      ...base,
      slots: base.slots.map((s, i) => (i === 0 ? { ...s, cardId: 424242, form: 'evo' as const } : s)),
    };
    const reminders = formsReminder(deck, lookup);
    expect(reminders[0]?.cardName).toBe('Unknown card 424242');
  });
});
