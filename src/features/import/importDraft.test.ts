import { describe, expect, it } from 'vitest';
import { isComplete, TOWER_PRINCESS_ID } from '@/domain/deck';
import { parseDeckLink } from '@/domain/link';
import { fixtureCards, lookupOf, makeCard } from '@/domain/testing';
import { draftFromParsedLink } from './importDraft';

const fx = fixtureCards();
const lookup = lookupOf(fx.all);

function officialLink(ids: number[], tt?: number): string {
  const ttPart = tt != null ? `&tt=${tt}` : '';
  return `https://link.clashroyale.com/en/?clashroyale://copyDeck?deck=${ids.join(';')}${ttPart}&l=Royals`;
}

describe('draftFromParsedLink — official links', () => {
  const ids = [
    fx.tesla.id, // Evo slot per the observed ordering
    fx.goldenKnight.id, // Hero slot
    fx.knight.id, // Wild slot
    fx.skeletons.id,
    28000000,
    28000001,
    28000002,
    28000003,
  ];

  it('preserves the link order 1:1 and keeps forms base (links carry no forms)', () => {
    const parsed = parseDeckLink(officialLink(ids, 159000001));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const { deck, needsFormReview } = draftFromParsedLink(parsed.deck, lookup, 1234);
    expect(deck.slots.map((s) => s.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(deck.slots.map((s) => s.cardId)).toEqual(ids);
    expect(deck.slots[0]?.form).toBe('base'); // tesla in the Evo slot, form not carried by the link
    expect(deck.slots[2]?.form).toBe('base');
    expect(deck.towerTroopId).toBe(159000001);
    expect(deck.source).toEqual({ kind: 'link' });
    expect(deck.createdAt).toBe(1234);
    expect(deck.updatedAt).toBe(1234);
    expect(needsFormReview).toBe(false);
    expect(isComplete(deck)).toBe(true);
  });

  it('promotes a Champion in the Hero slot to its champion form', () => {
    const parsed = parseDeckLink(officialLink(ids));
    if (!parsed.ok) throw new Error('parse failed');
    const { deck } = draftFromParsedLink(parsed.deck, lookup);
    expect(deck.slots[1]?.form).toBe('champion');
  });

  it('keeps a Champion in an ordinary slot as base (the editor warns)', () => {
    const shuffled = [...ids];
    shuffled[1] = 28000009; // move the champion out of the Hero slot…
    shuffled[5] = fx.goldenKnight.id; // …into an ordinary slot
    const parsed = parseDeckLink(officialLink(shuffled));
    if (!parsed.ok) throw new Error('parse failed');
    const { deck } = draftFromParsedLink(parsed.deck, lookup);
    expect(deck.slots[5]?.cardId).toBe(fx.goldenKnight.id);
    expect(deck.slots[5]?.form).toBe('base');
  });

  it('defaults the Tower Troop to null (rendered as Tower Princess)', () => {
    const parsed = parseDeckLink(officialLink(ids));
    if (!parsed.ok) throw new Error('parse failed');
    const { deck } = draftFromParsedLink(parsed.deck, lookup);
    expect(deck.towerTroopId).toBeNull();
    expect(TOWER_PRINCESS_ID).toBe(159000000);
  });

  it('parses a bare clashroyale:// link embedded in other text', () => {
    const text = `check this deck!! clashroyale://copyDeck?deck=${ids.join(';')}&l=Royals so good`;
    const parsed = parseDeckLink(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const { deck } = draftFromParsedLink(parsed.deck, lookup);
    expect(deck.slots.map((s) => s.cardId)).toEqual(ids);
  });
});

describe('draftFromParsedLink — RoyaleAPI URLs', () => {
  const archers = makeCard({ id: 26000001, name: 'Archers' });
  const arrows = makeCard({ id: 26000002, name: 'Arrows' });
  const catalog = { cards: [...fx.all, archers, arrows] };
  const rapLookup = lookupOf(catalog.cards);

  it('places detected forms into the special slots via inference', () => {
    const url =
      'https://royaleapi.com/decks/stats/tesla-ev1,electro-wizard-hero,knight,skeletons,golden-knight,archers,arrows,mystery';
    const parsed = parseDeckLink(url, catalog);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const { deck, needsFormReview } = draftFromParsedLink(parsed.deck, rapLookup);
    expect(deck.slots[0]).toMatchObject({ cardId: fx.tesla.id, form: 'evo' });
    expect(deck.slots[1]).toMatchObject({ cardId: fx.electroWizard.id, form: 'hero' });
    // Second hero-kind special lands in the Wild slot → placement was guessed.
    expect(deck.slots[2]).toMatchObject({ cardId: fx.goldenKnight.id, form: 'champion' });
    expect(needsFormReview).toBe(true);
    expect(isComplete(deck)).toBe(true);
    expect(deck.source).toEqual({ kind: 'link' });
  });

  it('keeps order and base forms when no forms are marked', () => {
    const url = 'https://royaleapi.com/decks/stats/tesla,electro-wizard,knight,skeletons,archers,arrows,mystery,tesla';
    // duplicate tesla → parse error
    expect(parseDeckLink(url, catalog).ok).toBe(false);

    const ok = parseDeckLink(
      'https://royaleapi.com/decks/stats/tesla,electro-wizard,knight,skeletons,golden-knight,archers,arrows,mystery',
      catalog,
    );
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    const { deck, needsFormReview } = draftFromParsedLink(ok.deck, rapLookup);
    // Golden Knight is a champion: it is promoted into a special slot even without a marker.
    expect(deck.slots[0]).toMatchObject({ cardId: fx.tesla.id, form: 'base' });
    expect(deck.slots[1]).toMatchObject({ cardId: fx.goldenKnight.id, form: 'champion' });
    expect(needsFormReview).toBe(false);
  });
});
