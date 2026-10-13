# Data layer & sync

Owner: `src/data/**`, `firestore.rules`, `tests/rules/**`. Spec references: F1, F3, F7, §5, §6.

## App modes

`src/config.ts` decides: `hasFirebase` (all of `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_APP_ID` present) → `appMode = 'firebase'`, otherwise `'demo'`. Both modes implement
the same `LibraryRepo` contract, so UI code never branches on mode except to *label* demo mode
(`useAuth().mode === 'demo'` → show "local demo, no cloud sync").

## Startup wiring

In `src/main.tsx`, before/at render:

```ts
import { initAuth } from '@/data/auth';
import { bindLibraryToAuth } from '@/data/libraryStore';

initAuth();          // restores session / attaches onAuthStateChanged
bindLibraryToAuth(); // starts/stops the library repo as auth changes
```

UI then only touches `useAuth()` (sign-in state) and `useLibrary()` (decks/profile/categories).

## Firestore schema

```
users/{uid}                       profile doc
  playerTag: string | null        normalized "#ABC123" (uppercase, single '#'); UNVERIFIED, never authz
  categories: [{ id, name }]      user-managed, ≤ 100 entries
  tagPromptDismissed: boolean
  createdAt, updatedAt: Firestore serverTimestamp

users/{uid}/decks/{deckId}        ONE DOCUMENT PER DECK (schemaVersion 1)
  name: string (≤ 80), notes: string (≤ 1000), favorite: bool
  slots: [{ position: 0..7, cardId: number, form: 'base'|'evo'|'hero'|'champion' }]  (exactly 8)
  towerTroopId: number | null
  categoryIds: string[] (≤ 50)
  source: { kind: 'manual'|'link'|'player', playerTag?, playerName?, context?, playedAt? }
  createdAt, updatedAt: number (epoch ms, client clock — matches the Deck type)
```

One doc per deck means two devices editing *different* decks never conflict. Two devices editing
the *same* deck concurrently: **last committed write wins** (full-document `setDoc`); there is no
field-level merge or conflict UI in v1.

Categories live on the profile doc; deleting a category never deletes decks — the id is stripped
from each deck's `categoryIds` (see `useLibrary().deleteCategory`).

## Security rules (`firestore.rules`)

Default deny. `users/{uid}` and `users/{uid}/decks/{deckId}` are readable/writable only when
`request.auth.uid == uid`. Write validation: key whitelists, `schemaVersion == 1`, string length
caps, `slots` exactly 8, `towerTroopId` int|null, list size caps, `source.kind` enum, deck
timestamps must be numbers, profile timestamps must be Firestore timestamps, `playerTag` must be
null or match `^#[0289CGJLPQRUVY]{2,15}$` (Supercell tag charset). Rules cannot loop, so list
*element* shapes are client-enforced only. Deploy with
`npx firebase deploy --only firestore:rules`. Tests: `npm run test:rules` (emulator, 18 tests:
owner CRUD, cross-account denial, unauthenticated denial, schema validation).

## Sync state semantics (F7)

`LibrarySnapshot.sync` is derived purely from snapshot metadata (`deriveSyncState` in
`src/data/repo.ts`, unit-tested):

| State      | Meaning                                                                        |
|------------|--------------------------------------------------------------------------------|
| `loading`  | Not all snapshot streams (profile, decks) have delivered yet.                  |
| `pending`  | ≥ 1 local write not yet committed by the server ("Waiting to sync").           |
| `cached`   | No pending writes, but latest visible data came from the local cache.          |
| `synced`   | No pending writes AND all latest snapshots are server-confirmed.               |
| `error`    | A write was rejected (permission-denied, quota, …). Sticky until the next      |
|            | server-confirmed `synced` snapshot or a later successful write.                |

