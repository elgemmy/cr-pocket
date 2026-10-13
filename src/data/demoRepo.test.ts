import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoRepo } from './demoRepo';
import { DEFAULT_PROFILE, type LibrarySnapshot } from './repo';
import { makeDeck } from './testUtils';

function collect(repo: ReturnType<typeof createDemoRepo>) {
  const snaps: LibrarySnapshot[] = [];
  const unsub = repo.subscribe((s) => snaps.push(s));
  return { snaps, unsub };
}

/** Simulate a write from another tab. */
function fireStorageEvent(key: string | null) {
  window.dispatchEvent(new StorageEvent('storage', { key }));
}

describe('demoRepo', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('emits an empty, synced library on subscribe (nothing seeded)', () => {
    const repo = createDemoRepo('demo-user');
    const { snaps, unsub } = collect(repo);
    expect(snaps).toHaveLength(1);
    expect(snaps[0]).toEqual({ decks: [], profile: DEFAULT_PROFILE, sync: 'synced', error: null });
    unsub();
  });

  it('saves and deletes decks, persisting across repo instances', () => {
    const repo = createDemoRepo('demo-user');
    const { snaps, unsub } = collect(repo);
    const deck = makeDeck({ id: 'd1' });
    repo.saveDeck(deck);
    expect(snaps.at(-1)?.decks).toEqual([deck]);

    // new instance (e.g. after reload) sees the same data
    const repo2 = createDemoRepo('demo-user');
    const again = collect(repo2);
    expect(again.snaps[0]?.decks).toEqual([deck]);
    again.unsub();

    repo.deleteDeck('d1');
    expect(snaps.at(-1)?.decks).toEqual([]);
    expect(localStorage.getItem('crpocket:demo:demo-user:decks')).toBe('{}');
    unsub();
  });

  it('merges profile patches and persists them', () => {
    const repo = createDemoRepo('demo-user');
    const { snaps, unsub } = collect(repo);
    repo.saveProfile({ playerTag: '#ABC123' });
    repo.saveProfile({ tagPromptDismissed: true });
    const profile = snaps.at(-1)?.profile;
    expect(profile).toEqual({
      playerTag: '#ABC123',
      categories: [],
      tagPromptDismissed: true,
    });

    const repo2 = createDemoRepo('demo-user');
    expect(collect(repo2).snaps[0]?.profile).toEqual(profile);
    unsub();
  });

  it('namespaces data per uid', () => {
    const a = createDemoRepo('user-a');
    const b = createDemoRepo('user-b');
    a.saveDeck(makeDeck({ id: 'only-a' }));
    const bSnaps = collect(b);
    expect(bSnaps.snaps[0]?.decks).toEqual([]);
    bSnaps.unsub();
  });

  it('updates on cross-tab storage events', () => {
    const repo = createDemoRepo('demo-user');
    const { snaps, unsub } = collect(repo);
    const deck = makeDeck({ id: 'from-other-tab' });
    localStorage.setItem('crpocket:demo:demo-user:decks', JSON.stringify({ [deck.id]: deck }));
    fireStorageEvent('crpocket:demo:demo-user:decks');
    expect(snaps.at(-1)?.decks).toEqual([deck]);

    localStorage.removeItem('crpocket:demo:demo-user:decks'); // localStorage.clear() elsewhere
    fireStorageEvent(null);
    expect(snaps.at(-1)?.decks).toEqual([]);
    unsub();
  });

  it('stops reacting after unsubscribe', () => {
    const repo = createDemoRepo('demo-user');
    const { snaps, unsub } = collect(repo);
    unsub();
    repo.saveDeck(makeDeck());
    expect(snaps).toHaveLength(1);
  });
});
