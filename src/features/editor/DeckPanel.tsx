import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Pencil, TriangleAlert, X } from 'lucide-react';
import type { CatalogCard, OwnedCard } from '@shared/types';
import { TOWER_PRINCESS_ID, averageElixir, validateDeck } from '@/domain/deck';
import { DECK_SIZE, FORM_LABELS, SLOT_LABELS, slotRole } from '@/domain/slots';
import type { DeckSlot, SlotRole } from '@/domain/types';
import { cardLevel, cardOwnership, type CardContext } from '@/features/common/cards';
import { AvgElixir, Badge, CardArt, cardArtSrc } from '@/ui';
import { cn } from '@/ui/cn';
import { springSnappy, tapSquash } from '@/ui/motion';
import { emptySlotCount, type EditorState } from './editorState';

const ROLE_TEXT: Record<SlotRole, string> = {
  evo: 'text-elixir-300',
  hero: 'text-hero-400',
  wild: 'text-wild-300',
  normal: 'text-ink-faint',
};

interface SlotTileProps {
  slot: DeckSlot;
  card: CatalogCard | undefined;
  level: number | null | undefined;
  ownership: 'owned' | 'not_owned' | 'form_locked' | 'unknown' | undefined;
  active: boolean;
  isSwapSource: boolean;
  swapArmed: boolean;
  onClick: () => void;
}

function SlotTile({ slot, card, level, ownership, active, isSwapSource, swapArmed, onClick }: SlotTileProps) {
  const role = slotRole(slot.position);
  const empty = slot.cardId == null;
  const { src, fallbackSrc } = cardArtSrc(card, slot.form);
  const roleLabel = SLOT_LABELS[role];
  const name = card?.name ?? (slot.cardId != null ? `Unknown card ${slot.cardId}` : null);

  const ariaLabel = empty
    ? `Empty ${roleLabel} slot — tap to choose a card`
    : `${roleLabel} slot: ${name}${slot.form !== 'base' ? `, ${FORM_LABELS[slot.form]} form` : ''}${
        level != null ? `, level ${level}` : ''
      } — tap for options`;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={tapSquash}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={cn(
        'relative block w-full rounded-[calc(var(--radius-tile)*0.62+4px)] p-0.5 transition-shadow duration-150',
        active && !isSwapSource && 'ring-2 ring-gold-400 shadow-[0_0_18px_rgb(255_200_60/0.35)]',
        isSwapSource && 'ring-2 ring-wild-400 shadow-[0_0_18px_rgb(45_212_191/0.45)]',
        swapArmed && !isSwapSource && 'cursor-copy hover:ring-2 hover:ring-wild-400/60',
      )}
    >
      {/* Pop on place/replace/form-change — snappy spring, never blocks the tap. */}
      <motion.span
        key={`${slot.cardId ?? 'empty'}:${slot.form}`}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={springSnappy}
        className="block"
      >
        <CardArt
          card={card ?? null}
          form={slot.form}
          role={role}
          state={empty ? 'empty' : 'normal'}
          size="fill"
          level={level}
          ownership={ownership}
          src={src}
          fallbackSrc={fallbackSrc}
          unknownId={!card && slot.cardId != null ? slot.cardId : undefined}
        />
      </motion.span>
    </motion.button>
  );
}

export interface DeckPanelProps {
  state: EditorState;
  ctx: CardContext;
  hasCollection: boolean;
  ownedTowerTroops: Map<number, OwnedCard>;
  onSlotTap: (position: number) => void;
  onCancelSwap: () => void;
  onOpenTower: () => void;
  onRename: (name: string) => void;
}

