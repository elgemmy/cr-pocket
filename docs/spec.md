# CR Pocket — Product & Implementation Spec (v1)

**Status:** Ready for implementation  
**Date:** 2026-10-11  
**Product:** CR Pocket — *More decks. Less deck management.*  
**Goal:** A tiny, polished, mobile-first Clash Royale deck library that works across devices.

> **Agent directive:** Build the smallest *working* version of every required feature below. Prioritize functional end-to-end flows over clever architecture or decorative effects. Treat external API limitations as constraints, not invitations to invent unsupported features. Verify the game handoff on a real phone before investing in polish.

## 1. Product definition

Players only get a limited number of in-game deck slots. CR Pocket is their personal, effectively unlimited shelf for collecting, editing, organizing, and restoring decks. A user finds an interesting deck on a laptop, saves it, and later opens it in Clash Royale from their phone.

**Success scenario:** I sign in with Google, set my Clash Royale player tag once, browse the current/recent decks of a player I admire, save one in a category, customize the cards and Evo/Hero/Wild slots with my own levels visible, and tap **Open in Clash Royale** on my phone. The collection syncs automatically and works from cache offline.

### Principles

- **Use it immediately:** One Google sign-in; no onboarding wizard, passwords, verification of Clash Royale ownership, or manual syncing.
- **Personal-first:** Library, categories, and editor are the product. No rankings engine or recommendation algorithm.
- **Faithful to the game:** Correct eight-card structure, Tower Troop, and 2026 slot rules.
- **Reliable over flashy:** Motion should feel delightful, but must never delay saving or copying a deck.
- **No required paid infrastructure:** Start with Firebase Spark and Cloudflare's free plan; do not enable paid Firebase Functions.

## 2. Technical feasibility and explicit limitations

1. The official API provides a player's **current deck**, **card collection with levels**, and **recent battle log**. It does **not** expose all ten of that player's saved in-game deck slots. A profile's “decks” screen must mean **Current Deck + Recently Played Decks**, with duplicates removed. Battle history is limited and can contain nonstandard modes; do not promise complete history.
2. As of October 2026, the standard deck has **one Evolution slot, one Hero/Champion slot, one Wild slot, and five ordinary slots**. The Wild slot can activate an eligible Evo, Hero, or Champion. Preserve this model rather than older two-Evo-slot layouts.
3. The official `link.clashroyale.com` copy-deck handoff imports the **eight card IDs**, and compatible variants may carry a Tower Troop. It **does not reliably activate Evo/Hero forms**. CR Pocket must preserve those choices and display a brief **“Set these forms in-game after import”** reminder. Never claim we can modify in-game deck slots remotely.
4. A **player tag is public and unverified**. It provides public game-profile data but must **never** act as CR Pocket authentication or authorization.
5. Supercell's API key must remain server-side, and developer API keys are IP-restricted. The initial deployment can evaluate RoyaleAPI's documented static-IP proxy. This is a **third-party operational dependency**: smoke-test its functionality and acceptability before committing to it; if unavailable, use a server endpoint with known outbound IP rather than exposing the token in frontend code.
6. Card/form metadata changes with game updates. Do not hardcode today's card list, Evo/Hero eligibility, or images as permanent truth.

## 3. V1 user flows and requirements

### F1 — Account and first launch

- **Google sign-in** using Firebase Authentication. Keep the user signed in across normal visits and across app restarts.
- Authenticated users land immediately on **My Decks**. Do not require a player tag to create/import a deck.
- On first launch, show a subtle **Add your player tag** prompt. The user may dismiss it, but card levels and owned-form indicators require a configured tag.
- Settings allow saving/replacing/clearing the tag. The same tag appears on all signed-in devices. Normalize case and optional leading `#` when entering it.
- The tag is explicitly described as an **unverified public-game profile preference**, not proof of account ownership.
- Sign-out is available in Settings; do not allow data from the previous signed-in account to appear under a new account.

**Accept when:** Signing in on laptop and phone with the same Google account loads the same collection and saved player tag without re-entering it.

### F2 — Find a player and save their decks

