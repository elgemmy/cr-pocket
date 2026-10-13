/**
 * Hook for browsing ANY public player: fetches their profile and recent battle decks
 * together and exposes loading/error states. Used by the player-search screen
 * (F2). The signed-in user's own collection lives in myCollectionStore instead.
 */

import { useCallback, useEffect, useState } from 'react';
import { gameApi, GameApiError } from './api';
import type { PlayerBattleDecks, PlayerProfile } from '@shared/types';

export type LookupStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PlayerLookup {
  profile: PlayerProfile | null;
  battleDecks: PlayerBattleDecks | null;
  status: LookupStatus;
  error: GameApiError | null;
  /** Re-run the lookup for the current tag. */
  reload: () => void;
}

export function usePlayerLookup(tag: string | null): PlayerLookup {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [battleDecks, setBattleDecks] = useState<PlayerBattleDecks | null>(null);
  const [status, setStatus] = useState<LookupStatus>('idle');
  const [error, setError] = useState<GameApiError | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!tag) {
      setProfile(null);
      setBattleDecks(null);
      setStatus('idle');
      setError(null);
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setError(null);
    void (async () => {
      try {
        const [p, b] = await Promise.all([gameApi.getPlayer(tag), gameApi.getBattleDecks(tag)]);
        if (cancelled) return;
        setProfile(p);
        setBattleDecks(b);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setProfile(null);
        setBattleDecks(null);
        setError(err instanceof GameApiError ? err : new GameApiError('upstream', 'Unexpected error.'));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tag, nonce]);

  return { profile, battleDecks, status, error, reload };
}
