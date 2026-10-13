import type { Deck } from '@/domain/types';
import { Sheet } from '@/ui';

export interface OpenInClashRoyaleSheetProps {
  /** Must be a complete deck; the sheet never builds a link for drafts. */
  deck: Deck | null;
  open: boolean;
  onClose: () => void;
}

/** STUB — replaced by the share/editor worker. */
export function OpenInClashRoyaleSheet({ deck, open, onClose }: OpenInClashRoyaleSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Open in Clash Royale">
      <p>{deck?.name}</p>
    </Sheet>
  );
}