- Search for **any Clash Royale player tag**. Show name, tag, trophy/arena summary where available, and clear loading/not-found/rate-limited states.
- Show two sections: **Current Deck** and **Recently Played Decks**, derived from that player's battle log. Do not falsely label these as all their in-game slots.
- Include only valid eight-card decks belonging to the searched player in relevant battle-log entries (not automatically the opponent's cards). Skip incomplete/special-format records.
- Deduplicate recent lists by their eight-card composition, Tower Troop, and configured special forms where known; show most-recent-use date when available. If current and recent match exactly, avoid showing a confusing duplicate.
- Each deck preview includes eight card images, average elixir (when known), configured Evo/Hero badges, Tower Troop when available, and **Save to My Decks**.
- Saving creates a **private copy** in the signed-in user's library, optionally allowing a name/category adjustment. Changes to the original player's current deck must never overwrite this saved copy.
- Keep source attribution: player name/tag and current/recent context. No public stats or win-rate claims without data.
- Also support **Paste deck link** for importing from RoyaleAPI, YouTube descriptions, friends, or in-game sharing.

**Accept when:** A user can enter a valid public tag, see the player's current and eligible recent decks, select one, save it, and find it in their own collection after refreshing.

### F3 — My Decks and categories

- Unlimited logical collection at the UI level (subject to reasonable free-tier usage). No artificial ten-deck cap.
- Library shows responsive deck cards with **name, eight-card preview, Tower Troop, categories, average elixir, favorite state, and last-edited date**.
- Support **create, rename, and delete categories**; categories are per-user, can hold multiple decks, and a deck can belong to multiple categories.
- Built-in views/filters: **All**, **Favorites**, plus user categories; search by deck name or card name. Keep sort simple: recently edited first.
- **Create**, **edit**, **duplicate**, **favorite/unfavorite**, and **delete** any owned deck. Confirm destructive deletion; deleting a category must not delete its decks.
- If the same imported deck already exists, show **Already saved** and let the user view the original or explicitly save another variation.
- Optional small notes field for experiments (e.g. “replace Fireball with Poison”).

**Accept when:** Categories and cards remain consistent after refresh, on another device, and when used offline.

### F4 — Deck editor and the player's card collection

- Main editor: **eight visible slots at the top**, followed by a **searchable card collection** beneath. Optimized for touch and desktop pointer use.
- Click/tap a deck slot to choose a card from the gallery; replace/remove it, or drag/drop to swap slots if easy. Always provide a tap-based alternative to drag/drop.
- Gallery displays card image, name, elixir, and **my displayed card level** when the configured player tag's public card collection is available. Add a simple filter for **All / Owned**, and a small indicator for missing/unknown cards.
- Use **the signed-in user's saved player tag** to obtain card levels, not the profile of the player being browsed. Public API levels may be rarity-offset; normalize to the current in-game level scale and test with multiple rarities. Never invent an unavailable level. Treat maxed cards with `count=0` correctly.
- Provide a **Refresh collection** action and show **last updated**. Editing remains usable if that lookup fails; unknown levels display `—`.
- Ensure eight **distinct** valid main-card IDs before allowing Save or Copy. An unfinished deck can remain an **unsaved editor draft**, but must not produce a misleading working game link.
- Show **average elixir** and optional Tower Troop selection separately from the eight main cards. Default to Tower Princess when data is absent, but preserve imported Tower Troops.
- Save is explicit and obvious. Do not silently discard edits on navigation. Opening an existing deck then saving updates it; **Duplicate** creates a new independent copy.

**Accept when:** Replacing a card immediately updates its image, elixir average and level badge; saving persists the exact eight-card setup.

### F5 — Evo, Hero/Champion, and Wild slots

- Display three special slots with clear labels: **Evo**, **Hero**, **Wild**, alongside five ordinary slots. The entire deck always has **eight total main cards**, not eleven.
- **Evo:** Can activate an unlocked Evolution of its assigned card.
- **Hero:** Can activate an eligible unlocked Hero form or Champion.
- **Wild:** Can activate an eligible Evolution, Hero form, or Champion; if a card has both Evo and Hero forms, let the user choose which form is active.
- A special slot may hold a base card without an active form. Do not turn it into a Hero/Evo unless supported and selected.
- **Change the card portrait** to the corresponding official Evo/Hero artwork when an active special form is selected; use an obvious slot border/badge and normal-card artwork fallback if an alternate asset is missing.
- When the configured player profile is available, show **Owned/Unlocked** versus **Not unlocked/Unknown**. Do not forbid saving an aspirational deck with unowned cards/forms; warn rather than block.
- Parse the API's `evolutionLevel`/`maxEvolutionLevel` **as a bit field when applicable**, not a progression counter: `1 = Evo`, `2 = Hero`, `3 = both`. In a player's collection, it indicates unlocked forms; in current deck/battle entries, it indicates played/configured form. Verify against live fixtures and handle missing fields.
- When importing an externally sourced deck, preserve detected forms. If special-slot position cannot be reliably inferred, prompt the user to adjust it rather than inventing an exact arrangement.

**Accept when:** Selecting an unlocked Evo form in the Evo slot changes its portrait, moving the card to an ordinary slot restores its base portrait, and Wild offers only applicable form choices.

### F6 — Open in Clash Royale

- Primary deck action is **Open in Clash Royale**. Produce and validate the official HTTPS deck-copy URL using the eight canonical card IDs, with supported Tower Troop encoding **only after a real-device test confirms its exact syntax**.
- On a phone with the game installed, tapping the button should hand off to Clash Royale, where the user chooses an in-game slot and confirms the import.
- On desktop, show **Copy link** and a **QR code** that can be scanned on the phone. Offer a manual link fallback if OS/browser handoff fails.
- Show a succinct **post-import reminder** identifying Evo, Hero, and Wild configurations that the user must apply manually in-game. This reminder must be available before the user leaves the app.
- Save the deck in CR Pocket independently of whether the user has room in Clash Royale's ten slots. Never assert a remote write succeeded merely because the link opened.

**Accept when:** At least one eight-card deck is successfully transferred from CR Pocket into the installed game on a real phone. Document device and browser tested.

### F7 — Cross-device sync and offline behavior

- Use **Cloud Firestore as the source of truth** and enable its **persistent IndexedDB local cache**. Do **not** build a second manual IndexedDB sync engine.
- Store each deck as a **separate Firestore document** to prevent unrelated deck edits overwriting one another. Subscribe to the authenticated user's collection with `onSnapshot` and `includeMetadataChanges: true`.
- Display honest sync states:
  - **Synced:** no pending local writes and latest visible snapshot has server confirmation.
  - **Waiting to sync:** one or more writes have not been committed; local changes remain available.
  - **Viewing cached data:** no confirmed fresh server snapshot, even if there are no pending edits.
  - **Error:** a write failed (permission denied, quota, etc.); do not report success.
- Cache the PWA app shell and last-used catalog/assets so it can open offline after first successful visit. Cached decks remain browsable/editable; profile lookups that require the network show a clear offline message.
- Reconnect and allow Firestore to flush queued writes. For simultaneous edits to the same deck, document **last committed write wins** as the v1 behavior. Do not promise conflict-free merging.
- Include **Export my decks** (JSON) as a simple portability/backup option; **Import JSON** can be a follow-up unless trivial.
- On sign-out, unsubscribe immediately and isolate/clear previous-user data appropriately; note Firestore persistent cache can remain on disk and should be used only on trusted devices.

**Accept when:** A deck created or edited offline remains visible locally, later syncs after reconnection, and appears on a second logged-in device with an accurate status indicator.

### F8 — Design and interaction

**Direction:** Premium-feeling, playful, fast, tidy. Visual cues from Clash Royale without cloning its menus or suggesting official affiliation. Use crisp card art, good typography, generous spacing, and one delightful interaction at a time.

- **Mobile-first** at 360 px width; desktop should use a comfortable two-column library/editor layout. Support PWA installation and touch targets of at least ~44 px.
- Library layout: compact top header with sync status and avatar; categories as scrollable chips; cards as clean tiles; prominent **Add Deck**; one search box that can switch between personal decks and **Search Player**.
- Editor: deck slots at the top, card collection grid below, sticky bottom **Save** action on small screens, smooth selection/replacement animation, and visible current card levels.
- **Motion:** Short card transitions, subtle hover/lift, lightweight category/filter transitions, satisfying save feedback, skeleton loaders instead of jarring jumps.
- **Three.js (small, deliberate use):** Lazy-load an optional decorative 3D card-stack/pocket-arena scene on the empty state or landing/header. No Three.js in the critical editor, deck-copy flow, or card grid. Prefer `three` + React Three Fiber only if the effect genuinely improves the result; fall back to tasteful CSS motion on weak devices and when `prefers-reduced-motion` is enabled.
- No autoplay sound, blocking splash screen, overdrawn particle background, excessive neon, or animation that impairs performance.
- Accessibility: keyboard selection, labels, focus outlines, sufficient contrast, reduced motion, and responsive image fallbacks.

**Accept when:** Core actions feel instant on a mid-range phone; disabling motion does not impair any operation.

## 4. Implementation architecture (keep this small)

| Concern | V1 choice | Why |
| --- | --- | --- |
| UI | React + TypeScript + Vite | Fast development and static deployment |
| Styling | Tailwind CSS + lightweight reusable components; Motion for transitions | Polished without a custom design framework |
| 3D | Lazy-loaded optional Three.js / React Three Fiber | Decorative, not foundational |
| Authentication | Firebase Auth (Google provider) | No password/backend account system |
| Persistent library | Cloud Firestore | Per-user deck docs and live sync |
| Offline | Firestore persistent local cache (IndexedDB) + PWA service worker | No second syncing engine |
| Deployment | Cloudflare Pages | One static deployment, free to start |
| API key proxy | Cloudflare Pages Functions (`/api/*`) | Small server-side adapter with secrets |
| Game data | Official Clash Royale REST API | Cards, levels, current deck, battle history |

**Important API deployment decision:** The Clash Royale API uses IP allowlisting; Cloudflare Pages Functions do not provide an ordinary fixed outbound IP. The first technical spike must verify RoyaleAPI's documented proxy approach using a Supercell API key restricted to the proxy's allowlisted address. Keep the token as an encrypted server-side Cloudflare secret. A third-party proxy may see the API token; assess the trust tradeoff. If this integration fails, use a small known-static-egress server/proxy. Never ship a client-side key or silently remove profile lookups from the finished product.

**Minimal server routes** (GET-only, strict input validation, normalized responses):

- `GET /api/cards` → card IDs, names, elixir cost, rarity, Evo/Hero capability, normal/alternate artwork; cache for about a day.
- `GET /api/players/:tag` → public name/tag/summary, current deck, full owned card collection/levels and Tower Troops; short cache (e.g. one minute).
- `GET /api/players/:tag/battles` → recent battle log reduced to supported eight-card deck records; short cache (e.g. two minutes).

Protect the game token in Pages secrets. Do not create a generic fetch proxy; allow only these routes. Limit abusive requests by IP with Cloudflare's rate-limiting facilities (use a modest starter threshold), return `429` when necessary, use cached responses where safe, and never send Supercell credentials to the browser. Since these endpoints return public game data, Firebase login is **not** their authorization mechanism; CR Pocket private data is protected separately at Firestore. A verified Firebase-token gate can be added to the proxy later if abuse warrants it.

**Cost guardrail:** Keep Firebase on Spark (free; Firestore currently includes 50,000 document reads/day, 20,000 writes/day and 1 GiB storage) and Cloudflare Workers/Pages Functions on their free allocation (currently 100,000 function requests/day across the account). Quotas are not unlimited; on non-billed plans service can stop serving over-quota traffic. Add usage monitoring, but never upgrade billing automatically.

**Do not add:** Express/NestJS, a custom account database, WebSockets, a recurring data pipeline, Redis, Redux, vector DB, or bespoke offline synchronization.

## 5. Suggested data model

**Firestore:**

- `users/{firebaseUid}`
  - `playerTag: string | null` — **unverified** public Clash Royale tag
  - `categories: [{ id: string, name: string }]` — simple user-managed collection
  - `createdAt`, `updatedAt`
- `users/{firebaseUid}/decks/{deckId}`
  - `schemaVersion: 1`
  - `name: string`, `notes?: string`, `favorite: boolean`
  - `slots: [{ position: 0..7, cardId: number, form: "base" | "evo" | "hero" | "champion" }]`
  - `towerTroopId: number | null`
  - `categoryIds: string[]`
  - `source: { kind: "manual" | "link" | "player", playerTag?: string, playerName?: string, playedAt?: string }`
  - `createdAt`, `updatedAt`

Slot roles derive from positions: position `0` is Evo, `1` Hero, `2` Wild, and `3..7` ordinary. The editor may visually rearrange slots as long as their identities and form selections stay explicit. Require all eight `cardId`s to be distinct. This data model can be revised if actual in-game slot import semantics require adjustments, but never conflate *card ownership* with *deck slot activation*.

Derive artwork and card labels at render time from the current game catalog, not by copying every image URL into every deck document. Keep names/categories/notes local to the user. Store the player's latest observed levels in memory/client cache with a freshness timestamp, not separately in every saved deck.

## 6. Authentication, authorization, and privacy

- Firebase UID is the **only** ownership identity for private CR Pocket records. A Clash Royale tag never maps to a Firestore document path or grants account access.
- Firestore rules should allow read/write under `users/{uid}` and its `decks` subcollection **only when** `request.auth.uid == uid`. Default-deny other paths. Apply basic type/size validation for profile and deck fields where practical.
- Test two different Google/test Firebase accounts. User B must fail to **read, create, edit, or delete** user A's profile/decks, even if B types A's player tag or crafts Firestore calls manually.
- All public player-profile information fetched from Supercell is **read-only**. It is legal within this product for user B to view player A's public deck and card levels, but B can only save a copy into B's own CR Pocket account.
- Avoid logging auth tokens, game API keys, or complete private library data.
- Show the Supercell Fan Content Policy-required unofficial fan-content disclaimer and attribution; this is a free, noncommercial fan tool, not endorsed by Supercell.

## 7. Edge cases that must not be ignored

- **Bad player tag / not found / upstream unavailable / rate limited:** Inline message + retry; existing saved decks remain functional.
- **Player with empty or incomplete current deck:** Show a clear empty state, not a broken eight-slot UI.
- **Battle with 2v2, draft, multiple participants, or 7/12+ cards:** Select the searched player's actual battle participant when possible; skip unsupported/non-eight-card formats rather than mislabeling someone else's deck.
- **Catalog doesn't yet include a newly released card/form:** Show unknown-card placeholder with its numeric ID; don't corrupt saved data. Provide refresh.
- **Missing Hero/Evo icon:** Keep valid base card portrait and a form badge; never use a wrong card's art.
- **Imported deck with missing slot/form metadata:** Preserve eight cards and ask for manual form-slot selection.
- **Same eight cards but different Tower Troop or active special forms:** Treat as distinct deck variants when detecting duplicates.
- **Game not installed / deep link blocked:** Offer URL copy, QR, and help text; don't report a successful in-game import.
- **Firestore offline cache missing on first visit:** Explain that first-time setup/profile search needs connectivity.
- **One device edits a document while another edits that same document:** v1 last-write-wins; preserve separate docs for separate decks and don't promise conflict resolution.

## 8. Build sequence / agent milestones

### M0 — Feasibility spike (must happen first)

1. Obtain a developer API key through the official developer portal; configure allowed outbound IP/proxy without exposing it.
2. Fetch a live card catalog and player profile; validate real shapes of card levels, Hero/Evo assets, `currentDeck`, and `battlelog` with fixtures.
3. Generate a real eight-card `link.clashroyale.com` URL; test handoff on a physical phone with Clash Royale installed. Confirm Tower Troop URL behavior rather than guessing query parameters.
4. Document results and blockers in `docs/api-notes.md`. **Do not fake unsupported API capabilities.**

### M1 — Thin working slice

- Scaffold React PWA on Cloudflare Pages; Google sign-in; Firestore schema and security rules.
- Add one sample deck manually, save it, reload it, and observe it on a second device.
- Open its official link in the game.

### M2 — Core functionality

- Real catalog; player-tag profile and card-level lookup; current/recent deck browsing; save another player's deck.
- Library + categories + add/edit/duplicate/delete + editor card gallery + Tower Troop.
- Correct Evo/Hero/Wild state, portraits, and eligibility warnings.

### M3 — Offline, security, and polish

- Firestore IndexedDB persistence, accurate sync indicators, PWA offline shell, JSON export.
- Authorization tests, API error states and rate limits, mobile/device QA.
- Add motion and **optional lazy-loaded Three.js scene last**. Profile/core actions must not require 3D to load.
- Publish an approachable README and a short demo showing laptop-to-phone deck sync and game import.

## 9. Acceptance checklist (definition of done)

- [ ] Google login persists; my collection is visible across laptop and phone.
- [ ] Player tag is optional, saved once per account, and not used as proof of ownership.
- [ ] Search any valid player tag; show their current and eligible recently played decks.
- [ ] Save someone else's deck as an independent private copy with source attribution.
- [ ] Parse and save a valid external Clash Royale deck link.
- [ ] Create, rename, filter, and remove categories without deleting decks.
- [ ] Add, edit, duplicate, favorite, and delete owned decks.
- [ ] Eight-slot editor with searchable card catalog and **my** normalized card levels.
- [ ] Evo, Hero/Champion, and Wild forms work with accurate portraits/labels and valid modes.
- [ ] Tower Troop supported in stored deck and appropriately handled during import.
- [ ] Official copy link successfully hands off to Clash Royale on an actual phone; desktop shows QR/link.
- [ ] Show manual Evo/Hero configuration reminder before game handoff.
- [ ] Offline changes survive reload and sync on reconnection; status never falsely claims sync.
- [ ] Cross-account Firestore access denied in automated tests.
- [ ] UI is excellent on mobile, accessible, animated but smooth; optional Three.js is nonblocking.
- [ ] Free-tier use, README, `.env.example`, setup steps, attribution/disclaimer, and deployment are documented.

## 10. Non-goals for v1

No AI deck recommendations; no deck win-rate prediction; no meta scraping; no social feed; no player-tag ownership verification; no writes to the Clash Royale account; no subscriptions; no native iOS/Android application; no user-to-user sharing of private CR Pocket libraries; no custom server framework; no manual conflict-resolution UI.

## 11. Delivery instructions for agents

- Deliver a working repository with understandable commits, typed code, a clean structure, runnable tests, Firebase security rules, setup instructions, `.env.example`, and a deployable Cloudflare Pages configuration.
- Include clear `docs/api-notes.md` explaining every verified external API property, proxy limitation, level-normalization rule, and actual mobile game-link test.
- Keep secrets out of the frontend/repository. Do not turn on a billable plan without explicit approval.
- When a game API field or deep-link behavior is uncertain, **verify it, gracefully degrade, and record the limitation**. Never make up a response or silently omit a user-required feature.
- Work in the build sequence above. **Stop adding scope once the acceptance checklist passes.**

## References for implementation

- [Official Clash Royale Developer API](https://developer.clashroyale.com/)
- [Clash Royale cards and deck slots — Supercell Support](https://support.clashroyale.com/hc/en-us/articles/49484924205595-Cards-Decks)
- [March 2026 slot rework — Supercell](https://supercell.com/en/games/clashroyale/blog/news/mid-march-update/)
- [Community-verified 2026 API shapes and level/form semantics](https://github.com/jthingelstad/cr-agent-api-docs/blob/main/players.md) — useful but not an official spec; test against live responses.
- [RoyaleAPI proxy documentation](https://docs.royaleapi.com/proxy) — third-party operational dependency, verify before production.
- [Deck copy-link behavior and limitations](https://www.deckbeacon.app/guides/how-to-copy-a-clash-royale-deck)
- [Firebase offline persistence](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [Firestore snapshot metadata](https://firebase.google.com/docs/reference/js/firestore.snapshotmetadata)
- [Firestore pricing and free quota](https://firebase.google.com/docs/firestore/pricing)
- [Cloudflare Pages Functions free quota](https://developers.cloudflare.com/pages/functions/pricing/)
- [Firestore authorization rules](https://firebase.google.com/docs/rules/rules-and-auth)
- [Cloudflare Pages Functions and secrets](https://developers.cloudflare.com/pages/functions/bindings/)
- [Supercell Fan Content Policy](https://supercell.com/en/fan-content-policy/)