Writes are **fire-and-forget** (offline-first): the repo never awaits server confirmation, the
local snapshot reflects changes immediately, and promise rejections surface as `sync: 'error'`
with a readable message in `error`. Success is never reported from the write path alone — only a
server-confirmed snapshot produces `synced`.

Both Firestore listeners use `onSnapshot(..., { includeMetadataChanges: true })`.
Malformed deck documents are skipped defensively (never crash the whole library).

### Demo mode caveat

`demoRepo` reports `sync: 'synced'`, but that only means "saved to localStorage on this device".
The UI must label demo mode explicitly (`useAuth().mode`) and not imply cloud backup.

## Offline behavior & persistent cache

Firebase mode uses `initializeFirestore` with
`persistentLocalCache({ tabManager: persistentMultipleTabManager() })` (IndexedDB, multi-tab safe).
If IndexedDB is unavailable (private mode, old browser), it falls back to `memoryLocalCache()` and
records it — `getFirestoreCacheMode()` returns `'persistent' | 'memory' | 'unknown'` (UI/diagnostics
may surface "offline changes won't survive reload" in memory mode). Firestore itself queues writes
while offline and flushes on reconnect; we do not build a second sync engine.

**Shared-device warning:** the persistent cache keeps the signed-in user's library on disk. Only
stay signed in on trusted devices; sign out (see below) to wipe it.

## Sign-out & account isolation (F1/F7)

`bindLibraryToAuth()` reacts to every auth change:

1. `stopLibrary()` unsubscribes all Firestore/demo listeners **synchronously** and clears all
   in-memory decks/profile state before any new user's data can arrive.
2. In firebase mode it then fire-and-forget calls `resetFirestorePersistence()`:
   `terminate(db)` + `clearIndexedDbPersistence(db)`. Clearing requires termination first; the
   Firestore instance is lazily re-created on the next sign-in (`terminate` unregisters it).

**Tradeoff (chosen for safety):** wiping the cache on sign-out guarantees no previous-account data
on shared devices, at the cost of needing one network round-trip to re-warm the cache after the
next sign-in (offline-first loads start empty until then). Clearing can fail if another open tab
still holds the cache — it is best-effort and logged, never fatal.

Demo mode additionally namespaces localStorage per uid (`crpocket:demo:<uid>:…`) and syncs across
tabs via the `storage` event.

## Firebase project setup (user steps)

1. Create a project at <https://console.firebase.google.com> (Spark/free plan is enough;
   do NOT enable billing or Functions).
2. Build → Authentication → Sign-in method → enable **Google**.
3. Authentication → Settings → **Authorized domains**: add your Cloudflare Pages domain
   (`*.pages.dev` / custom domain). `localhost` is allowed by default.
4. Build → Firestore Database → Create database (production mode, pick a region).
5. Project settings → General → "Your apps" → Web app → copy the config values into `.env`:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`
   (see `.env.example`). Without them the app runs in demo mode.
6. Deploy the rules: `npx firebase login` once, then
   `npx firebase deploy --only firestore:rules --project <your-project-id>`.
7. Local development against emulators instead: `npm run emulators` and set
   `VITE_FIREBASE_EMULATORS=true` with any placeholder config values (e.g. project id
   `demo-cr-pocket`).

## Notes for other workers

- `package.json` `overrides` pins one `@firebase/app` version. Without it, firebase@12.19 nests a
  second copy and `getFirestore(app)` throws "Service firestore is not available". Keep the
  override in sync when upgrading firebase (`npm ls @firebase/app` must show one version), and use
  `getFirebaseApp()/getFirebaseAuth()/getDb()` from `@/data/firebase` rather than initializing
  Firebase anywhere else.
- Deck ids come from the caller (e.g. `crypto.randomUUID()`); `saveDeck` is a full-document set.
- `useLibrary` actions are safe no-ops when idle/signed out (`upsertCategory` still returns an id).
- No composite Firestore indexes are required (single-collection listens, client-side sort), so
  there is intentionally no `firestore.indexes.json`.
