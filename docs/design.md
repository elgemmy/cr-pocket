# CR Pocket — Design System ("night arena pocket")

Authoritative UI reference for all workers. If you build UI, use these tokens,
components, and motion rules instead of inventing new ones.
Live showcase: dev route **`/ui-kit`** (`src/app/UiKitPage.tsx`).

## 1. Visual direction

Premium, playful, fast. A deep-indigo night arena with royal violet surfaces,
chunky game-like buttons with a soft bottom "lip", crisp card art, gold reserved
for the primary action, and elixir-magenta reserved for elixir. One delightful
interaction at a time. Visual cues of Clash Royale without cloning its menus or
implying official affiliation.

- Typography: **Lilita One** (`font-display`) for headings, numbers, badges,
  button labels. **Nunito Variable** (`font-sans`, default) for body.
- Depth: `surface` (translucent panel + inner highlight + soft shadow) and
  `lip` (raised game-button bottom edge, presses down on `:active`).
- Background: fixed gradient + glow + subtle static noise lives in
  `src/index.css` on `body`. Do not add particle layers or per-page backgrounds.

## 2. Tokens (Tailwind v4 `@theme` in `src/index.css`)

| Token group | Values | Use |
| --- | --- | --- |
| `night-950…400` | `#0a0d26 → #6b76b8` | Backgrounds, panels, borders. `night-900` is the page base, `night-800/850` panels, `night-950` wells/inputs. |
| `royal-200…800` | `#c9c0ff → #382aa0` | Primary violet. `royal-500` = brand primary. |
| `gold-200…600` | `#ffedb0 → #c78a12` | Primary CTA, rewards, favorites, focus ring. Never for long text. |
| `elixir-200…600` | `#f8b8f2 → #a0219b` | Elixir badges/avg only. |
| `wild-300…500` | teal | Wild slot rim + "Wild" affordances. |
| `hero-300…500` | amber/gold | Hero/Champion rims and form-locked warnings. |
| `ink` / `ink-dim` / `ink-faint` | `#eef0ff / #b9c0e8 / #8a92c4` | Text. `ink-faint` only for ≥12px secondary text on `night-900/950`. |
| `good-400/500`, `bad-300…600` | green / red | Sync states, destructive actions. |
| `--radius-tile` | `1.25rem` | Card/panel radius (`rounded-tile`). |

Custom component classes (in `@layer components`):
`.surface`, `.lip` (override the lip color with `[--lip-color:…]`),
`.no-scrollbar`, `.shimmer`, `.pt-safe / .pb-safe / .pl-safe / .pr-safe`.

Focus ring: global `:focus-visible` gold outline — never remove outlines without
replacing them.

## 3. Component inventory (`src/ui/`, barrel: `@/ui`)

### Buttons — `Button`, `IconButton`
```tsx
<Button variant="gold" | "violet" | "ghost" | "danger"
        size="sm" | "md" | "lg" loading? icon? fullWidth? …buttonProps />
<IconButton aria-label="…" variant="ghost" | "solid" | "gold" size="sm" | "md" loading? />
```
- `gold` is the ONE primary action per view (Save, Open in Clash Royale, Continue with Google).
- `IconButton` **requires** `aria-label`.

### Chips — `Chip`, `ChipScroller`, `NewChip`
```tsx
<ChipScroller aria-label="Categories" trailing={<NewChip label="New" onClick={…} />}>
  <Chip layoutKey="lib-cats" label="Ladder" active count={4} onClick={…} />
</ChipScroller>
```
- All `Chip`s sharing one `layoutKey` animate a single active pill via `layoutId`.
  Use one unique `layoutKey` per scroller instance.

### Search — `SearchField`, `Segmented`
```tsx
<SearchField value onChange mode={"decks"|"player"} onModeChange? placeholder? />
<Segmented options={[{value,label,icon?}]} value onChange size="sm"|"md" aria-label="…" />
```
- Library search: one `SearchField` with the `decks|player` mode toggle (spec F3/F8).

### Overlays — `Sheet`, `ConfirmDialog`
```tsx
<Sheet open onClose title footer={…}>…</Sheet>
<ConfirmDialog open onClose onConfirm title body confirmLabel tone="danger"|"primary" loading? />
```
- Bottom sheet on mobile, centered dialog ≥md. Esc, backdrop click, drag-to-dismiss,
  basic focus trap, focus restore. Use `ConfirmDialog` for every destructive action.

### Feedback — `toast`, `ToastViewport`
```tsx
import { toast } from '@/ui';
toast.success('Deck saved to your shelf!'); toast.error(…); toast.info(…);
```
- `ToastViewport` is mounted once in `App.tsx`. Toasts are the save feedback (spec F8).

### Loading — `Skeleton`, `DeckTileSkeleton`
```tsx
<Skeleton className="h-5 w-40" circle? width? height? />
<DeckTileSkeleton />
```
Shimmer is automatically static under `prefers-reduced-motion`. Prefer skeletons
over spinners for content; spinners only inside buttons (`loading`).

### CardArt — the card portrait tile
```tsx
<CardArt
  card={CatalogCard | null}      // null → neutral "?" placeholder (+ unknownId)
  form={"base"|"evo"|"hero"|"champion"}
  level={number | null}          // null → "Lv —"
  size="xs"|"sm"|"md"|"lg"       // w-10 / w-14 / w-20 / w-28
  role={"evo"|"hero"|"wild"|"normal"}   // empty-slot label + rim when form=base
  state={"normal"|"selected"|"empty"|"dimmed"}
  ownership={"owned"|"not_owned"|"form_locked"|"unknown"}
  src={string | null}            // resolved, form-aware URL (caller's job)
  fallbackSrc={string | null}    // usually base art
  unknownId={number | string}
  onClick? label? className?
/>
// helper: const { src, fallbackSrc } = cardArtSrc(card, form)
```
- Aspect fixed at `300/358` — never stretches layout; images lazy-load.
- Fallback chain: `src` → `fallbackSrc` → initials/`#id` placeholder.
  **Never** render another card's art as a fallback (spec §7).
