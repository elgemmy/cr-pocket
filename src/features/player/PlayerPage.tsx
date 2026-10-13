import { useParams } from 'react-router';
import { Swords } from 'lucide-react';
import { EmptyState } from '@/ui/EmptyState';

/**
 * F2 — Player search (Current Deck + Recently Played Decks). STUB.
 * Uses SearchField mode="player", PlayerSummary header, DeckPreviewStrip rows.
 */
export default function PlayerPage() {
  const { tag } = useParams();
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">{tag ? `Player ${tag}` : 'Find a player'}</h1>
      <EmptyState
        illustration={<Swords />}
        title="Player search coming soon"
        body="Search any public player tag to peek at their current and recently played decks — then save a copy."
      />
    </div>
  );
}
