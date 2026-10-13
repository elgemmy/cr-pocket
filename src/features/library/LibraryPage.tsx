import { Layers } from 'lucide-react';
import { EmptyState } from '@/ui/EmptyState';
import { Button } from '@/ui/Button';
import { useNavigate } from 'react-router';

/**
 * F3 — My Decks library. STUB: replaced by the library worker.
 * Intended composition (see docs/design.md):
 *   SearchField (with decks/player mode toggle) → ChipScroller (categories)
 *   → deck tiles (DeckPreviewStrip + AvgElixir + Badge) → Add Deck.
 */
export default function LibraryPage() {
  const navigate = useNavigate();
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">My Decks</h1>
      <EmptyState
        illustration={<Layers />}
        title="Your shelf is empty — for now"
        body="The library experience is being built. Soon: categories, favorites, search, and one-tap restore."
        action={
          <Button variant="gold" onClick={() => navigate('/deck/new')}>
            Add your first deck
          </Button>
        }
      />
    </div>
  );
}
