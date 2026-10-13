import type { Deck } from '@/domain/types';
import { Sheet } from '@/ui';

export interface SaveDeckSheetProps {
  open: boolean;
  onClose: () => void;
  /** Deck to save as a new private copy (fresh id, source attribution already set). */
  draft: Deck | null;
  /** Forms/special-slot placement could not be inferred reliably; prompt the user to review in the editor. */
  needsFormReview?: boolean;
  onSaved?: (deckId: string) => void;
}

/** STUB — replaced by the player/import worker. */
export function SaveDeckSheet({ open, onClose, draft }: SaveDeckSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Save to My Decks">
      <p>{draft?.name}</p>
    </Sheet>
  );
}
