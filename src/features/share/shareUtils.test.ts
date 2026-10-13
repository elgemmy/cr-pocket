import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard, preferMobileHandoff, type MediaMatcher } from './shareUtils';

function matcherOf(map: Record<string, boolean>): MediaMatcher {
  return (query) => ({ matches: map[query] ?? false });
}

describe('preferMobileHandoff', () => {
  it('is true only for coarse pointers on small screens', () => {
    expect(
      preferMobileHandoff(matcherOf({ '(pointer: coarse)': true, '(max-width: 767px)': true })),
    ).toBe(true);
  });

  it('is false on desktop (fine pointer), even when the window is narrow', () => {
    expect(
      preferMobileHandoff(matcherOf({ '(pointer: coarse)': false, '(max-width: 767px)': true })),
    ).toBe(false);
  });

  it('is false on large touch screens (tablets get the desktop QR treatment)', () => {
    expect(
      preferMobileHandoff(matcherOf({ '(pointer: coarse)': true, '(max-width: 767px)': false })),
    ).toBe(false);
  });

  it('never throws when matchMedia is unavailable', () => {
    expect(preferMobileHandoff(() => ({ matches: false }))).toBe(false);
  });
});

describe('copyTextToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses the async clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyTextToClipboard('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back and reports failure when copy is impossible', async () => {
    vi.stubGlobal('navigator', {}); // no clipboard API
    // jsdom has no execCommand → fallback must report failure, not throw.
    await expect(copyTextToClipboard('hello')).resolves.toBe(false);
  });

  it('returns false when the clipboard write is rejected (permission denied)', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyTextToClipboard('hello')).resolves.toBe(false);
  });
});
