import { Check } from 'lucide-react';
import type { CatalogCard, OwnedCard } from '@shared/types';
import { TOWER_PRINCESS_ID } from '@/domain/deck';
import { Badge, CardArt, Sheet } from '@/ui';
import { cn } from '@/ui/cn';

export interface TowerTroopSheetProps {
  open: boolean;
  onClose: () => void;
  /** Current deck value (null = default Tower Princess). */
  towerTroopId: number | null;
  towerTroops: CatalogCard[];
  /** Owned tower troops from the signed-in user's collection (empty map = unknown). */
  ownedTowerTroops: Map<number, OwnedCard>;
  hasCollection: boolean;
  onPick: (id: number | null) => void;
}

/** Tower Troop picker — kept separate from the 8 main deck slots (spec F4). */
export function TowerTroopSheet({
  open,
  onClose,
  towerTroopId,
  towerTroops,
  ownedTowerTroops,
  hasCollection,
  onPick,
}: TowerTroopSheetProps) {
  const current = towerTroopId ?? TOWER_PRINCESS_ID;
  const sorted = [...towerTroops].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Sheet open={open} onClose={onClose} title="Tower Troop">
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Tower troop">
        {sorted.map((troop) => {
          const active = troop.id === current;
          const owned = ownedTowerTroops.has(troop.id);
          return (
            <button
              key={troop.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                // Tower Princess is the default — store null so decks stay clean.
                onPick(troop.id === TOWER_PRINCESS_ID ? null : troop.id);
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
                <CardArt card={troop} size="xs" src={troop.art.base} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-sm text-ink">{troop.name}</span>
                {troop.id === TOWER_PRINCESS_ID && (
                  <span className="text-[0.7rem] font-semibold text-ink-faint">Default</span>
                )}
              </span>
              {hasCollection && !owned && <Badge tone="bad">Not owned</Badge>}
              {active && <Check className="size-5 shrink-0 text-gold-400" aria-hidden />}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-ink-faint">
        Deck links can&apos;t reliably carry the Tower Troop yet — remember to set it in the game
        after importing.
      </p>
    </Sheet>
  );
}
