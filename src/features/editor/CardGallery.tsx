import { memo, useMemo, useState, type RefObject } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Check, RefreshCw } from 'lucide-react';
import type { CatalogCard } from '@shared/types';
import { cardLevel, type CardContext } from '@/features/common/cards';
import { useMyCollection } from '@/game/myCollectionStore';
import { CardArt, Chip, ChipScroller, SearchField, Segmented, Skeleton, toast } from '@/ui';
import { tapSquash } from '@/ui/motion';
import { formatRelativeAge } from './editorState';

type OwnedFilter = 'all' | 'owned';

interface GalleryTileProps {
  card: CatalogCard;
  inDeck: boolean;
  level: number | null | undefined;
  owned: boolean | undefined;
  onTap: (cardId: number) => void;
}

/** One gallery card. Memoized — with ~125 cards, taps must not re-render the grid. */
const GalleryTile = memo(function GalleryTile({ card, inDeck, level, owned, onTap }: GalleryTileProps) {
  const ariaLabel = [
    card.name,
    `${card.elixir ?? 'unknown'} elixir`,
    level != null ? `level ${level}` : 'level unknown',
    owned === false ? 'not in your collection' : null,
    inDeck ? 'already in deck — tap to select its slot' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <motion.button
      type="button"
      whileTap={tapSquash}
      onClick={() => onTap(card.id)}
      aria-label={ariaLabel}
      className="relative flex w-full min-w-0 flex-col items-center gap-1 rounded-xl p-0.5"
    >
      <CardArt
        card={card}
        size="fill"
        state={inDeck ? 'dimmed' : 'normal'}
        level={level}
        ownership={owned === false ? 'not_owned' : undefined}
        src={card.art.base}
      />
      {inDeck && (
        <span
          className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-good-500 text-night-950 ring-2 ring-night-900"
          aria-hidden
        >
          <Check className="size-3" strokeWidth={3.5} />
        </span>
      )}
      <span className="w-full truncate px-0.5 text-center text-[0.65rem] leading-tight font-semibold text-ink-dim">
        {card.name}
      </span>
    </motion.button>
  );
});

/** "Levels from #TAG · updated 5m ago · Refresh" — or the honest empty/error states. */
function CollectionHeader({ hasTag }: { hasTag: boolean }) {
  const status = useMyCollection((s) => s.status);
  const updatedAt = useMyCollection((s) => s.updatedAt);
  const tag = useMyCollection((s) => s.tag);
  const refresh = useMyCollection((s) => s.refresh);

  if (!hasTag) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-ink-dim">
        Add your player tag in{' '}
        <Link to="/settings" className="font-bold text-royal-300 underline underline-offset-2">
          Settings
        </Link>{' '}
        to see your levels.
      </p>
    );
  }
  if (status === 'loading' || status === 'idle') {
    return <Skeleton className="h-10 w-full rounded-2xl" />;
  }
  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-bad-400/30 bg-bad-500/10 px-3.5 py-2.5">
        <p className="min-w-0 flex-1 text-sm font-semibold text-bad-300">
          Couldn&apos;t load levels — editing still works.
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-white/12 bg-white/5 px-3 text-xs font-bold text-ink-dim transition-colors hover:bg-white/10 hover:text-ink"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Retry
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-1 text-xs font-semibold text-ink-faint">
      <p className="min-w-0 flex-1 truncate">
        Levels from <span className="font-display text-ink-dim">{tag}</span>
        {updatedAt != null && <> · updated {formatRelativeAge(Date.now(), updatedAt)}</>}
      </p>
      <button
        type="button"
        onClick={() => void refresh()}
        aria-label="Refresh card levels"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-white/10 hover:text-ink"
      >
        <RefreshCw className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export interface CardGalleryProps {
  ctx: CardContext;
  /** Ids currently placed in the deck (dimmed + checked). */
  inDeck: ReadonlySet<number>;
  hasTag: boolean;
  onTap: (cardId: number) => void;
  /** Scrolled/focused into view when an empty slot activates. */
  containerRef: RefObject<HTMLElement | null>;
}

/** Searchable, filterable card collection — tap a card to place it. */
export function CardGallery({ ctx, inDeck, hasTag, onTap, containerRef }: CardGalleryProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<OwnedFilter>('all');
  const [elixir, setElixir] = useState<number | null>(null);

  const costs = useMemo(() => {
    const set = new Set<number>();
    for (const c of ctx.cards) if (c.elixir != null) set.add(c.elixir);
    return [...set].sort((a, b) => a - b);
  }, [ctx.cards]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = ctx.cards;
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));
    if (filter === 'owned' && ctx.owned) list = list.filter((c) => ctx.owned!.has(c.id));
    if (elixir != null) list = list.filter((c) => c.elixir === elixir);
    return [...list].sort((a, b) => (a.elixir ?? 99) - (b.elixir ?? 99) || a.name.localeCompare(b.name));
  }, [ctx.cards, ctx.owned, query, filter, elixir]);

  const onFilterChange = (next: OwnedFilter) => {
    if (next === 'owned' && !ctx.owned) {
      toast.info('Add your player tag in Settings to filter by owned cards.');
      return;
    }
    setFilter(next);
  };

  return (
    <section ref={containerRef} aria-label="Card collection" className="scroll-mt-20 space-y-3">
      <CollectionHeader hasTag={hasTag} />

      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search cards…"
          aria-label="Search cards"
          className="min-w-0 flex-1"
        />
        <Segmented<OwnedFilter>
          size="sm"
          aria-label="Ownership filter"
          layoutKey="ed-owned"
          value={filter}
          onChange={onFilterChange}
          options={[
            { value: 'all', label: 'All' },
            { value: 'owned', label: 'Owned' },
          ]}
        />
      </div>

      <ChipScroller aria-label="Filter by elixir cost">
        {costs.map((cost) => (
          <Chip
            key={cost}
            layoutKey="ed-cost"
            label={String(cost)}
            active={elixir === cost}
            onClick={() => setElixir((cur) => (cur === cost ? null : cost))}
          />
        ))}
      </ChipScroller>

      <p className="px-1 text-xs font-semibold text-ink-faint" aria-live="polite">
        {visible.length} card{visible.length === 1 ? '' : 's'}
        {elixir != null ? ` · ${elixir} elixir` : ''}
        {filter === 'owned' ? ' · owned' : ''}
      </p>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-8 text-center text-sm text-ink-dim">
          No cards match that search.
        </p>
      ) : (
        <ul className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5 xl:grid-cols-7">
          {visible.map((card) => (
            <li key={card.id} className="min-w-0">
              <GalleryTile
                card={card}
                inDeck={inDeck.has(card.id)}
                level={cardLevel(ctx.owned, card.id)}
                owned={ctx.owned ? ctx.owned.has(card.id) : undefined}
                onTap={onTap}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
