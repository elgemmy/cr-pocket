import { describe, expect, it } from 'vitest';
import {
  allowedForms,
  defaultFormFor,
  FORM_LABELS,
  isFormAllowed,
  normalizeFormForRole,
  normalizeFormsOnMove,
  ownershipWarning,
  portraitFor,
  SLOT_LABELS,
  slotRole,
} from './slots';
import { fixtureCards, lookupOf, makeCard, makeDeck, makeOwned } from './testing';

const { knight, tesla, electroWizard, skeletons, goldenKnight } = fixtureCards();
// knight: evo+hero, tesla: evo only, electroWizard: hero only (hero art missing),
// skeletons: plain, goldenKnight: champion

describe('slotRole', () => {
  it('maps positions to roles', () => {
    expect(slotRole(0)).toBe('evo');
    expect(slotRole(1)).toBe('hero');
    expect(slotRole(2)).toBe('wild');
    for (const p of [3, 4, 5, 6, 7]) expect(slotRole(p)).toBe('normal');
  });

  it('rejects out-of-range positions', () => {
    expect(() => slotRole(-1)).toThrow(RangeError);
    expect(() => slotRole(8)).toThrow(RangeError);
  });

  it('has labels for every role and form', () => {
    expect(SLOT_LABELS).toEqual({ evo: 'Evo', hero: 'Hero', wild: 'Wild', normal: 'Normal' });
    expect(FORM_LABELS.champion).toBe('Champion');
  });
});

describe('allowedForms', () => {
  it('evo slot: base + evo only when the card can evolve', () => {
    expect(allowedForms('evo', tesla)).toEqual(['base', 'evo']);
    expect(allowedForms('evo', skeletons)).toEqual(['base']);
    expect(allowedForms('evo', electroWizard)).toEqual(['base']); // hero-only card
  });

  it('hero slot: hero for hero-capable, champion for champions', () => {
    expect(allowedForms('hero', electroWizard)).toEqual(['base', 'hero']);
    expect(allowedForms('hero', knight)).toEqual(['base', 'hero']); // canEvo irrelevant here
    expect(allowedForms('hero', goldenKnight)).toEqual(['base', 'champion']);
    expect(allowedForms('hero', tesla)).toEqual(['base']);
  });

  it('wild slot: union of applicable forms', () => {
    expect(allowedForms('wild', knight)).toEqual(['base', 'evo', 'hero']);
    expect(allowedForms('wild', tesla)).toEqual(['base', 'evo']);
    expect(allowedForms('wild', electroWizard)).toEqual(['base', 'hero']);
    expect(allowedForms('wild', goldenKnight)).toEqual(['base', 'champion']);
    expect(allowedForms('wild', skeletons)).toEqual(['base']);
  });

  it('normal slots: base only', () => {
    for (const card of [knight, tesla, electroWizard, skeletons, goldenKnight]) {
      expect(allowedForms('normal', card)).toEqual(['base']);
    }
  });

  it('isFormAllowed mirrors allowedForms', () => {
    expect(isFormAllowed('wild', 'hero', knight)).toBe(true);
    expect(isFormAllowed('normal', 'evo', tesla)).toBe(false);
    expect(isFormAllowed('evo', 'champion', goldenKnight)).toBe(false);
  });
});

describe('defaultFormFor', () => {
  it('activates the applicable form', () => {
    expect(defaultFormFor('evo', tesla)).toBe('evo');
    expect(defaultFormFor('evo', skeletons)).toBe('base');
    expect(defaultFormFor('hero', electroWizard)).toBe('hero');
    expect(defaultFormFor('hero', goldenKnight)).toBe('champion');
    expect(defaultFormFor('wild', goldenKnight)).toBe('champion');
  });

  it('wild slot defaults to evo when a card has both forms (in-game behaviour)', () => {
    expect(defaultFormFor('wild', knight)).toBe('evo');
  });

  it('normal slots are always base', () => {
    expect(defaultFormFor('normal', knight)).toBe('base');
  });
});