- Rims: Evo = violet→pink glow, Hero = gold, Champion = amber, Wild = teal→violet.
- `not_owned` shows a red warning dot, `form_locked` a gold lock dot. Warn, never block (spec F5).

### Deck preview — `DeckPreviewStrip`
```tsx
<DeckPreviewStrip layout="row"|"grid" cards={[{ card, unknownId?, form?, level?, ownership? }]} />
```
- Exactly 8 slots; index = position (0 Evo / 1 Hero / 2 Wild / 3–7 normal).
  Use on library tiles and player deck cards.

### Indicators — `ElixirBadge`, `AvgElixir`, `Badge`, `Avatar`, `SyncPill`
```tsx
<ElixirBadge cost={3} size="sm"|"md"|"lg" />
<AvgElixir value={3.6} />            // null → "—"
<Badge tone="violet"|"gold"|"elixir"|"teal"|"neutral"|"good"|"bad" icon?>…</Badge>
<Avatar name photoURL size="sm"|"md"|"lg" />
<SyncPill state="loading"|"synced"|"pending"|"cached"|"error"|"demo" />
```
- `SyncPill` labels are the exact F7 strings ("Waiting to sync", "Viewing cached
  data", "Demo mode — stored on this device"). Never claim "Synced" without
  server confirmation. Labels hide under 420px but stay in `aria-label`/`title`.

### Misc — `EmptyState`, `Disclaimer`, `CardStackHero`
```tsx
<EmptyState illustration={<Icon/>} title body? action={<Button/>} />
<Disclaimer />       // required fan-content attribution — keep on Settings/sign-in
<CardStackHero />    // sign-in hero; ALSO the 3D scene's reduced-motion fallback
```

## 4. App shell (`src/app/`)

- `App.tsx` — `BrowserRouter` + routes, `MotionConfig reducedMotion="user"`,
  `ToastViewport`. Auth gating TODO marker lives here (integrator wires
  `src/data`): signed-out → `SignInScreen`, signed-in → `AppLayout`.
- Routes: `/` library · `/deck/new` + `/deck/:id` editor · `/player` +
  `/player/:tag` · `/import` · `/settings` · `/ui-kit` (dev) · `/sign-in` (dev preview).
- `AppLayout` — sticky header (wordmark, `SyncPill`, avatar → settings),
  animated page outlet, mobile bottom tab bar with raised gold center "+".
  Props: `syncState`, `user`.
- `TwoColumn` — desktop two-column container; pages opt in:
  ```tsx
  <TwoColumn main={<DeckList/>} aside={<EditorPanel/>} />
  ```
  Stacks on mobile (main first). Use for library|editor and player|detail splits.
- `SignInScreen` — props `{ onSignIn, loading?, error?, demoMode?, hero? }`.
  The 3D worker lazy-mounts into the `hero` slot; default/fallback is `CardStackHero`.

## 5. Motion rules (`src/ui/motion.ts`)

- Durations ≤ 250ms; springs (`springSnappy`, `springSoft`) for presses/layout;
  `pageVariants` + `pageTransition` for route changes; `listStagger`/`listItem`
  for grids; `sheetVariants`/`backdropVariants` for overlays.
- `MotionConfig reducedMotion="user"` wraps the app — don't add raw CSS
  animations that ignore reduced motion; shimmer/float are already disabled in CSS.
- Motion never blocks actions: no `await` on animations before saving/copying.
- Hover lift / tap squash: use the exported `hoverLift` / `tapSquash` presets.

## 6. Accessibility rules

- Touch targets ≥ 44px (`h-11`+ buttons, `h-10` chips inside padded scrollers).
- Every icon-only control has `aria-label`; decorative icons are `aria-hidden`.
- Cards convey state in text/`aria-label`, not color alone (level "Lv —",
  warning dots have accessible names).
- Keyboard: all interactions are real `<button>`/`<a>`; Sheet traps focus and
  restores it on close; skip-link is the first element of the shell.
- Contrast: AA minimum (axe-clean on `/ui-kit`). `ink-faint` only for
  non-essential hints; never for values the user needs.

## 7. Do / Don't

**Do**
- Compose `@/ui` components; extend via `className` only for layout (width, margins).
- Use `Skeleton` while loading and `EmptyState` when empty.
- Keep one gold button per view.
- Use `tabular-nums` (built into badges/levels) for numbers.

**Don't**
- Don't hardcode hex colors in components — use the tokens.
- Don't add new fonts, global backgrounds, particles, neon, or autoplay sound.
- Don't block the UI on animations or network; warn (dot/toast) instead of blocking
  when data (levels, forms, ownership) is missing.
- Don't clone Clash Royale's actual menus/UI — cues only, always with the
  `Disclaimer` where attribution matters.
- Don't put Three.js in the editor, deck-copy flow, or card grids; lazy-load it
  into the `SignInScreen` `hero` slot or a decorative empty state only.

## 8. PWA icons

`public/icons/icon-192.png` / `icon-512.png` are generated from an SVG mark with
maskable-safe padding. Regenerate with `node scripts/generate-icons.mjs`
(devDependency `@resvg/resvg-js`).
