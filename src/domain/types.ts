import type { SlotForm } from '@shared/types';

export type { SlotForm };

/** Slot roles derive from position: 0 = Evo, 1 = Hero, 2 = Wild, 3..7 = ordinary. */
export type SlotRole = 'evo' | 'hero' | 'wild' | 'normal';

export interface DeckSlot {
  position: number;
  /** null only while the deck is an unsaved editor draft. Saved decks always have 8 distinct ids. */
  cardId: number | null;
  form: SlotForm;
}

export interface DeckSource {
  kind: 'manual' | 'link' | 'player';
  playerTag?: string;
  playerName?: string;
  /** 'current' | 'recent' when kind = 'player'. */
  context?: 'current' | 'recent';
  playedAt?: string;
}

export interface Deck {
  id: string;
  schemaVersion: 1;
  name: string;
  notes: string;
  favorite: boolean;
  /** Always length 8, index === position. */
  slots: DeckSlot[];
  towerTroopId: number | null;
  categoryIds: string[];
  source: DeckSource;
  /** Epoch milliseconds (client clock). */
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface UserProfile {
  /** Unverified public Clash Royale tag, normalized as "#ABC123". Never used for authorization. */
  playerTag: string | null;
  categories: Category[];
  /** Whether the user dismissed the "Add your player tag" prompt. */
  tagPromptDismissed: boolean;
}

export type SyncState = 'loading' | 'synced' | 'pending' | 'cached' | 'error';
