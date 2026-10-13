import { describe, expect, it } from 'vitest';
import { isValidTag, normalizeTag, tagForUrl, TAG_CHARSET } from './tag';

describe('normalizeTag', () => {
  it('uppercases and adds the leading #', () => {
    expect(normalizeTag('c0g20pr2')).toBe('#C0G20PR2');
    expect(normalizeTag('C0G20PR2')).toBe('#C0G20PR2');
  });

  it('keeps an existing # and strips surrounding whitespace', () => {
    expect(normalizeTag('  #C0G20PR2  ')).toBe('#C0G20PR2');
  });

  it('strips internal spaces', () => {
    expect(normalizeTag('#C0G2 0PR2')).toBe('#C0G20PR2');
    expect(normalizeTag('C0G 20PR2')).toBe('#C0G20PR2');
  });

  it('maps the letter O to digit 0 (common typo)', () => {
    expect(normalizeTag('#COG20PR2')).toBe('#C0G20PR2');
    expect(normalizeTag('cog20pr2')).toBe('#C0G20PR2');
  });

  it('rejects empty and null-ish input', () => {
    expect(normalizeTag('')).toBeNull();
    expect(normalizeTag('   ')).toBeNull();
    expect(normalizeTag('#')).toBeNull();
    expect(normalizeTag(null)).toBeNull();
    expect(normalizeTag(undefined)).toBeNull();
  });

  it('rejects characters outside the CR charset', () => {
    // 1, A, B, D, E, F, H, I, K, M, N, S, T, W, X, Z are not in the alphabet
    expect(normalizeTag('#ABC123')).toBeNull();
    expect(normalizeTag('#HELLO')).toBeNull();
    expect(normalizeTag('#C0G20PR!')).toBeNull();
    expect(normalizeTag('#C0G2-0PR2')).toBeNull();
  });

  it('enforces a plausible length (3–14 without #)', () => {
    expect(normalizeTag('#22')).toBeNull();
    expect(normalizeTag('#222')).toBe('#222');
    expect(normalizeTag(`#${'2'.repeat(14)}`)).toBe(`#${'2'.repeat(14)}`);
    expect(normalizeTag(`#${'2'.repeat(15)}`)).toBeNull();
  });

  it('accepts every charset character', () => {
    const tag = `#${TAG_CHARSET.slice(0, 9)}`;
    expect(normalizeTag(tag.toLowerCase())).toBe(tag);
  });
});

describe('isValidTag', () => {
  it('accepts with or without # and is case-insensitive', () => {
    expect(isValidTag('#C0G20PR2')).toBe(true);
    expect(isValidTag('c0g20pr2')).toBe(true);
    expect(isValidTag('#c0g20pr2!')).toBe(false);
    expect(isValidTag('')).toBe(false);
  });
});

describe('tagForUrl', () => {
  it('percent-encodes the # for API paths', () => {
    expect(tagForUrl('c0g20pr2')).toBe('%23C0G20PR2');
    expect(tagForUrl('#C0G20PR2')).toBe('%23C0G20PR2');
  });

  it('returns null for invalid input', () => {
    expect(tagForUrl('not a tag')).toBeNull();
    expect(tagForUrl('')).toBeNull();
  });
});
