/**
 * Demo-mode LibraryRepo: localStorage-backed, namespaced per uid
 * (`crpocket:demo:<uid>:decks` / `crpocket:demo:<uid>:profile`), with cross-tab
 * updates via the window 'storage' event.
 *
 * NOTE: `sync` is always reported as 'synced' here, but that means "saved to this
 * browser only" — nothing leaves the device. The UI must label demo mode
 * separately (via useAuth().mode === 'demo') instead of implying cloud sync.
 * Nothing is seeded: a fresh demo library is empty and the UI shows its empty state.
 */
import type { Deck, UserProfile } from '@/domain/types';
import { DEFAULT_PROFILE, type LibraryRepo } from './repo';

const PREFIX = 'crpocket:demo:';

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full / unavailable: keep serving in-memory state.
  }
}

export function createDemoRepo(uid: string): LibraryRepo {
  const decksKey = `${PREFIX}${uid}:decks`;
  const profileKey = `${PREFIX}${uid}:profile`;

  const readDeckMap = (): Record<string, Deck> => readJson<Record<string, Deck>>(decksKey) ?? {};
  const readProfile = (): UserProfile => ({ ...DEFAULT_PROFILE, ...(readJson<Partial<UserProfile>>(profileKey) ?? {}) });

  let deckMap = readDeckMap();
  let profile = readProfile();
  let onChange: ((snap: { decks: Deck[]; profile: UserProfile; sync: 'synced'; error: null }) => void) | null =
    null;

  function persistDecks(): void {
    writeJson(decksKey, deckMap);
  }

  function emit(): void {
    onChange?.({ decks: Object.values(deckMap), profile, sync: 'synced', error: null });
  }

  // 'storage' fires only in *other* tabs of the same origin; local writes emit directly.
  function onStorage(event: StorageEvent): void {
    if (event.key === null) {
      // localStorage.clear() in another tab.
      deckMap = readDeckMap();
      profile = readProfile();
      emit();
      return;
    }
    if (event.key === decksKey) {
      deckMap = readDeckMap();
      emit();
    } else if (event.key === profileKey) {
      profile = readProfile();
      emit();
    }
  }

  return {
    subscribe(cb) {
      onChange = cb;
      window.addEventListener('storage', onStorage);
      emit();
      return () => {
        window.removeEventListener('storage', onStorage);
        onChange = null;
      };
    },

    saveDeck(deck) {
      deckMap = { ...deckMap, [deck.id]: deck };
      persistDecks();
      emit();
    },

    deleteDeck(id) {
      if (!(id in deckMap)) return;
      const next = { ...deckMap };
      delete next[id];
      deckMap = next;
      persistDecks();
      emit();
    },

    saveProfile(patch) {
      profile = { ...profile, ...patch };
      writeJson(profileKey, profile);
      emit();
    },
  };
}
