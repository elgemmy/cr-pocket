import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { BookmarkCheck, TriangleAlert } from 'lucide-react';
import { useLibrary } from '@/data/libraryStore';
import { findDuplicate, newId } from '@/domain/deck';
import type { Deck } from '@/domain/types';
import { useCardContext, deckPreviewCards } from '@/features/common/cards';
import { CategoryPicker } from '@/features/library/CategoryPicker';
import { Button, DeckPreviewStrip, Sheet, toast } from '@/ui';

export interface SaveDeckSheetProps {
  open: boolean;
  onClose: () => void;
  /** Deck to save as a new private copy (fresh id, source attribution already set). */
  draft: Deck | null;
  /** Forms/special-slot placement could not be inferred reliably; prompt the user to review in the editor. */
  needsFormReview?: boolean;
  onSaved?: (deckId: string) => void;
}

/**
 * "Save to My Decks" sheet (F2/F3): name + categories + notes, then an
 * independent private copy with a fresh id and fresh timestamps. The source
 * player's data is never touched. Exact-variant duplicates get an
 * "Already saved" callout with View original / Save another variation.
 */
export function SaveDeckSheet({ open, onClose, draft, needsFormReview = false, onSaved }: SaveDeckSheetProps) {
  const navigate = useNavigate();
  const decks = useLibrary((s) => s.decks);
  const saveDeck = useLibrary((s) => s.saveDeck);
  const ctx = useCardContext();

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [variationAck, setVariationAck] = useState(false);

  // Reset the form every time the sheet opens with a (new) draft.
  useEffect(() => {
    if (open && draft) {
      setName(draft.name);
      setNotes('');
      setCategoryIds([]);
      setVariationAck(false);
    }
  }, [open, draft]);

  const dupe = useMemo(() => (draft ? findDuplicate(decks, draft) : undefined), [decks, draft]);
  const showDupeCallout = dupe != null && !variationAck;

  const save = () => {
    if (!draft) return;
    const now = Date.now();
    const copy: Deck = {
      ...draft,
      id: newId(),
      name: name.trim() || draft.name,
      notes: notes.trim(),
      categoryIds,
      createdAt: now,
      updatedAt: now,
    };
    saveDeck(copy);
    toast.success('Deck saved to your shelf!');
    onSaved?.(copy.id);
    onClose();
    if (needsFormReview) navigate(`/deck/${copy.id}?review=1`);
  };

  const viewOriginal = () => {
    if (!dupe) return;
    onClose();
    navigate(`/deck/${dupe.id}`);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Save to My Decks"
      footer={
        draft && !showDupeCallout ? (
          <>
            <Button variant="ghost" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button variant="gold" fullWidth icon={<BookmarkCheck />} onClick={save}>
              Save to My Decks
            </Button>
          </>
        ) : undefined
      }
    >
      {draft && (
        <div className="flex flex-col gap-4">
          <DeckPreviewStrip cards={deckPreviewCards(draft, ctx)} />

          {showDupeCallout ? (
            <div className="rounded-2xl border border-good-400/30 bg-good-500/10 p-4">
              <p className="font-display text-base text-good-400">Already saved as “{dupe.name}”</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-dim">
                These exact eight cards, forms and Tower Troop are already on your shelf.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="ghost" onClick={viewOriginal}>
                  View original
                </Button>
                <Button variant="violet" onClick={() => setVariationAck(true)}>
                  Save another variation
                </Button>
              </div>
            </div>
          ) : (
            <>
              {needsFormReview && (
                <div className="flex gap-2.5 rounded-2xl border border-gold-400/30 bg-gold-400/10 p-3.5 text-sm text-gold-200">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <p>We couldn't tell which slot each Evo/Hero was in — after saving you'll review it in the editor.</p>
                </div>
              )}

              <div>
                <label htmlFor="save-deck-name" className="text-sm font-semibold text-ink-dim">
                  Deck name
                </label>
                <input
                  id="save-deck-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  placeholder="Name this deck"
                  className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-night-950/70 px-3.5 text-ink placeholder:text-ink-faint focus:border-royal-400/70 focus:shadow-[0_0_0_3px_rgb(109_92_255/0.25)] focus:outline-none"
                />
              </div>

              <div>
                <span className="text-sm font-semibold text-ink-dim">Categories</span>
                <div className="mt-1.5">
                  <CategoryPicker value={categoryIds} onChange={setCategoryIds} />
                </div>
              </div>

              <div>
                <label htmlFor="save-deck-notes" className="text-sm font-semibold text-ink-dim">
                  Notes <span className="font-normal text-ink-faint">(optional)</span>
                </label>
                <textarea
                  id="save-deck-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={280}
                  placeholder="e.g. swap Fireball for Poison against bait"
                  className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-night-950/70 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-royal-400/70 focus:shadow-[0_0_0_3px_rgb(109_92_255/0.25)] focus:outline-none"
                />
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
