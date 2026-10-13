import { useState, type ReactNode } from 'react';
import { Copy, Heart, Star, Swords, RefreshCw } from 'lucide-react';
import type { CatalogCard } from '@shared/types';
import {
  Avatar,
  AvgElixir,
  Badge,
  Button,
  CardArt,
  CardStackHero,
  Chip,
  ChipScroller,
  ConfirmDialog,
  DeckPreviewStrip,
  DeckTileSkeleton,
  Disclaimer,
  ElixirBadge,
  EmptyState,
  IconButton,
  NewChip,
  SearchField,
  Segmented,
  Sheet,
  Skeleton,
  SyncPill,
  toast,
  type SearchMode,
} from '@/ui';

/* ---------------------------------------------------------------------------
 * Sample catalog cards — real public art from the RoyaleAPI CDN
 * (verified 200; SW caches royaleapi.com art per vite.config.ts).
 * ------------------------------------------------------------------------ */
const art = (key: string) => `https://cdns3.royaleapi.com/static/img/cards-150/${key}.png`;

const mk = (partial: Partial<CatalogCard> & Pick<CatalogCard, 'id' | 'name' | 'elixir' | 'rarity'>): CatalogCard => ({
  maxLevel: 15,
  canEvo: false,
  canHero: false,
  isChampion: false,
  art: { base: null, evo: null, hero: null },
  ...partial,
});

const knight = mk({ id: 26000000, name: 'Knight', elixir: 3, rarity: 'common', canEvo: true, art: { base: art('knight'), evo: null, hero: null } });
const archers = mk({ id: 26000001, name: 'Archers', elixir: 3, rarity: 'common', canEvo: true, art: { base: art('archers'), evo: null, hero: null } });
const skeletons = mk({ id: 26000010, name: 'Skeletons', elixir: 1, rarity: 'common', canEvo: true, art: { base: art('skeletons'), evo: null, hero: null } });
const hog = mk({ id: 26000021, name: 'Hog Rider', elixir: 4, rarity: 'rare', art: { base: art('hog-rider'), evo: null, hero: null } });
const fireball = mk({ id: 28000000, name: 'Fireball', elixir: 4, rarity: 'rare', art: { base: art('fireball'), evo: null, hero: null } });
const zap = mk({ id: 28000008, name: 'Zap', elixir: 2, rarity: 'common', canEvo: true, art: { base: art('zap'), evo: null, hero: null } });
const princess = mk({ id: 26000026, name: 'Princess', elixir: 3, rarity: 'legendary', art: { base: art('princess'), evo: null, hero: null } });
const megaKnight = mk({ id: 26000055, name: 'Mega Knight', elixir: 7, rarity: 'legendary', canHero: true, art: { base: art('mega-knight'), evo: null, hero: null } });
const miner = mk({ id: 26000032, name: 'Miner', elixir: 3, rarity: 'champion', isChampion: true, art: { base: art('miner'), evo: null, hero: null } });
const musketeer = mk({ id: 26000014, name: 'Musketeer', elixir: 4, rarity: 'rare', canEvo: true, art: { base: art('musketeer'), evo: null, hero: null } });
const giant = mk({ id: 26000003, name: 'Giant', elixir: 5, rarity: 'rare', art: { base: art('giant'), evo: null, hero: null } });
const balloon = mk({ id: 26000006, name: 'Balloon', elixir: 5, rarity: 'epic', art: { base: art('balloon'), evo: null, hero: null } });

const sampleDeck = [
  { card: hog, form: 'base' as const, level: 14 },
  { card: knight, form: 'evo' as const, level: 14 },
  { card: miner, form: 'champion' as const, level: 12 },
  { card: musketeer, form: 'base' as const, level: 13 },
  { card: skeletons, form: 'base' as const, level: 14 },
  { card: fireball, form: 'base' as const, level: 13 },
  { card: zap, form: 'base' as const, level: 14 },
  { card: princess, form: 'base' as const, level: null },
];

