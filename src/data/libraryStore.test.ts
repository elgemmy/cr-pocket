import { beforeEach, describe, expect, it } from 'vitest';
import { useAuth } from './auth';
import {
  bindLibraryToAuth,
  normalizePlayerTag,
  startLibrary,
  stopLibrary,
  useLibrary,
} from './libraryStore';
import { makeDeck } from './testUtils';

// Tests run without VITE_FIREBASE_* env, so appMode === 'demo' (localStorage repo).

function signIn(uid: string) {
  useAuth.setState({ status: 'signedIn', user: { uid, displayName: uid, email: null, photoURL: null } });
}

describe('libraryStore (demo mode)', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuth.setState({ status: 'signedOut', user: null, error: null });
    stopLibrary();
  });

  it('normalizePlayerTag uppercases, adds a single leading # and rejects invalid tags', () => {
    expect(normalizePlayerTag('  2cjv 0ly8p ')).toBe('#2CJV0LY8P');
    expect(normalizePlayerTag('#p0ly')).toBe('#P0LY');
    expect(normalizePlayerTag('#ABC123')).toBeNull();
    expect(normalizePlayerTag('')).toBeNull();
    expect(normalizePlayerTag('   ')).toBeNull();
  });

  it('startLibrary loads an empty library and marks it ready', () => {
    startLibrary('demo-user');
    const s = useLibrary.getState();
    expect(s.status).toBe('ready');
    expect(s.uid).toBe('demo-user');
    expect(s.decks).toEqual([]);
    expect(s.sync).toBe('synced');
  });

  it('saveDeck round-trips and decks sort by updatedAt desc', () => {
    startLibrary('demo-user');
    const older = makeDeck({ id: 'older', updatedAt: 100 });
    const newer = makeDeck({ id: 'newer', updatedAt: 200 });
    useLibrary.getState().saveDeck(older);
    useLibrary.getState().saveDeck(newer);
    expect(useLibrary.getState().decks.map((d) => d.id)).toEqual(['newer', 'older']);

    useLibrary.getState().deleteDeck('newer');
    expect(useLibrary.getState().decks.map((d) => d.id)).toEqual(['older']);
  });

  it('upsertCategory creates once and reuses the id case-insensitively', () => {
    startLibrary('demo-user');
    const id = useLibrary.getState().upsertCategory('Ladder');
    expect(id).toBeTruthy();
    expect(useLibrary.getState().upsertCategory('  ladder  ')).toBe(id);
    expect(useLibrary.getState().profile.categories).toEqual([{ id, name: 'Ladder' }]);
    expect(useLibrary.getState().upsertCategory('   ')).toBe('');
  });

  it('renameCategory renames; deleteCategory strips the id from decks without deleting them', () => {
    startLibrary('demo-user');
    const catId = useLibrary.getState().upsertCategory('War');
    useLibrary.getState().renameCategory(catId, ' Clan War ');
    expect(useLibrary.getState().profile.categories[0]?.name).toBe('Clan War');

    const deck = makeDeck({ id: 'd1', categoryIds: [catId, 'other'] });
    useLibrary.getState().saveDeck(deck);
    useLibrary.getState().deleteCategory(catId);

    const s = useLibrary.getState();
    expect(s.profile.categories).toEqual([]);
    expect(s.decks).toHaveLength(1);
    expect(s.decks[0]?.categoryIds).toEqual(['other']);
  });

  it('toggleFavorite flips favorite and bumps updatedAt', () => {
    startLibrary('demo-user');
    useLibrary.getState().saveDeck(makeDeck({ id: 'd1', favorite: false, updatedAt: 1 }));
    useLibrary.getState().toggleFavorite('d1');
    const deck = useLibrary.getState().decks[0];
    expect(deck?.favorite).toBe(true);
    expect(deck?.updatedAt).toBeGreaterThan(1);
    useLibrary.getState().toggleFavorite('d1');
    expect(useLibrary.getState().decks[0]?.favorite).toBe(false);
  });

  it('setPlayerTag normalizes and dismissTagPrompt persists', () => {
    startLibrary('demo-user');
    useLibrary.getState().setPlayerTag(' p0lygr2pv ');
    expect(useLibrary.getState().profile.playerTag).toBe('#P0LYGR2PV');
    useLibrary.getState().setPlayerTag('not a tag!');
    expect(useLibrary.getState().profile.playerTag).toBe('#P0LYGR2PV');
    useLibrary.getState().setPlayerTag(null);
    expect(useLibrary.getState().profile.playerTag).toBeNull();
    useLibrary.getState().dismissTagPrompt();
    expect(useLibrary.getState().profile.tagPromptDismissed).toBe(true);
  });

  it('stopLibrary clears in-memory state immediately', () => {
    startLibrary('demo-user');
    useLibrary.getState().saveDeck(makeDeck());
    stopLibrary();
    const s = useLibrary.getState();
    expect(s.status).toBe('idle');
    expect(s.uid).toBeNull();
    expect(s.decks).toEqual([]);
  });

  it('bindLibraryToAuth isolates users: no data leaks across accounts', () => {
    bindLibraryToAuth();

    signIn('user-a');
    useLibrary.getState().saveDeck(makeDeck({ id: 'a-deck' }));
    expect(useLibrary.getState().decks.map((d) => d.id)).toEqual(['a-deck']);

    // account switch: previous data must be gone before B's data appears
    signIn('user-b');
    expect(useLibrary.getState().uid).toBe('user-b');
    expect(useLibrary.getState().decks).toEqual([]);

    // signing out clears everything; B's data does not persist for A
    useAuth.setState({ status: 'signedOut', user: null });
    expect(useLibrary.getState().status).toBe('idle');
    expect(useLibrary.getState().decks).toEqual([]);

    // A's deck is still stored under A and comes back on A's next sign-in
    signIn('user-a');
    expect(useLibrary.getState().decks.map((d) => d.id)).toEqual(['a-deck']);
  });

  it('actions are safe no-ops while idle (no repo bound)', () => {
    stopLibrary();
    useLibrary.getState().saveDeck(makeDeck());
    useLibrary.getState().deleteDeck('x');
    expect(useLibrary.getState().upsertCategory('Nope')).toBeTruthy(); // id generated, write dropped
    expect(useLibrary.getState().decks).toEqual([]);
  });
});
