import { describe, expect, it } from 'vitest';
import { deriveSyncState, type SnapshotMeta } from './repo';

const server: SnapshotMeta = { hasPendingWrites: false, fromCache: false };
const pending: SnapshotMeta = { hasPendingWrites: true, fromCache: true };
const cached: SnapshotMeta = { hasPendingWrites: false, fromCache: true };

describe('deriveSyncState (spec F7)', () => {
  it('is loading until both snapshot streams have delivered', () => {
    expect(deriveSyncState({ profileMeta: null, decksMeta: null, writeFailed: false })).toBe('loading');
    expect(deriveSyncState({ profileMeta: server, decksMeta: null, writeFailed: false })).toBe('loading');
    expect(deriveSyncState({ profileMeta: null, decksMeta: server, writeFailed: false })).toBe('loading');
  });

  it('is synced only with no pending writes AND all snapshots server-confirmed', () => {
    expect(deriveSyncState({ profileMeta: server, decksMeta: server, writeFailed: false })).toBe('synced');
  });

  it('is pending when any snapshot has pending writes (even if server-confirmed)', () => {
    expect(deriveSyncState({ profileMeta: pending, decksMeta: server, writeFailed: false })).toBe('pending');
    expect(deriveSyncState({ profileMeta: server, decksMeta: pending, writeFailed: false })).toBe('pending');
    const pendingServer: SnapshotMeta = { hasPendingWrites: true, fromCache: false };
    expect(
      deriveSyncState({ profileMeta: pendingServer, decksMeta: server, writeFailed: false }),
    ).toBe('pending');
  });

  it('is cached when data comes from cache with no pending writes', () => {
    expect(deriveSyncState({ profileMeta: cached, decksMeta: cached, writeFailed: false })).toBe('cached');
    expect(deriveSyncState({ profileMeta: server, decksMeta: cached, writeFailed: false })).toBe('cached');
  });

  it('is error when a write failed, regardless of snapshot state (sticky)', () => {
    expect(deriveSyncState({ profileMeta: server, decksMeta: server, writeFailed: true })).toBe('error');
    expect(deriveSyncState({ profileMeta: null, decksMeta: null, writeFailed: true })).toBe('error');
    expect(deriveSyncState({ profileMeta: pending, decksMeta: cached, writeFailed: true })).toBe('error');
  });
});
