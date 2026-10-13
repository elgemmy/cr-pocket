/**
 * Security-rules tests against the Firestore emulator (spec §6):
 * - owner A can CRUD their own profile and decks
 * - user B cannot read/create/update/delete A's data
 * - unauthenticated access denied
 * - invalid deck/profile shapes rejected
 *
 * Run via `npm run test:rules` (firebase emulators:exec).
 *
 * Note: `@firebase/rules-unit-testing` v5's `context.firestore()` compat accessor
 * is avoided here, so per-user
 * contexts are built with the modular SDK + `connectFirestoreEmulator(..., {
 * mockUserToken })`, which the emulator treats as request.auth = { uid: sub }.
 * Rules loading, clearing, and assert helpers still come from rules-unit-testing.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  terminate,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-cr-pocket';
const USER_A = 'user-a';
const USER_B = 'user-b';
const [HOST, PORT] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');

let testEnv: RulesTestEnvironment;
const apps: FirebaseApp[] = [];

/** A Firestore client authenticated as `uid` (or unauthenticated when null). */
function makeDb(uid: string | null): Firestore {
  const app = initializeApp(
    { projectId: PROJECT_ID, apiKey: 'fake-api-key' },
    `rules-test-${uid ?? 'anon'}-${apps.length}`,
  );
  apps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, HOST!, Number(PORT), uid ? { mockUserToken: { sub: uid } } : undefined);
  return db;
}

let asA: Firestore;
let asB: Firestore;
let asAnon: Firestore;

function validDeck(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    name: 'Hog 2.6 Cycle',
    notes: '',
    favorite: false,
    slots: Array.from({ length: 8 }, (_, i) => ({
      position: i,
      cardId: 26000000 + i,
      form: 'base',
    })),
    towerTroopId: null,
    categoryIds: [] as string[],
    source: { kind: 'manual' },
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_001,
    ...overrides,
  };
}

function validProfile(overrides: Record<string, unknown> = {}) {
  return {
    playerTag: '#2PP0C8Y',
    categories: [{ id: 'cat-1', name: 'Ladder' }],
    tagPromptDismissed: false,
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: HOST,
      port: Number(PORT),
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
    },
  });
  asA = makeDb(USER_A);
  asB = makeDb(USER_B);
  asAnon = makeDb(null);
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
  await Promise.all(apps.map(async (app) => {
    await terminate(getFirestore(app));
    await deleteApp(app);
  }));
});

