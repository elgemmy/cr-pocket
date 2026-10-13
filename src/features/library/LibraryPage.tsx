import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  Heart,
  Layers,
  Link2,
  Pencil,
  SearchX,
  SlidersHorizontal,
  Swords,
  Trash2,
  Wand2,
} from 'lucide-react';
import { MAX_CATEGORIES, useLibrary } from '@/data/libraryStore';
import { normalizeTag } from '@/domain/tag';
import type { Category, Deck } from '@/domain/types';
import { useCardContext } from '@/features/common/cards';
import { OpenInClashRoyaleSheet } from '@/features/share/OpenInClashRoyaleSheet';
import {
  Button,
  Chip,
  ChipScroller,
  ConfirmDialog,
  DeckTileSkeleton,
  EmptyState,
  IconButton,
  NewChip,
  SearchField,
  Sheet,
  motionPresets,
  toast,
  type SearchMode,
} from '@/ui';
import { DeckTile } from './DeckTile';
import { LibraryHeroSlot } from './LibraryHeroSlot';
import { TagPrompt } from './TagPrompt';
import { countInView, filterLibraryDecks, type LibraryView } from './filter';

const { listStagger } = motionPresets;

/** Small name-input sheet used for both "+ New" and rename. */
function CategoryNameSheet({
  open,
  title,
  initialName,
  submitLabel,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  initialName?: string;
  submitLabel: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName ?? '');
  const trimmed = name.trim();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="gold"
            fullWidth
            disabled={!trimmed}
            onClick={() => {
              if (trimmed) onSubmit(trimmed);
            }}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) onSubmit(trimmed);
        }}
      >
        <label htmlFor="category-name-input" className="mb-1.5 block text-sm font-semibold text-ink-dim">
          Category name
        </label>
        <input
          key={`${open}-${initialName ?? ''}`}
          id="category-name-input"
          defaultValue={initialName ?? ''}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ladder, Challenges, Fun decks"
          maxLength={40}
          className="h-11 w-full rounded-xl border border-white/12 bg-night-950/70 px-3.5 text-[0.95rem] font-semibold text-ink placeholder:font-normal placeholder:text-ink-faint focus:border-royal-400/70 focus:outline-none"
        />
      </form>
    </Sheet>
  );
}

/** Separate so the confirm copy can state that decks are never deleted. */
function ConfirmDeleteCategory({
  category,
  deckCount,
  onClose,
  onConfirm,
}: {
  category: Category | null;
  deckCount: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open={category != null}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`Delete “${category?.name ?? ''}”?`}
      body={
        deckCount > 0
          ? `Only the label is removed — the ${deckCount} deck${deckCount === 1 ? '' : 's'} in it stay on your shelf, safe and sound. Deleting a category never deletes decks.`
          : 'Only the label is removed. Deleting a category never deletes decks.'
      }
      confirmLabel="Delete category"
      tone="danger"
    />
  );
}

