# API notes — Clash Royale data integration

Everything CR Pocket relies on from the official Clash Royale API, what is verified,
and what is still pending a live key. Last updated: 2026-10-13.

## Sources

| Source | Role |
| --- | --- |
| [jthingelstad/cr-agent-api-docs](https://github.com/jthingelstad/cr-agent-api-docs) (`cards.md`, `players.md`) | Community-verified API shapes, based on millions of archived live payloads (March–September 2026). Our primary reference. |
| [RoyaleAPI proxy docs](https://docs.royaleapi.com/proxy) | Proxy setup. |
| [RoyaleAPI/cr-api-data](https://github.com/RoyaleAPI/cr-api-data) `docs/json/cards.json` | Cross-check of card ids/names/elixir/rarity. |
| Captured live `GET /v1/cards` payload (via [Jason-XII/cr-memory-reader](https://github.com/Jason-XII/cr-memory-reader), `deploy/cards.json`) | Our `shared/fixtures/cards.json` — a real official response. |

## VERIFIED

- **`GET /v1/cards` response shape** — `{ items: ScCatalogCard[], supportItems: ScCatalogCard[] }`.
  Our fixture is a real captured payload: 123 standard cards + 4 Tower Troops
  (`supportItems`), matching the community docs' 2026-09-08 observation exactly.
  - Card fields: `name`, `id`, `maxLevel`, `maxEvolutionLevel` (optional), `elixirCost`
    (optional — **Mirror really has no `elixirCost`**), `iconUrls`, `rarity`.
  - `iconUrls.medium` always present; **`iconUrls.evolutionMedium`** present iff Evo-capable;
    **`iconUrls.heroMedium`** present iff Hero-capable. In our fixture all 123 cards satisfy
    `(maxEvolutionLevel & 1) ⇔ evolutionMedium present` and `(maxEvolutionLevel & 2) ⇔ heroMedium
    present` with zero exceptions (same invariant the community docs verified on 2026-09-09).
    Art hosts: `api-assets.clashroyale.com/cards/300/…`, `/cardevolutions/300/…`,
    `/cardheroes/300/…`. Spot-checked 4 URLs with `curl -I` → HTTP 200 (Knight base/evo/hero,
    Tower Princess base).
  - Tower Troops (`supportItems`) have no `elixirCost`/`maxEvolutionLevel`:
    Tower Princess `159000000`, Cannoneer `159000001`, Dagger Duchess `159000002`,
    Royal Chef `159000004`.
  - Champion rarity exists (`rarity: "champion"`; 8 champions in the fixture).
  - `Spirit Empress` legitimately appears twice with different ids (`28000025`, `26000105`).
- **Rarity → API `maxLevel` mapping**: common 16, rare 14, epic 11, legendary 8, champion 6
  (consistent across all 123 fixture cards; Tower Troops follow the same per-rarity caps).
- **Level normalization rule** (implemented in `shared/normalize.ts` → `normalizeLevel`):
  `normalized = level + (16 - maxLevel)`, using the card's own rarity-relative `maxLevel`.
  This is the rarity-independent form documented in `cards.md`; per-rarity equivalents:
  common `+0`, rare `+2`, epic `+5`, legendary `+8`, champion `+10`. All rarities top out at
  normalized 16. The same rule applies to Tower Troops. Missing `level` or `maxLevel` →
  `null` (rendered as "unknown"; never invented).
- **`evolutionLevel` / `maxEvolutionLevel` are bit fields**: `1` = Evo, `2` = Hero, `3` = both.
  - `maxEvolutionLevel` (catalog + player cards) = card capability.
  - `evolutionLevel` in `cards[]` (collection) = **unlocked forms** (3 occurs).
  - `evolutionLevel` in `currentDeck[]` and battle-log participant `cards` = **active/played-as
    form**; `3` is never observed there (a slot plays Evo OR Hero). If a `3` ever appears in
    deck context we degrade to `'evo'` (defensive, documented here).
  - Maxed/equipped cards report `count: 0` — `count` is stash copies only and must NOT be
    treated as ownership. Our fixtures exercise this (Clara's maxed Knight, count 0).
- **Player profile fields used** (`GET /v1/players/{tag}`): `tag`, `name`, `trophies`,
  `bestTrophies`, `arena{name}`, `clan{tag,name}` (**absent entirely** when clanless — our
  Nadia fixture), `expLevel` (deprecated in 2026; kept only for display, never for King Tower
  math), `currentDeck` (**7-card and empty decks occur in the wild** — our Nadia fixture has 7
  → normalized to `null`), `currentDeckSupportCards` (the one Tower Troop; can be `[]`),
  `cards` (collection), `supportCards` (Tower Troop collection).
- **Battle log** (`GET /v1/players/{tag}/battlelog`): bare array (no paging), ~30 entries.
  `battleTime` format `YYYYMMDDTHHmmss.sssZ`. `team`/`opponent` have **2 entries per side in
  2v2** — the searched player is found by tag match within `team`. Reduction rules
  (`normalizeBattleDecks`): exactly-8-card decks only (duels report 16/24 top-level cards,
  boat defense 12, some events 0 — all skipped and counted in `skipped`); tower troop from
  participant `supportCards[0]`; mode label from `gameMode.name` (reliably present) falling
  back to `type`; deduped by `deckSignature(cards, towerTroopId)` (sorted `id:form` pairs +
  tower troop), most recent first.
- **RoyaleAPI proxy is reachable and functional** (2026-10-13, local `wrangler pages dev`):
  with a dummy token, `GET https://proxy.royaleapi.dev/v1/cards` correctly forwarded upstream
  and Supercell returned 403, which our function mapped to `502 {"error":"upstream"}` without
  exposing the token. Proxy docs confirm: allowlist IP **`45.79.218.79`** on the Supercell key,
  and substitute `https://api.clashroyale.com/` → `https://proxy.royaleapi.dev`.
- **Pages Functions local serving**: `npm run dev:api`
  (`wrangler pages dev --port 8788 --proxy 5173`) serves all three routes; without a token
  they return `503 {"error":"not_configured"}`; bad tags return `400 {"error":"bad_tag"}`
  without an upstream call.

## UNVERIFIED (pending a real Supercell API key)

- Live validation of `GET /v1/players/{tag}` and `/battlelog` response shapes against the
  current game. Our raw types (`shared/supercell.ts`) and player/battlelog fixtures are
  modeled on the community docs' September 2026 observations, not on our own capture.
  **M0 spike item: re-check `evolutionLevel` semantics, `currentDeckSupportCards`, and level
  offsets against a live profile before launch.**
- Live validation that the `/cards` capture we bundle (September 2026) is still current —
  new cards/forms may exist; the UI must show unknown-id placeholders and offer refresh.
- The proxy's long-term reliability/latency under real traffic.
- Whether Supercell has changed the level cap above 16 (rule is cap-parameterized via
  `LEVEL_CAP` in `shared/normalize.ts`; change the constant, not the formula).

## Proxy setup (production)

1. Create a key at <https://developer.clashroyale.com/> and allowlist IP `45.79.218.79`
   (RoyaleAPI's proxy egress IP per <https://docs.royaleapi.com/proxy>).
2. `wrangler pages secret put CR_API_TOKEN` (or dashboard → Pages project → secrets).
   Local dev: copy `.dev.vars.example` to `.dev.vars` and fill it in.
3. `CR_API_BASE` defaults to `https://proxy.royaleapi.dev/v1` in `wrangler.toml`.

**Trust tradeoff (accepted for v1):** RoyaleAPI's proxy terminates TLS and can see the
Supercell token in the `Authorization` header. The token only reads public game data and is
useless to anyone whose IP is not allowlisted, so exposure impact is limited to RoyaleAPI
itself (an established community vendor). If this is ever deemed unacceptable, run a tiny
known-egress-IP forwarder and set `CR_API_BASE` to it instead — no code change needed.

## Rate limiting

Cloudflare's `ratelimit` binding is **not available to Pages Functions** (not among the
binding types Pages supports — verified against the Pages Wrangler-configuration docs,
2026-10-13). We ship a best-effort per-IP limiter instead (`functions/_lib/rateLimit.ts`):
60 requests/minute per `CF-Connecting-IP`, counted in the Cache API keyed by minute window.
Honest limitations: Cache API state is per-colo and evictable, so this throttles casual abuse
but is not a hard guarantee; it fails open (never blocks legitimate traffic if the Cache API
errors). For real abuse, add a Cloudflare WAF rate-limiting rule on `/api/*` in the dashboard.

## Caching

| Route | `Cache-Control` | Edge cache (Cache API) |
| --- | --- | --- |
| `GET /api/cards` | 1 day | yes |
| `GET /api/players/:tag` | 60 s | yes |
| `GET /api/players/:tag/battles` | 120 s | yes |

Only successful (2xx) responses are edge-cached; errors are `no-store`. The service worker
additionally stale-while-revalidates `/api/cards` and cache-firsts card art (see
`vite.config.ts`).

## Demo mode (no key required)

`src/game/api.ts` runs the bundled fixtures through the **same** `shared/normalize.ts`
pipeline as live mode, with 300–600 ms simulated latency. Demo tags (valid CR tag alphabet
`0289PYLQGRJCUV`):

| Tag | Player | Edge cases exercised |
| --- | --- | --- |
| `#2CJV0LY8P` | Clara | Mixed rarity levels, maxed `count: 0` card, evo-only/hero-only/both unlocks, champion at API level 3 (→13), current deck with active Evo + Hero, 3 tower troops at different levels. Battle log: PvP, **2v2** (player is the *second* team entry, Dagger Duchess tower troop), **duplicate deck** (dedup), **16-card duel** (skipped), **0-card All Random Princess event** (skipped), battle with **empty `supportCards`**. |
| `#9QRUGCP0Y` | Maximus | Fully maxed 123-card collection (all `count: 0`, every form unlocked), maxed tower troops incl. Royal Chef, champion in current deck, pathOfLegend battle. |
| `#8PL2UCY0Q` | Nadia | Tiny low-level collection, **7-card current deck → `null`**, **no `clan` key**, empty `currentDeckSupportCards`. |
| `#0V0V0V0V` | — | Valid tag format, no fixture → `not_found` error path. |
| (e.g. `#DEMO0001`) | — | Invalid characters → `bad_tag` error path. |

## Real-device deck link test

_(Placeholder — the deck-link format and its real-device verification are owned by another
workstream; results land here.)_