describe('owner access (user A)', () => {
  it('can create, read, update and delete own profile', async () => {
    const ref = doc(asA, 'users', USER_A);
    await assertSucceeds(setDoc(ref, validProfile()));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(updateDoc(ref, { tagPromptDismissed: true, updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref));
  });

  it('can create, read, list, update and delete own decks', async () => {
    const deckRef = doc(asA, 'users', USER_A, 'decks', 'deck-1');
    await assertSucceeds(setDoc(deckRef, validDeck()));
    await assertSucceeds(getDoc(deckRef));
    await assertSucceeds(getDocs(collection(asA, 'users', USER_A, 'decks')));
    await assertSucceeds(updateDoc(deckRef, validDeck({ favorite: true, name: 'Renamed' })));
    await assertSucceeds(deleteDoc(deckRef));
  });

  it('accepts a null playerTag and empty categories', async () => {
    await assertSucceeds(
      setDoc(doc(asA, 'users', USER_A), validProfile({ playerTag: null, categories: [] })),
    );
  });
});

describe('cross-account isolation (user B vs user A)', () => {
  it('B cannot read A’s profile', async () => {
    await assertSucceeds(setDoc(doc(asA, 'users', USER_A), validProfile()));
    await assertFails(getDoc(doc(asB, 'users', USER_A)));
  });

  it('B cannot write A’s profile (create, update, delete)', async () => {
    const refAsB = doc(asB, 'users', USER_A);
    await assertFails(setDoc(refAsB, validProfile()));
    await assertSucceeds(setDoc(doc(asA, 'users', USER_A), validProfile()));
    await assertFails(updateDoc(refAsB, { tagPromptDismissed: true }));
    await assertFails(deleteDoc(refAsB));
  });

  it('B cannot read, list, create, update or delete A’s decks', async () => {
    await assertSucceeds(setDoc(doc(asA, 'users', USER_A, 'decks', 'deck-1'), validDeck()));
    await assertFails(getDoc(doc(asB, 'users', USER_A, 'decks', 'deck-1')));
    await assertFails(getDocs(collection(asB, 'users', USER_A, 'decks')));
    await assertFails(setDoc(doc(asB, 'users', USER_A, 'decks', 'deck-2'), validDeck()));
    await assertFails(addDoc(collection(asB, 'users', USER_A, 'decks'), validDeck()));
    await assertFails(updateDoc(doc(asB, 'users', USER_A, 'decks', 'deck-1'), validDeck({ name: 'hax' })));
    await assertFails(deleteDoc(doc(asB, 'users', USER_A, 'decks', 'deck-1')));
  });
});

describe('unauthenticated access', () => {
  it('cannot read or write any profile or deck', async () => {
    await assertSucceeds(setDoc(doc(asA, 'users', USER_A), validProfile()));
    await assertSucceeds(setDoc(doc(asA, 'users', USER_A, 'decks', 'deck-1'), validDeck()));
    await assertFails(getDoc(doc(asAnon, 'users', USER_A)));
    await assertFails(setDoc(doc(asAnon, 'users', USER_A), validProfile()));
    await assertFails(getDocs(collection(asAnon, 'users', USER_A, 'decks')));
    await assertFails(setDoc(doc(asAnon, 'users', USER_A, 'decks', 'd'), validDeck()));
    await assertFails(deleteDoc(doc(asAnon, 'users', USER_A, 'decks', 'deck-1')));
  });

  it('cannot touch non-user paths (default deny), even when signed in', async () => {
    await assertFails(getDoc(doc(asA, 'admin', 'config')));
    await assertFails(setDoc(doc(asA, 'admin', 'config'), { x: 1 }));
  });
});

describe('deck validation', () => {
  it('rejects wrong schemaVersion', async () => {
    await assertFails(
      setDoc(doc(asA, 'users', USER_A, 'decks', 'd'), validDeck({ schemaVersion: 2 })),
    );
  });

  it('rejects slots arrays that are not exactly 8', async () => {
    await assertFails(
      setDoc(doc(asA, 'users', USER_A, 'decks', 'd'), validDeck({ slots: validDeck().slots.slice(0, 7) })),
    );
  });

  it('rejects names over 80 chars and notes over 1000 chars', async () => {
    await assertFails(
      setDoc(doc(asA, 'users', USER_A, 'decks', 'd'), validDeck({ name: 'x'.repeat(81) })),
    );
    await assertFails(
      setDoc(doc(asA, 'users', USER_A, 'decks', 'd'), validDeck({ notes: 'x'.repeat(1001) })),
    );
  });

  it('rejects non-boolean favorite and extra keys', async () => {
    await assertFails(
      setDoc(doc(asA, 'users', USER_A, 'decks', 'd'), validDeck({ favorite: 'yes' })),
    );
    await assertFails(
      setDoc(doc(asA, 'users', USER_A, 'decks', 'd'), validDeck({ hacked: true })),
    );
  });

  it('rejects bad towerTroopId, oversized categoryIds, and bad source.kind', async () => {
    await assertFails(
      setDoc(doc(asA, 'users', USER_A, 'decks', 'd'), validDeck({ towerTroopId: 'princess' })),
    );
    await assertFails(
      setDoc(
        doc(asA, 'users', USER_A, 'decks', 'd'),
        validDeck({ categoryIds: Array.from({ length: 51 }, (_, i) => `c${i}`) }),
      ),
    );
    await assertFails(
      setDoc(doc(asA, 'users', USER_A, 'decks', 'd'), validDeck({ source: { kind: 'admin' } })),
    );
  });

  it('rejects non-number timestamps', async () => {
    await assertFails(
      setDoc(doc(asA, 'users', USER_A, 'decks', 'd'), validDeck({ updatedAt: 'yesterday' })),
    );
  });
});

describe('profile validation', () => {
  it('rejects malformed player tags', async () => {
    await assertFails(setDoc(doc(asA, 'users', USER_A), validProfile({ playerTag: 'not-a-tag' })));
    await assertFails(setDoc(doc(asA, 'users', USER_A), validProfile({ playerTag: '#TOOLONGTAGTOOLONG' })));
    await assertFails(setDoc(doc(asA, 'users', USER_A), validProfile({ playerTag: 42 })));
  });

  it('accepts a normalized tag with the Supercell charset', async () => {
    await assertSucceeds(
      setDoc(doc(asA, 'users', USER_A), validProfile({ playerTag: '#2PP0C8Y' })),
    );
  });

  it('rejects non-timestamp createdAt/updatedAt', async () => {
    await assertFails(setDoc(doc(asA, 'users', USER_A), { playerTag: null, updatedAt: 'now' }));
  });

  it('rejects oversized category lists and unknown keys', async () => {
    await assertFails(
      setDoc(
        doc(asA, 'users', USER_A),
        validProfile({
          categories: Array.from({ length: 101 }, (_, i) => ({ id: `c${i}`, name: `C${i}` })),
        }),
      ),
    );
    await assertFails(setDoc(doc(asA, 'users', USER_A), validProfile({ isAdmin: true })));
  });
});
