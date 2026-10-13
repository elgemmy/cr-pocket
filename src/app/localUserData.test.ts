import { beforeEach, describe, expect, it } from 'vitest';
import { draftKeyFor } from '@/features/editor/editorState';
import { RECENT_SEARCHES_KEY } from '@/features/player/recentSearches';
import { claimLocalUserData, LOCAL_OWNER_KEY } from './localUserData';

function seed() {
  localStorage.setItem(draftKeyFor('new'), '{}');
  localStorage.setItem(draftKeyFor('deck-1'), '{}');
  localStorage.setItem(RECENT_SEARCHES_KEY, '[]');
  localStorage.setItem('crpocket:catalog:v1', 'keep');
}

describe('claimLocalUserData', () => {
  beforeEach(() => localStorage.clear());

  it('keeps drafts and recents for the same account', () => {
    claimLocalUserData('a');
    seed();
    claimLocalUserData('a');
    expect(localStorage.getItem(draftKeyFor('new'))).toBe('{}');
    expect(localStorage.getItem(RECENT_SEARCHES_KEY)).toBe('[]');
  });

  it('wipes drafts and recents when a different account signs in', () => {
    claimLocalUserData('a');
    seed();
    claimLocalUserData('b');
    expect(localStorage.getItem(draftKeyFor('new'))).toBeNull();
    expect(localStorage.getItem(draftKeyFor('deck-1'))).toBeNull();
    expect(localStorage.getItem(RECENT_SEARCHES_KEY)).toBeNull();
    expect(localStorage.getItem(LOCAL_OWNER_KEY)).toBe('b');
    expect(localStorage.getItem('crpocket:catalog:v1')).toBe('keep');
  });

  it('wipes everything per-account on sign-out', () => {
    claimLocalUserData('a');
    seed();
    claimLocalUserData(null);
    expect(localStorage.getItem(draftKeyFor('deck-1'))).toBeNull();
    expect(localStorage.getItem(RECENT_SEARCHES_KEY)).toBeNull();
    expect(localStorage.getItem(LOCAL_OWNER_KEY)).toBeNull();
    expect(localStorage.getItem('crpocket:catalog:v1')).toBe('keep');
  });
});
