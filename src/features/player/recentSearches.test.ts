import { describe, expect, it } from 'vitest';
import {
  loadRecentSearches,
  MAX_RECENT_SEARCHES,
  RECENT_SEARCHES_KEY,
  rememberSearch,
  removeSearch,
  saveRecentSearches,
  type RecentSearch,
} from './recentSearches';

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const entry = (tag: string, name = '', at = 1): RecentSearch => ({ tag, name, at });

describe('rememberSearch', () => {
  it('prepends new searches', () => {
    const next = rememberSearch([entry('#AAA')], '#BBB', 'Bob', 2);
    expect(next.map((e) => e.tag)).toEqual(['#BBB', '#AAA']);
    expect(next[0]).toEqual({ tag: '#BBB', name: 'Bob', at: 2 });
  });

  it('dedupes by tag and moves the hit to the front with fresh name/time', () => {
    const list = [entry('#AAA', 'Ann', 1), entry('#BBB', 'Bob', 2)];
    const next = rememberSearch(list, '#BBB', 'Bobby', 3);
    expect(next).toEqual([entry('#BBB', 'Bobby', 3), entry('#AAA', 'Ann', 1)]);
  });

  it(`caps the list at ${MAX_RECENT_SEARCHES}`, () => {
    let list: RecentSearch[] = [];
    for (let i = 0; i < MAX_RECENT_SEARCHES + 3; i += 1) {
      list = rememberSearch(list, `#T${i}`, '', i);
    }
    expect(list).toHaveLength(MAX_RECENT_SEARCHES);
    expect(list[0]?.tag).toBe(`#T${MAX_RECENT_SEARCHES + 2}`);
    expect(list.at(-1)?.tag).toBe('#T3');
  });
});

describe('removeSearch', () => {
  it('drops only the given tag', () => {
    const list = [entry('#AAA'), entry('#BBB'), entry('#CCC')];
    expect(removeSearch(list, '#BBB').map((e) => e.tag)).toEqual(['#AAA', '#CCC']);
  });

  it('is a no-op for unknown tags', () => {
    const list = [entry('#AAA')];
    expect(removeSearch(list, '#ZZZ')).toEqual(list);
  });
});

describe('persistence', () => {
  it('round-trips through storage', () => {
    const storage = fakeStorage();
    const list = [entry('#2CJV0LY8P', 'Clara', 42)];
    saveRecentSearches(list, storage);
    expect(loadRecentSearches(storage)).toEqual(list);
  });

  it('returns [] for missing or corrupt data', () => {
    const storage = fakeStorage();
    expect(loadRecentSearches(storage)).toEqual([]);
    storage.setItem(RECENT_SEARCHES_KEY, '{not json');
    expect(loadRecentSearches(storage)).toEqual([]);
    storage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([{ tag: 1 }, 'nope', entry('#OK', 'K', 5)]));
    expect(loadRecentSearches(storage)).toEqual([entry('#OK', 'K', 5)]);
  });

  it('returns [] when storage is unavailable', () => {
    expect(loadRecentSearches(null)).toEqual([]);
  });
});
