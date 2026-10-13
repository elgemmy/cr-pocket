import { ArrowLeftRight, Check, Lock, Trash2, TriangleAlert } from 'lucide-react';
import type { CatalogCard, OwnedCard } from '@shared/types';
import type { Deck, SlotForm } from '@/domain/types';
import { slotRole, allowedForms, FORM_LABELS, SLOT_LABELS, ownershipWarning } from '@/domain/slots';
import { Badge, CardArt, cardArtSrc, Sheet } from '@/ui';
import { cn } from '@/ui/cn';

export interface SlotMenuSheetProps {
  deck: Deck;
  /** Open slot position; null closes the sheet. */
  position: number | null;
  lookup: (id: number) => CatalogCard | undefined;
  /** Signed-in user's collection (null = no tag loaded). */
  owned: Map<number, OwnedCard> | null;
  onClose: () => void;
  onSetForm: (position: number, form: SlotForm) => void;
  onSwap: (position: number) => void;
  onRemove: (position: number) => void;
}

const roleBadgeTone = { evo: 'elixir', hero: 'gold', wild: 'teal', normal: 'neutral' } as const;

/**
 * Filled-slot menu: form choices for special slots (each previewed with its own
 * artwork), "Swap with…" and "Remove". Ownership only ever warns, never blocks.
 */
export function SlotMenuSheet({
  deck,
  position,
  lookup,
  owned,
  onClose,
  onSetForm,
  onSwap,
  onRemove,
}: SlotMenuSheetProps) {
  const slot = position != null ? deck.slots[position] : undefined;
  const card = slot?.cardId != null ? lookup(slot.cardId) : undefined;
  const role = position != null ? slotRole(position) : 'normal';
  const forms: SlotForm[] = card ? allowedForms(role, card) : ['base'];
  const ownedCard = slot?.cardId != null && owned ? (owned.get(slot.cardId) ?? null) : undefined;

  return (
    <Sheet
      open={position != null && slot?.cardId != null}
      onClose={onClose}
      title={
        card ? (
          <span className="inline-flex items-center gap-2">
            {card.name}
            <Badge tone={roleBadgeTone[role]}>{SLOT_LABELS[role]} slot</Badge>
          </span>
        ) : (
          'Unknown card'
        )
      }
    >
      {position != null && slot?.cardId != null && (
        <div className="flex flex-col gap-4">
          {/* Form choices — each row previews the exact portrait for that form. */}
          {card && forms.length > 0 && (
            <div role="radiogroup" aria-label="Active form" className="flex flex-col gap-2">
              {forms.map((form) => {
                const { src, fallbackSrc } = cardArtSrc(card, form);
                const warning = ownershipWarning(card, form, ownedCard);
                const active = slot.form === form;
                return (
                  <button
                    key={form}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      if (!active) onSetForm(position, form);
                      onClose();
                    }}
                    className={cn(
                      'flex min-h-11 items-center gap-3 rounded-2xl border p-2 text-left transition-colors',
                      active
                        ? 'border-gold-400/70 bg-gold-400/10'
                        : 'border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.08]',
                    )}
                  >
                    <span aria-hidden className="shrink-0">
                      <CardArt card={card} form={form} size="xs" src={src} fallbackSrc={fallbackSrc} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-sm text-ink">{FORM_LABELS[form]}</span>
                      {warning === 'form_locked' && (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[0.7rem] font-bold text-hero-300">
                          <Lock className="size-3" aria-hidden /> Not unlocked on your account
                        </span>
                      )}
                      {warning === 'not_owned' && (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[0.7rem] font-bold text-bad-300">
                          <TriangleAlert className="size-3" aria-hidden /> Not in your collection
                        </span>
                      )}
                      {warning === 'unknown' && (
                        <span className="mt-0.5 block text-[0.7rem] font-semibold text-ink-faint">
                          Ownership unknown — no player tag
                        </span>
                      )}
                    </span>
                    {active && <Check className="size-5 shrink-0 text-gold-400" aria-hidden />}
                  </button>
                );
              })}
            </div>
          )}
          {!card && (
            <p className="text-sm text-ink-dim">
              Card <span className="font-bold tabular-nums">#{slot.cardId}</span> is not in the current
              catalog. It stays in the deck — forms unlock once the catalog knows it.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwap(position);
              }}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-wild-400/40 bg-wild-400/10 font-semibold text-wild-300 transition-colors hover:bg-wild-400/20"
            >
              <ArrowLeftRight className="size-4" aria-hidden />
              Swap with…
            </button>
            <button
              type="button"
              onClick={() => {
                onRemove(position);
                onClose();
              }}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-bad-400/40 bg-bad-500/10 font-semibold text-bad-300 transition-colors hover:bg-bad-500/20"
            >
              <Trash2 className="size-4" aria-hidden />
              Remove
            </button>
          </div>
          <p className="text-center text-xs text-ink-faint">
            Or tap any card in the gallery below to replace this slot.
          </p>
        </div>
      )}
    </Sheet>
  );
}