describe('normalizeFormForRole / normalizeFormsOnMove', () => {
  it('downgrades a disallowed form to base', () => {
    expect(normalizeFormForRole('normal', 'evo', tesla)).toBe('base');
    expect(normalizeFormForRole('evo', 'hero', knight)).toBe('base');
    expect(normalizeFormForRole('wild', 'hero', knight)).toBe('hero');
  });

  it('restores base portrait when an evo card moves to an ordinary slot', () => {
    const lookup = lookupOf([tesla, skeletons]);
    const deck = makeDeck({
      slots: makeDeck().slots.map((s) =>
        s.position === 0
          ? { ...s, cardId: tesla.id, form: 'evo' as const }
          : s.position === 3
            ? { ...s, cardId: tesla.id, form: 'evo' as const } // stale, must downgrade
            : s,
      ),
    });
    // note: duplicate ids are fine for this pure normalization helper
    const next = normalizeFormsOnMove(deck, lookup);
    expect(next.slots[0]?.form).toBe('evo'); // evo slot keeps it
    expect(next.slots[3]?.form).toBe('base'); // normal slot downgrades
  });

  it('does not corrupt forms of cards missing from the catalog', () => {
    const deck = makeDeck({
      slots: makeDeck().slots.map((s) =>
        s.position === 0 ? { ...s, cardId: 424242, form: 'evo' as const } : s,
      ),
    });
    const next = normalizeFormsOnMove(deck, lookupOf([]));
    expect(next.slots[0]?.form).toBe('evo');
  });

  it('returns the same deck object when nothing changes', () => {
    const lookup = lookupOf([tesla]);
    const deck = makeDeck({
      slots: makeDeck().slots.map((s) =>
        s.position === 0 ? { ...s, cardId: tesla.id, form: 'evo' as const } : s,
      ),
    });
    expect(normalizeFormsOnMove(deck, lookup)).toBe(deck);
  });
});

describe('portraitFor', () => {
  it('uses form-specific art when available', () => {
    expect(portraitFor(tesla, 'evo')).toEqual({ url: 'https://art/tesla-evo.png', usedFallback: false });
    expect(portraitFor(knight, 'hero')).toEqual({ url: 'https://art/knight-hero.png', usedFallback: false });
    expect(portraitFor(skeletons, 'base')).toEqual({ url: skeletons.art.base, usedFallback: false });
  });

  it('champion form uses hero art', () => {
    expect(portraitFor(goldenKnight, 'champion')).toEqual({
      url: 'https://art/gk-hero.png',
      usedFallback: false,
    });
  });

  it('falls back to base art with usedFallback when alternate art is missing', () => {
    const p = portraitFor(electroWizard, 'hero');
    expect(p.url).toBe('https://art/ewiz.png');
    expect(p.usedFallback).toBe(true);
  });

  it('returns null url only when even base art is missing', () => {
    const artless = makeCard({ art: { base: null, evo: null, hero: null } });
    expect(portraitFor(artless, 'base')).toEqual({ url: null, usedFallback: false });
    expect(portraitFor(artless, 'evo')).toEqual({ url: null, usedFallback: true });
  });
});

describe('ownershipWarning', () => {
  it("is 'unknown' when no collection is loaded", () => {
    expect(ownershipWarning(tesla, 'evo', undefined)).toBe('unknown');
  });

  it("is 'not_owned' when the collection is loaded and the card is absent", () => {
    expect(ownershipWarning(tesla, 'base', null)).toBe('not_owned');
    expect(ownershipWarning(tesla, 'evo', null)).toBe('not_owned');
  });

  it("is 'form_locked' when the card is owned but the form is not unlocked", () => {
    expect(ownershipWarning(tesla, 'evo', makeOwned({ evoUnlocked: false }))).toBe('form_locked');
    expect(ownershipWarning(knight, 'hero', makeOwned({ heroUnlocked: false }))).toBe('form_locked');
  });

  it('is null when card and form are owned/unlocked', () => {
    expect(ownershipWarning(tesla, 'evo', makeOwned({ evoUnlocked: true }))).toBeNull();
    expect(ownershipWarning(tesla, 'base', makeOwned())).toBeNull();
    expect(ownershipWarning(knight, 'hero', makeOwned({ heroUnlocked: true }))).toBeNull();
  });

  it('champions only require owning the card (no separate unlock flag)', () => {
    expect(ownershipWarning(goldenKnight, 'champion', makeOwned())).toBeNull();
  });
});