/** Left column: editable name, the 8 slots (Evo / Hero / Wild + 5), stats, warnings, tower troop. */
export function DeckPanel({
  state,
  ctx,
  hasCollection,
  ownedTowerTroops,
  onSlotTap,
  onCancelSwap,
  onOpenTower,
  onRename,
}: DeckPanelProps) {
  const { deck } = state;
  const avg = averageElixir(deck, ctx.lookup);
  const filled = DECK_SIZE - emptySlotCount(deck);
  const warnings = validateDeck(deck, ctx.lookup, ctx.towerLookup).filter((i) => i.severity === 'warning');
  const towerId = deck.towerTroopId ?? TOWER_PRINCESS_ID;
  const towerCard = ctx.towerLookup(towerId) ?? null;
  const towerOwned = hasCollection ? ownedTowerTroops.has(towerId) : undefined;
  const swapCard =
    state.swapSource != null ? ctx.lookup(state.deck.slots[state.swapSource]?.cardId ?? -1) : undefined;

  return (
    <div className="space-y-4">
      {/* Deck name — inline editable */}
      <label className="group flex items-center gap-2 rounded-2xl border border-transparent px-2 transition-colors focus-within:border-gold-400/60 focus-within:bg-night-950/60 hover:border-white/10">
        <input
          value={deck.name}
          onChange={(e) => onRename(e.target.value)}
          aria-label="Deck name"
          placeholder="Name your deck"
          maxLength={60}
          className="min-w-0 flex-1 bg-transparent py-1.5 font-display text-2xl text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <Pencil
          className="size-4 shrink-0 text-ink-faint transition-colors group-focus-within:text-gold-400"
          aria-hidden
        />
      </label>

      {/* Swap mode banner */}
      <AnimatePresence>
        {state.swapSource != null && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2 rounded-2xl border border-wild-400/40 bg-wild-400/10 px-3 py-2"
            role="status"
          >
            <p className="min-w-0 flex-1 text-sm font-semibold text-wild-300">
              Tap another slot to swap with {swapCard?.name ?? 'this card'}.
            </p>
            <button
              type="button"
              onClick={onCancelSwap}
              aria-label="Cancel swap"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-wild-300 transition-colors hover:bg-wild-400/20"
            >
              <X className="size-4" aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The 8 slots */}
      <section className="surface p-3" aria-label="Deck slots">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <h2 className="font-display text-xs tracking-[0.18em] text-ink-dim uppercase">Your deck</h2>
          <div className="flex items-center gap-2" aria-live="polite">
            <Badge tone="neutral">{filled}/{DECK_SIZE}</Badge>
            <AvgElixir value={avg} />
          </div>
        </div>
        <ol className="grid grid-cols-4 gap-x-2 gap-y-2.5">
          {deck.slots.map((slot) => {
            const role = slotRole(slot.position);
            const card = slot.cardId != null ? ctx.lookup(slot.cardId) : undefined;
            return (
              <li key={slot.position} className="flex min-w-0 flex-col items-center gap-1">
                <span
                  aria-hidden={role === 'normal'}
                  className={cn(
                    'h-4 font-display text-[0.62rem] tracking-[0.2em] uppercase',
                    ROLE_TEXT[role],
                  )}
                >
                  {role === 'normal' ? '' : SLOT_LABELS[role]}
                </span>
                <SlotTile
                  slot={slot}
                  card={card}
                  level={cardLevel(ctx.owned, slot.cardId)}
                  ownership={cardOwnership(card, slot.form, ctx.owned)}
                  active={state.activeSlot === slot.position}
                  isSwapSource={state.swapSource === slot.position}
                  swapArmed={state.swapSource != null}
                  onClick={() => onSlotTap(slot.position)}
                />
              </li>
            );
          })}
        </ol>

        {warnings.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-white/8 pt-2.5">
            {warnings.map((w, i) => (
              <li key={`${w.code}-${w.position ?? i}`} className="flex items-start gap-1.5 text-xs font-semibold text-hero-300">
                <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                <span>{w.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tower troop — separate from the 8 main cards */}
      <section aria-label="Tower troop">
        <h2 className="mb-1.5 px-1 font-display text-xs tracking-[0.18em] text-ink-dim uppercase">
          Tower troop
        </h2>
        <motion.button
          type="button"
          onClick={onOpenTower}
          whileTap={tapSquash}
          className="surface flex min-h-14 w-full items-center gap-3 p-2.5 text-left transition-colors hover:bg-night-700/60"
          aria-label={`Tower troop: ${towerCard?.name ?? 'Unknown'} — tap to change`}
        >
          <CardArt card={towerCard} size="xs" src={towerCard?.art.base ?? null} unknownId={towerCard ? undefined : towerId} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-sm text-ink">
              {towerCard?.name ?? `Unknown troop #${towerId}`}
            </span>
            <span className="block text-[0.7rem] font-semibold text-ink-faint">
              {towerOwned === false ? 'Not in your collection' : deck.towerTroopId == null ? 'Default' : 'Selected'}
            </span>
          </span>
          {towerOwned === false && <Badge tone="bad">Not owned</Badge>}
          <ChevronRight className="size-4 shrink-0 text-ink-faint" aria-hidden />
        </motion.button>
      </section>
    </div>
  );
}
