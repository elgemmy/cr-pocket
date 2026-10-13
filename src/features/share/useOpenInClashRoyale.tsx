import { useCallback, useState, type ReactNode } from 'react';
import type { Deck } from '@/domain/types';
import { OpenInClashRoyaleSheet } from './OpenInClashRoyaleSheet';

export interface UseOpenInClashRoyale {
  /** Open the sheet for a complete deck. */
  open: (deck: Deck) => void;
  close: () => void;
  isOpen: boolean;
  /** Render once near the page root. */
  sheet: ReactNode;
}

/**
 * Convenience wrapper for surfaces that just need "Open in Clash Royale"
 * (e.g. library deck tiles). The editor uses the sheet directly to pass
 * dirty/onSave extras.
 */
export function useOpenInClashRoyale(): UseOpenInClashRoyale {
  const [deck, setDeck] = useState<Deck | null>(null);
  const open = useCallback((d: Deck) => setDeck(d), []);
  const close = useCallback(() => setDeck(null), []);
  return {
    open,
    close,
    isOpen: deck != null,
    sheet: <OpenInClashRoyaleSheet deck={deck} open={deck != null} onClose={close} />,
  };
}