function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl text-gold-300">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export default function UiKitPage() {
  const [chip, setChip] = useState('all');
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('decks');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="pb-16">
      <h1 className="font-display text-3xl text-ink">UI Kit</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Dev showcase of every <code className="text-royal-300">src/ui</code> component. See <code className="text-royal-300">docs/design.md</code>.
      </p>

      <Section title="Buttons" hint="gold (primary, pressed lip) · violet · ghost · danger + loading + icons">
        <Button variant="gold" icon={<Star />}>Open in Clash Royale</Button>
        <Button variant="violet">Save deck</Button>
        <Button variant="ghost" icon={<Copy />}>Copy link</Button>
        <Button variant="danger">Delete</Button>
        <Button variant="violet" loading>Saving…</Button>
        <Button variant="gold" size="sm">Small</Button>
        <Button variant="violet" size="lg">Large</Button>
        <IconButton aria-label="Refresh" variant="solid"><RefreshCw /></IconButton>
        <IconButton aria-label="Favorite" variant="gold"><Heart /></IconButton>
        <IconButton aria-label="More" variant="ghost"><Swords /></IconButton>
      </Section>

      <Section title="Chips" hint="Animated active pill (layoutId), trailing + New slot">
        <ChipScroller aria-label="Categories" trailing={<NewChip label="New" onClick={() => toast.info('Create category (demo)')} />}>
          {[
            ['all', 'All'], ['fav', 'Favorites'], ['ladder', 'Ladder'], ['2v2', '2v2'],
            ['challenge', 'Challenge'], ['fun', 'Meme'], ['war', 'Clan War'],
          ].map(([id, label]) => (
            <Chip key={id} layoutKey="uikit-chips" label={label} active={chip === id!} onClick={() => setChip(id!)} count={id === 'all' ? 12 : undefined} />
          ))}
        </ChipScroller>
      </Section>

      <Section title="Search & segments" hint="One box that switches between My decks and Player search">
        <SearchField value={query} onChange={setQuery} mode={searchMode} onModeChange={setSearchMode} className="w-full max-w-md" />
        <Segmented
          aria-label="Demo filter"
          value={seg}
          onChange={setSeg}
          options={[{ value: 'a', label: 'All' }, { value: 'b', label: 'Owned' }, { value: 'c', label: 'Missing' }]}
        />
      </Section>

      <Section title="CardArt — forms & rims" hint="base · EVO (violet/pink glow) · HERO (gold) · CHAMP (amber) · Wild role rim">
        <CardArt card={knight} level={14} src={knight.art.base} />
        <CardArt card={knight} level={14} form="evo" role="evo" src={knight.art.base} />
        <CardArt card={megaKnight} level={13} form="hero" role="hero" src={megaKnight.art.base} />
        <CardArt card={miner} level={12} form="champion" role="hero" src={miner.art.base} />
        <CardArt card={archers} level={14} role="wild" src={archers.art.base} />
        <CardArt card={giant} level={11} src={giant.art.base} ownership="not_owned" />
        <CardArt card={musketeer} level={13} form="evo" role="evo" src={musketeer.art.base} ownership="form_locked" />
        <CardArt card={balloon} level={12} src={balloon.art.base} state="selected" onClick={() => toast.info('Card tapped')} />
        <CardArt card={princess} level={12} src={princess.art.base} state="dimmed" />
      </Section>

      <Section title="CardArt — empty slots" hint="Role labels: Evo / Hero / Wild / +">
        <CardArt state="empty" role="evo" onClick={() => toast.info('Pick an Evo card')} />
        <CardArt state="empty" role="hero" onClick={() => toast.info('Pick a Hero card')} />
        <CardArt state="empty" role="wild" onClick={() => toast.info('Pick a Wild card')} />
        <CardArt state="empty" role="normal" onClick={() => toast.info('Pick a card')} />
      </Section>

      <Section title="CardArt — fallbacks" hint="Broken src → fallbackSrc; both broken → initials; unknown id → placeholder; sizes">
        <CardArt card={knight} level={14} src="https://example.invalid/broken.png" fallbackSrc={knight.art.base} label="Knight (fallback art demo)" />
        <CardArt card={fireball} level={13} src="https://example.invalid/broken.png" fallbackSrc="https://example.invalid/also-broken.png" label="Fireball (initials fallback demo)" />
        <CardArt card={null} unknownId={26000099} level={null} label="Unknown card #26000099" />
        <CardArt card={knight} level={14} size="lg" src={knight.art.base} />
        <CardArt card={knight} level={14} size="sm" src={knight.art.base} />
        <CardArt card={knight} level={14} size="xs" src={knight.art.base} />
      </Section>

      <Section title="DeckPreviewStrip" hint="8×1 compact row (deck tiles) — roles from position, forms recolor the rim">
        <div className="surface w-full max-w-xl p-4">
          <DeckPreviewStrip cards={sampleDeck} />
          <div className="mt-3 flex items-center gap-2">
            <AvgElixir value={3.6} />
            <Badge tone="violet">Ladder</Badge>
            <Badge tone="gold" icon={<Star />}>Favorite</Badge>
            <Badge tone="neutral">edited 2h ago</Badge>
          </div>
        </div>
        <DeckPreviewStrip cards={sampleDeck.slice(0, 5)} layout="grid" />
      </Section>

      <Section title="Elixir" hint="Drop badge + average pill">
        <ElixirBadge cost={1} />
        <ElixirBadge cost={4} size="lg" />
        <ElixirBadge cost={null} />
        <AvgElixir value={3.8} />
        <AvgElixir value={null} />
      </Section>

      <Section title="Badges & avatars">
        <Badge tone="violet">Evo</Badge>
        <Badge tone="gold">Hero</Badge>
        <Badge tone="elixir">7.0 avg</Badge>
        <Badge tone="teal">Wild</Badge>
        <Badge tone="good">Owned</Badge>
        <Badge tone="bad">Not unlocked</Badge>
        <Avatar name="Ada Lovelace" photoURL="https://example.invalid/none.png" />
        <Avatar name="Goblin Giant" size="lg" />
        <Avatar name={null} size="sm" />
      </Section>

      <Section title="SyncPill" hint="Honest F7 states + demo variant">
        <SyncPill state="loading" />
        <SyncPill state="synced" />
        <SyncPill state="pending" />
        <SyncPill state="cached" />
        <SyncPill state="error" />
        <SyncPill state="demo" />
      </Section>

      <Section title="Feedback — toasts, sheet, confirm" hint="toast.success/error/info; bottom sheet on mobile, dialog on desktop">
        <Button variant="gold" size="sm" onClick={() => toast.success('Deck saved to your shelf!')}>Success toast</Button>
        <Button variant="danger" size="sm" onClick={() => toast.error('Sync failed — will retry when online')}>Error toast</Button>
        <Button variant="ghost" size="sm" onClick={() => toast.info('Copied deck link')}>Info toast</Button>
        <Button variant="violet" size="sm" onClick={() => setSheetOpen(true)}>Open sheet</Button>
        <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>Delete deck…</Button>
      </Section>

      <Section title="Skeletons" hint="Shimmer; static under prefers-reduced-motion">
        <Skeleton className="h-5 w-40" />
        <Skeleton circle className="size-10" />
        <div className="w-full max-w-xl"><DeckTileSkeleton /></div>
      </Section>

      <Section title="EmptyState & hero & disclaimer">
        <EmptyState
          illustration={<Swords />}
          title="No decks here yet"
          body="Save a deck from a player you admire, or build one from scratch."
          action={<Button variant="gold" size="sm">Add deck</Button>}
        />
        <CardStackHero className="scale-75" />
        <Disclaimer className="max-w-md" />
      </Section>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Save to My Decks"
        footer={
          <>
            <Button variant="ghost" fullWidth onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button variant="gold" fullWidth onClick={() => { setSheetOpen(false); toast.success('Deck saved to your shelf!'); }}>Save copy</Button>
          </>
        }
      >
        <p className="text-sm text-ink-dim">This creates a private copy in your library. Changes to the original player's deck never overwrite it.</p>
        <div className="mt-4">
          <DeckPreviewStrip cards={sampleDeck} />
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); toast.success('Deck deleted'); }}
        title="Delete this deck?"
        body="“Hog 2.6 Cycle” will be removed from your library on all devices. This can't be undone."
        confirmLabel="Delete deck"
        tone="danger"
      />
    </div>
  );
}
