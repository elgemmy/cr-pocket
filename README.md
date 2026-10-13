# CR Pocket

*More decks. Less deck management.*

CR Pocket is a small, mobile-first deck library for Clash Royale. Save as many decks as you like, sort them into categories, tweak cards and Evo / Hero / Wild forms with your own card levels visible, and send any deck back into the game with one tap. Your decks sync between your laptop and phone, and they keep working offline.

> CR Pocket is unofficial fan content, not approved or endorsed by Supercell. Clash Royale and its artwork are trademarks of Supercell. See the [Supercell Fan Content Policy](https://supercell.com/en/fan-content-policy/).

## What it does

- **My Decks**: unlimited decks, categories, favorites, and search by deck or card name.
- **Deck editor**: eight slots (Evo, Hero, Wild, and five ordinary), a searchable card gallery with *your* levels, a Tower Troop picker, and form selection with matching portraits.
- **Find a player**: look up any public player tag, see their current deck and recently played decks, and save a private copy.
- **Paste a deck link**: import from official copy links, RoyaleAPI, YouTube descriptions, or friends.
- **Open in Clash Royale**: the official copy link on phones, plus a QR code and copy link on desktop. It also reminds you which Evo / Hero forms to set in-game, because the link can't carry them.
- **Sync and offline**: Firestore with a persistent local cache, an honest sync indicator, an installable app (PWA), and JSON export/import.

## Quick start (demo mode, no accounts needed)

Requirements: Node 22 (and Java 21 for the Firestore rules tests). With [mise](https://mise.jdx.dev): `mise install`.

```bash
npm install
npm run dev          # http://localhost:5173
```

With no Firebase config, the app runs in **demo mode**. "Continue with Google" signs you in as a local demo user, and decks are stored in this browser only. Game data comes from bundled sample data. Try these player tags: `#2CJV0LY8P` (varied collection), `#9QRUGCP0Y` (maxed), `#8PL2UCY0Q` (new player).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run dev:api` | Pages Functions via Wrangler on :8788 (proxies the app from :5173) |
| `npm run build` | Typecheck and production build (`dist/`) |
| `npm run preview` | Serve the production build |
| `npm test` | Unit tests (Vitest) |
| `npm run test:rules` | Firestore security-rules tests against the emulator |
| `npm run emulators` | Local Auth and Firestore emulators |

## Going live

### 1. Firebase (free Spark plan)

1. Create a Firebase project, add a **Web app**, and enable **Authentication → Google**.
2. Create a **Cloud Firestore** database (production mode).
3. Under Authentication → Settings → Authorized domains, add `localhost` and your Pages domain (e.g. `cr-pocket.pages.dev`).
4. Copy the web config into `.env` (see `.env.example`).
5. Deploy the rules: `npx firebase deploy --only firestore:rules --project <id>`.

Details: [`docs/data-and-sync.md`](docs/data-and-sync.md).

### 2. Clash Royale API key

1. Create a key at <https://developer.clashroyale.com/> and allowlist the RoyaleAPI proxy IP **45.79.218.79**. Cloudflare has no fixed outbound IP, so requests go through RoyaleAPI's proxy. That is a third-party dependency that can see the token; see [`docs/api-notes.md`](docs/api-notes.md).
2. Local: copy `.dev.vars.example` to `.dev.vars` and set `CR_API_TOKEN`.
3. Set `VITE_GAME_API=live` in `.env` so the client calls `/api/*`.

### 3. Cloudflare Pages (free plan)

1. Create a Pages project from this repo. Build command: `npm run build`. Output directory: `dist`.
2. Add the `VITE_FIREBASE_*` and `VITE_GAME_API=live` variables as **build** environment variables.
3. Add `CR_API_TOKEN` as an **encrypted secret** (`npx wrangler pages secret put CR_API_TOKEN`).
4. `functions/` is deployed automatically as `/api/*` (GET only: cards, player, battles).

Free-tier guardrails: Firestore Spark (50k reads / 20k writes per day) and Pages Functions (100k requests per day). Nothing here enables billing. Watch usage in the Firebase and Cloudflare dashboards.

## Project layout

```
shared/       Normalized API contracts, Supercell → app normalizers, demo fixtures
functions/    Cloudflare Pages Functions (/api/cards, /api/players/:tag[/battles])
src/domain/   Pure deck logic: slots/forms, editing, validation, copy link, export
src/data/     Firebase auth, Firestore repo (and demo repo), library store, sync state
src/game/     Game-data client (live or demo), catalog and own-collection stores
src/ui/       Design system components (see docs/design.md)
src/app/      App shell, routing, session bootstrap, PWA helpers
src/features/ Library, editor, player search, import, save, share, settings
src/scene3d/  Optional lazy Three.js hero scene (CSS fallback)
tests/rules/  Firestore security-rules tests
```

## Known limitations

- The API exposes a player's **current deck and recent battles**, not their ten saved deck slots.
- The copy link imports the eight cards only. **Evo / Hero forms must be set in-game**; the app shows a reminder before handoff. Tower Troop encoding stays off until it has been verified on a real device (see [`docs/deck-link-notes.md`](docs/deck-link-notes.md)).
- A player tag is a public, **unverified** preference used to show your card levels. It never grants access to anything.
- If the same deck is edited on two devices at once, the **last committed write wins**.
- Sign-out clears the local Firestore cache when it can. If clearing fails (for example, another tab still has it open), data can remain on disk, so use CR Pocket on trusted devices.

## Docs

- [`docs/spec.md`](docs/spec.md): product spec (v1)
- [`docs/api-notes.md`](docs/api-notes.md): Supercell API fields, level normalization, proxy, verification status
- [`docs/deck-link-notes.md`](docs/deck-link-notes.md): copy-link format and the real-device test checklist
- [`docs/data-and-sync.md`](docs/data-and-sync.md): Firestore schema, rules, sync states, Firebase setup
- [`docs/design.md`](docs/design.md): design tokens, components, motion and accessibility rules
