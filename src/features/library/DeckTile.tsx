import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  Castle,
  Copy,
  EllipsisVertical,
  Gamepad2,
  Heart,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { Deck } from '@/domain/types';
import { TOWER_PRINCESS_ID, averageElixir, duplicateDeck } from '@/domain/deck';
import { useLibrary } from '@/data/libraryStore';
import { deckPreviewCards, useCardContext } from '@/features/common/cards';
import {
  AvgElixir,
  Badge,
  ConfirmDialog,
  DeckPreviewStrip,
  IconButton,
  cardArtSrc,
  cn,
  motionPresets,
  toast,
} from '@/ui';
import { relativeTime } from './relativeTime';

const { hoverLift, listItem, springSnappy, springSoft } = motionPresets;

interface TileMenuProps {
  deck: Deck;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  /** Lets the tile raise its z-index while the menu is open (stacking fix). */
  onOpenChange?: (open: boolean) => void;
}

/** "⋯" overflow menu: Edit / Duplicate / Favorite / Delete. Keyboard friendly. */
function TileMenu({ deck, onEdit, onDuplicate, onToggleFavorite, onDelete, onOpenChange }: TileMenuProps) {
  const [open, setOpenState] = useState(false);
  const setOpen = (v: boolean) => {
    setOpenState(v);
    onOpenChange?.(v);
  };
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  const item = (
    icon: React.ReactNode,
    label: string,
    action: () => void,
    opts?: { danger?: boolean; autoFocus?: boolean },
  ) => (
    <button
      type="button"
      role="menuitem"
      autoFocus={opts?.autoFocus}
      onClick={() => {
        setOpen(false);
        action();
      }}
      className={cn(
        'flex h-11 w-full items-center gap-2.5 rounded-xl px-3.5 text-sm font-semibold transition-colors',
        opts?.danger ? 'text-bad-300 hover:bg-bad-500/15' : 'text-ink-dim hover:bg-white/8 hover:text-ink',
      )}
    >
      <span className="inline-flex [&>svg]:size-4" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  );

  return (
    <div ref={rootRef} className="relative">
      <IconButton
        ref={buttonRef}
        aria-label={`More actions for ${deck.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        size="sm"
        onClick={() => setOpen(!open)}
      >
        <EllipsisVertical aria-hidden />
      </IconButton>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label={`Actions for ${deck.name}`}
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.1 } }}
            transition={springSnappy}
            className="absolute right-0 top-11 z-30 w-52 origin-top-right rounded-tile border border-white/10 bg-night-850 p-1.5 shadow-2xl"
          >
            {item(<Pencil />, 'Edit deck', onEdit, { autoFocus: true })}
            {item(<Copy />, 'Duplicate', onDuplicate)}
            {item(
              <Heart fill={deck.favorite ? 'currentColor' : 'none'} />,
              deck.favorite ? 'Unfavorite' : 'Favorite',
              onToggleFavorite,
            )}
            <div className="mx-2 my-1 h-px bg-white/8" aria-hidden />
            {item(<Trash2 />, 'Delete…', onDelete, { danger: true })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Favorite heart with a satisfying pop + tiny sparkle burst. */
function FavoriteButton({ deck }: { deck: Deck }) {
  const toggleFavorite = useLibrary((s) => s.toggleFavorite);
  const [burst, setBurst] = useState(0);

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.78 }}
      transition={springSnappy}
      onClick={() => {
        if (!deck.favorite) setBurst((b) => b + 1);
        toggleFavorite(deck.id);
      }}
      aria-label={deck.favorite ? `Remove ${deck.name} from favorites` : `Add ${deck.name} to favorites`}
      aria-pressed={deck.favorite}
      className={cn(
        'relative inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors',
        deck.favorite ? 'text-gold-400' : 'text-ink-faint hover:bg-white/8 hover:text-gold-300',
      )}
    >
      <motion.span
        key={deck.favorite ? 'on' : 'off'}
        initial={deck.favorite ? { scale: 0.4, rotate: -18 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={springSnappy}
        className="inline-flex"
      >
        <Heart className="size-5" fill={deck.favorite ? 'currentColor' : 'none'} aria-hidden />
      </motion.span>
      {burst > 0 && (
        <span key={burst} className="pointer-events-none absolute inset-0" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <motion.span
              key={i}
              className="absolute left-1/2 top-1/2 size-1.5 rounded-full bg-gold-300"
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: Math.cos((i * Math.PI) / 3) * 20,
                y: Math.sin((i * Math.PI) / 3) * 20,
                opacity: 0,
                scale: 0.3,
              }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              onAnimationComplete={i === 0 ? () => setBurst(0) : undefined}
            />
          ))}
        </span>
      )}
    </motion.button>
  );
}

/** Tiny tower-troop thumbnail (icon fallback — never another card's art). */
function TowerArt({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      role="img"
      aria-label={`Tower troop: ${name}`}
      className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-night-700 ring-1 ring-white/10"
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <Castle className="size-3.5 text-ink-faint" aria-hidden />
      )}
    </span>
  );
}

export interface DeckTileProps {
  deck: Deck;
  /** Category id → name, for badges. */
  categoryNames: Map<string, string>;
  /** Opens the OpenInClashRoyale sheet (owned by the page). */
  onOpenInGame: (deck: Deck) => void;
}

/**
 * One deck in the library grid (F3). The tile body is a stretched link to the
 * editor; actions sit above it. Animates with the list stagger + layout shifts.
 */
export function DeckTile({ deck, categoryNames, onOpenInGame }: DeckTileProps) {
  const navigate = useNavigate();
  const ctx = useCardContext();
  const saveDeck = useLibrary((s) => s.saveDeck);
  const deleteDeck = useLibrary((s) => s.deleteDeck);
  const toggleFavorite = useLibrary((s) => s.toggleFavorite);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const preview = deckPreviewCards(deck, ctx);
  const avg = averageElixir(deck, ctx.lookup);
  const towerId = deck.towerTroopId ?? TOWER_PRINCESS_ID;
  const towerCard = ctx.towerLookup(towerId) ?? null;
  const towerName = towerCard?.name ?? (towerId === TOWER_PRINCESS_ID ? 'Tower Princess' : 'Unknown tower');
  const towerArt = cardArtSrc(towerCard, 'base');

  const badges = deck.categoryIds
    .map((id) => categoryNames.get(id))
    .filter((n): n is string => Boolean(n));
  const shownBadges = badges.slice(0, 2);
  const extraBadges = badges.length - shownBadges.length;

  return (
    <motion.article
      layout
      variants={listItem}
      whileHover={hoverLift}
      transition={springSoft}
      className={cn('surface group relative flex flex-col gap-3 p-4', menuOpen && 'z-30')}
      aria-label={deck.name}
    >
      {/* Stretched link: tap anywhere on the tile body → editor. */}
      <Link
        to={`/deck/${deck.id}`}
        aria-label={`Edit deck ${deck.name}`}
        className="absolute inset-0 rounded-tile"
      />

      {/* Title row */}
      <div className="flex items-start gap-1.5">
        <h3 className="min-w-0 flex-1 truncate pt-1.5 font-display text-lg leading-tight text-ink">
          {deck.name}
        </h3>
        <span className="relative z-20 -mr-1 flex items-center">
          <FavoriteButton deck={deck} />
          <TileMenu
            deck={deck}
            onOpenChange={setMenuOpen}
            onEdit={() => navigate(`/deck/${deck.id}`)}
            onDuplicate={() => {
              saveDeck(duplicateDeck(deck, Date.now()));
              toast.success(`Duplicated — “${deck.name} copy” is at the top of your shelf`);
            }}
            onToggleFavorite={() => toggleFavorite(deck.id)}
            onDelete={() => setConfirmDelete(true)}
          />
        </span>
      </div>

      {/* 8-card preview */}
      <DeckPreviewStrip cards={preview} layout="row" />

      {/* Meta row: tower troop, avg elixir, edited */}
      <div className="flex items-center gap-2 text-xs text-ink-dim">
        <span className="flex min-w-0 items-center gap-1.5">
          <TowerArt src={towerArt.src ?? towerArt.fallbackSrc} name={towerName} />
          <span className="truncate font-semibold">{towerName}</span>
        </span>
        <span className="ml-auto shrink-0 tabular-nums text-ink-faint" title={new Date(deck.updatedAt).toLocaleString()}>
          {relativeTime(deck.updatedAt)}
        </span>
      </div>

      {/* Categories + elixir + primary action */}
      <div className="flex flex-wrap items-center gap-1.5">
        <AvgElixir value={avg} />
        {shownBadges.map((name) => (
          <Badge key={name} tone="violet">
            {name}
          </Badge>
        ))}
        {extraBadges > 0 && <Badge tone="neutral">+{extraBadges}</Badge>}
        <span className="relative z-10 ml-auto">
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            transition={springSnappy}
            onClick={() => onOpenInGame(deck)}
            aria-label={`Open ${deck.name} in Clash Royale`}
            className="lip inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-b from-gold-300 via-gold-400 to-gold-500 px-3.5 font-display text-sm tracking-wide text-night-900 [--lip-color:var(--color-gold-600)] hover:brightness-105"
          >
            <Gamepad2 className="size-4" aria-hidden />
            Open in CR
          </motion.button>
        </span>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          deleteDeck(deck.id);
          toast.success(`Deleted “${deck.name}”`);
        }}
        title="Delete this deck?"
        body={`“${deck.name}” will be removed from your shelf on every signed-in device. This can't be undone.`}
        confirmLabel="Delete deck"
        tone="danger"
      />
    </motion.article>
  );
}