export default function LibraryPage() {
  const navigate = useNavigate();
  const status = useLibrary((s) => s.status);
  const decks = useLibrary((s) => s.decks);
  const categories = useLibrary((s) => s.profile.categories);
  const upsertCategory = useLibrary((s) => s.upsertCategory);
  const renameCategory = useLibrary((s) => s.renameCategory);
  const deleteCategory = useLibrary((s) => s.deleteCategory);
  const ctx = useCardContext();

  const [view, setView] = useState<LibraryView>({ kind: 'all' });
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('decks');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [manageCategory, setManageCategory] = useState<Category | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<Category | null>(null);
  const [gameDeck, setGameDeck] = useState<Deck | null>(null);

  const cardNameOf = useMemo(() => {
    const names = new Map(ctx.cards.map((c) => [c.id, c.name]));
    return (id: number) => names.get(id);
  }, [ctx.cards]);

  const categoryNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  // If the active category was deleted elsewhere, fall back to All.
  const activeView: LibraryView =
    view.kind === 'category' && !categoryNames.has(view.id) ? { kind: 'all' } : view;

  const visible = useMemo(
    () => filterLibraryDecks(decks, activeView, searchMode === 'decks' ? query : '', cardNameOf),
    [decks, activeView, query, searchMode, cardNameOf],
  );

  const activeCategory =
    activeView.kind === 'category' ? (categories.find((c) => c.id === activeView.id) ?? null) : null;

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    if (searchMode !== 'player') return;
    const tag = normalizeTag(query);
    if (!tag) {
      setSearchError('That doesn\u2019t look like a player tag — letters/numbers only, e.g. #2CJV0LY8P');
      return;
    }
    setSearchError(null);
    setQuery('');
    navigate(`/player/${tag.slice(1)}`);
  };

  const clearFilters = () => {
    setQuery('');
    setView({ kind: 'all' });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline gap-2.5">
        <h1 className="font-display text-2xl text-ink">My Decks</h1>
        {status === 'ready' && (
          <span className="text-sm font-bold tabular-nums text-ink-faint">
            {decks.length} {decks.length === 1 ? 'deck' : 'decks'}
          </span>
        )}
      </div>

      {/* F1 tag prompt */}
      <div className="mt-3">
        <TagPrompt />
      </div>

      {/* One search box: my decks OR a player tag (F3/F8) */}
      <form onSubmit={submitSearch} className="mt-1">
        <SearchField
          value={query}
          onChange={(v) => {
            setQuery(v);
            setSearchError(null);
          }}
          mode={searchMode}
          onModeChange={(m) => {
            setSearchMode(m);
            setSearchError(null);
            setQuery('');
          }}
          aria-label={searchMode === 'player' ? 'Search a player tag' : 'Search my decks or cards'}
        />
        {searchError ? (
          <p role="alert" className="mt-1.5 text-xs font-semibold text-bad-300">
            {searchError}
          </p>
        ) : (
          searchMode === 'player' && (
            <p className="mt-1.5 text-xs text-ink-faint">
              Enter a public player tag and press Enter to peek at their decks.
            </p>
          )
        )}
      </form>

      {/* Category chips */}
      <ChipScroller
        aria-label="Deck filters"
        className="mt-2"
        trailing={
          <span className="flex items-center gap-1">
            {activeCategory && (
              <IconButton
                aria-label={`Manage category ${activeCategory.name}`}
                size="sm"
                className="h-10 w-10 rounded-full"
                onClick={() => setManageCategory(activeCategory)}
              >
                <SlidersHorizontal aria-hidden />
              </IconButton>
            )}
            <NewChip label="New" onClick={() => setNewCategoryOpen(true)} />
          </span>
        }
      >
        <Chip
          layoutKey="lib-cats"
          label="All"
          active={activeView.kind === 'all'}
          count={decks.length}
          onClick={() => setView({ kind: 'all' })}
        />
        <Chip
          layoutKey="lib-cats"
          label="Favorites"
          icon={<Heart fill={activeView.kind === 'favorites' ? 'currentColor' : 'none'} />}
          active={activeView.kind === 'favorites'}
          count={countInView(decks, { kind: 'favorites' })}
          onClick={() => setView({ kind: 'favorites' })}
        />
        {categories.map((cat) => (
          <span
            key={cat.id}
            onContextMenu={(e) => {
              e.preventDefault();
              setManageCategory(cat);
            }}
          >
            <Chip
              layoutKey="lib-cats"
              label={cat.name}
              active={activeView.kind === 'category' && activeView.id === cat.id}
              count={countInView(decks, { kind: 'category', id: cat.id })}
              onClick={() => setView({ kind: 'category', id: cat.id })}
            />
          </span>
        ))}
      </ChipScroller>

      {/* Content */}
      {status !== 'ready' ? (
        <div
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Loading your decks"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <DeckTileSkeleton key={i} />
          ))}
        </div>
      ) : decks.length === 0 ? (
        /* Brand-new user: delightful empty state with the decorative hero slot */
        <div className="mt-2">
          <LibraryHeroSlot />
          <EmptyState
            className="py-6 sm:py-12"
            title="Your shelf is empty — let's fix that"
            body="Build something nasty, borrow a pro's deck, or paste a link from a friend. Your decks follow you across devices."
            action={
              <div className="flex w-full max-w-sm flex-col gap-2.5 sm:w-auto sm:max-w-none sm:flex-row">
                <Button variant="gold" icon={<Wand2 />} onClick={() => navigate('/deck/new')}>
                  Build a deck
                </Button>
                <Button variant="ghost" icon={<Swords />} onClick={() => navigate('/player')}>
                  Find a player
                </Button>
                <Button variant="ghost" icon={<Link2 />} onClick={() => navigate('/import')}>
                  Paste a deck link
                </Button>
              </div>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        /* Filtered to nothing */
        <EmptyState
          className="py-10"
          illustration={<SearchX />}
          title="Nothing on this shelf"
          body={
            activeView.kind === 'favorites'
              ? 'No favorites here yet — tap the heart on a deck you love.'
              : query.trim()
                ? `No decks match “${query.trim()}”${activeCategory ? ` in ${activeCategory.name}` : ''}.`
                : `No decks in ${activeCategory?.name ?? 'this view'} yet.`
          }
          action={
            <Button variant="ghost" onClick={clearFilters}>
              Clear search &amp; filters
            </Button>
          }
        />
      ) : (
        <motion.div
          variants={listStagger}
          initial="initial"
          animate="animate"
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((deck) => (
              <DeckTile
                key={deck.id}
                deck={deck}
                categoryNames={categoryNames}
                onOpenInGame={setGameDeck}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Playful flourish for long shelves */}
      {status === 'ready' && decks.length > 6 && (
        <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-ink-faint">
          <Layers className="size-3.5" aria-hidden />
          {decks.length} decks and counting — way better than 10 slots.
        </p>
      )}

      {/* Sheets & dialogs */}
      <CategoryNameSheet
        open={newCategoryOpen}
        title="New category"
        submitLabel="Create category"
        onClose={() => setNewCategoryOpen(false)}
        onSubmit={(name) => {
          const id = upsertCategory(name);
          setNewCategoryOpen(false);
          if (id) {
            setView({ kind: 'category', id });
            toast.success(`Category “${name}” ready`);
          } else if (name.trim()) {
            toast.error(`You can have up to ${MAX_CATEGORIES} categories`);
          }
        }}
      />

      <Sheet
        open={manageCategory != null && !renaming}
        onClose={() => setManageCategory(null)}
        title={manageCategory?.name ?? 'Category'}
      >
        {manageCategory && (
          <div className="flex flex-col gap-2">
            <p className="mb-1 text-sm text-ink-dim">
              {countInView(decks, { kind: 'category', id: manageCategory.id })} deck
              {countInView(decks, { kind: 'category', id: manageCategory.id }) === 1 ? '' : 's'} in
              this category.
            </p>
            <Button
              variant="ghost"
              icon={<Pencil />}
              onClick={() => setRenaming(true)}
              className="justify-start"
            >
              Rename category
            </Button>
            <Button
              variant="ghost"
              icon={<Trash2 />}
              onClick={() => {
                setConfirmDeleteCategory(manageCategory);
                setManageCategory(null);
              }}
              className="justify-start text-bad-300 hover:bg-bad-500/10 hover:text-bad-300"
            >
              Delete category…
            </Button>
          </div>
        )}
      </Sheet>

      <CategoryNameSheet
        open={renaming && manageCategory != null}
        title="Rename category"
        initialName={manageCategory?.name}
        submitLabel="Save name"
        onClose={() => {
          setRenaming(false);
          setManageCategory(null);
        }}
        onSubmit={(name) => {
          if (manageCategory) {
            renameCategory(manageCategory.id, name);
            toast.success('Category renamed');
          }
          setRenaming(false);
          setManageCategory(null);
        }}
      />

      <ConfirmDeleteCategory
        category={confirmDeleteCategory}
        deckCount={
          confirmDeleteCategory
            ? countInView(decks, { kind: 'category', id: confirmDeleteCategory.id })
            : 0
        }
        onClose={() => setConfirmDeleteCategory(null)}
        onConfirm={() => {
          if (!confirmDeleteCategory) return;
          deleteCategory(confirmDeleteCategory.id);
          if (activeView.kind === 'category' && activeView.id === confirmDeleteCategory.id) {
            setView({ kind: 'all' });
          }
          setConfirmDeleteCategory(null);
          toast.success(`Category “${confirmDeleteCategory.name}” deleted — your decks are safe`);
        }}
      />

      <OpenInClashRoyaleSheet deck={gameDeck} open={gameDeck != null} onClose={() => setGameDeck(null)} />
    </div>
  );
}
