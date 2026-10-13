import type { CatalogCard } from '@shared/types';
import type { SlotForm, SlotRole } from '@/domain/types';
import { CardArt, cardArtSrc, type CardArtOwnership } from './CardArt';
import { cn } from './cn';

export interface DeckPreviewCard {
  /** null = empty slot in a draft. */
  card: CatalogCard | null;
  /** For unknown cards not present in the catalog. */
  unknownId?: number;
  form?: SlotForm;
  level?: number | null;
  ownership?: CardArtOwnership;
}

export interface DeckPreviewStripProps {
  /** Exactly the deck's cards (up to 8); missing entries render as empty slots. */
  cards: DeckPreviewCard[];
  /** 'row' = 8×1 compact strip, 'grid' = 4×2. */
  layout?: 'row' | 'grid';
  className?: string;
}

const roleFor = (position: number): SlotRole =>
  position === 0 ? 'evo' : position === 1 ? 'hero' : position === 2 ? 'wild' : 'normal';

/**
 * Compact 8-card preview used on library deck tiles and player deck cards.
 * Slot roles come from position (0 Evo / 1 Hero / 2 Wild).
 */
export function DeckPreviewStrip({ cards, layout = 'row', className }: DeckPreviewStripProps) {
  const slots = Array.from({ length: 8 }, (_, i) => cards[i]);
  return (
    <div
      role="img"
      aria-label="Deck preview: eight cards"
      className={cn(
        layout === 'row' ? 'grid grid-cols-8 gap-1.5' : 'grid w-fit grid-cols-4 gap-1.5',
        className,
      )}
    >
      {slots.map((entry, i) => {
        const role = roleFor(i);
        if (!entry || !entry.card) {
          return (
            <CardArt
              key={i}
              size="xs"
              className="w-full"
              role={role}
              state={entry ? 'normal' : 'empty'}
              card={null}
              unknownId={entry?.unknownId}
              form={entry?.form ?? 'base'}
              level={entry?.level}
              ownership={entry?.ownership}
            />
          );
        }
        const form = entry.form ?? 'base';
        const { src, fallbackSrc } = cardArtSrc(entry.card, form);
        return (
          <CardArt
            key={i}
            size="xs"
            className="w-full"
            role={role}
            card={entry.card}
            form={form}
            level={entry.level}
            ownership={entry.ownership}
            src={src}
            fallbackSrc={fallbackSrc}
          />
        );
      })}
    </div>
  );
}
