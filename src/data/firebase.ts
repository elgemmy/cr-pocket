/**
 * Lazy Firebase initialization. Nothing here touches the network until one of the
 * getters is called, and the getters throw in demo mode (no VITE_FIREBASE_* config),
 * so the demo build never initializes Firebase.
 */
// package.json `overrides` pins a single @firebase/app: firebase@12.19 otherwise nests
// a second copy, which splits the component registry ("Service firestore is not available").
import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
  type Auth,
} from 'firebase/auth';
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  type Firestore,
} from 'firebase/firestore';
import { firebaseConfig, hasFirebase, useEmulators } from '@/config';

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let resetPromise: Promise<void> | null = null;

/** How the Firestore local cache ended up configured (recorded for diagnostics/UI). */
export type FirestoreCacheMode = 'unknown' | 'persistent' | 'memory';
let cacheMode: FirestoreCacheMode = 'unknown';

export function getFirestoreCacheMode(): FirestoreCacheMode {
  return cacheMode;
}

/** Resolves once Auth persistence (browserLocalPersistence) has been applied. */
let persistenceReady: Promise<void> | null = null;

function requireFirebase(): void {
  if (!hasFirebase) {
    throw new Error('Firebase is not configured (missing VITE_FIREBASE_* env); the app is in demo mode.');
  }
}

export function getFirebaseApp(): FirebaseApp {
  requireFirebase();
  if (!app) {
    app = initializeApp(firebaseConfig as FirebaseOptions);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
    if (useEmulators) {
      connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
    // Explicitly keep users signed in across visits/restarts (also the web default).
    persistenceReady = setPersistence(authInstance, browserLocalPersistence).catch((err) => {
      console.warn('[cr-pocket] Failed to set auth persistence; continuing with default.', err);
    });
  }
  return authInstance;
}

/** Await before starting a sign-in flow so persistence is applied first. */
export function authPersistenceReady(): Promise<void> {
  getFirebaseAuth();
  return persistenceReady ?? Promise.resolve();
}

export function getDb(): Firestore {
  requireFirebase();
  if (!dbInstance) {
    const firebaseApp = getFirebaseApp();
    if (typeof indexedDB !== 'undefined') {
      try {
        dbInstance = initializeFirestore(firebaseApp, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        });
        cacheMode = 'persistent';
      } catch (err) {
        // e.g. IndexedDB present but blocked (private mode). Fall back to memory cache.
        console.warn('[cr-pocket] Firestore persistent cache unavailable; using memory cache.', err);
        dbInstance = initializeFirestore(firebaseApp, { localCache: memoryLocalCache() });
        cacheMode = 'memory';
      }
    } else {
      dbInstance = initializeFirestore(firebaseApp, { localCache: memoryLocalCache() });
      cacheMode = 'memory';
    }
    if (useEmulators) {
      connectFirestoreEmulator(dbInstance, '127.0.0.1', 8080);
    }
  }
  return dbInstance;
}

/**
 * Sign-out hygiene (firebase mode only): terminate Firestore and wipe the on-disk
 * persistent cache so a previous account's decks cannot surface for the next user
 * of a shared device. Safe to call repeatedly; a later `getDb()` lazily re-creates
 * a fresh instance (terminate() unregisters the old one).
 *
 * Tradeoff: the next sign-in needs one network round-trip to warm the cache again;
 * offline-first loads start empty until then. See docs/data-and-sync.md.
 */
export async function resetFirestorePersistence(): Promise<void> {
  if (!dbInstance) return;
  if (resetPromise) return resetPromise;
  const db = dbInstance;
  dbInstance = null;
  cacheMode = 'unknown';
  resetPromise = (async () => {
    try {
      await terminate(db);
      if (typeof indexedDB !== 'undefined') {
        await clearIndexedDbPersistence(db);
      }
    } catch (err) {
      // Best-effort: clearing fails if another tab still holds the cache open.
      console.warn('[cr-pocket] Could not fully clear Firestore local persistence.', err);
    } finally {
      resetPromise = null;
    }
  })();
  return resetPromise;
}
