import { Link2 } from 'lucide-react';
import { EmptyState } from '@/ui/EmptyState';

/**
 * F2/F6 — Paste deck link import. STUB: replaced by the import worker.
 * Parses link.clashroyale.com / RoyaleAPI deck URLs into an editor draft.
 */
export default function ImportPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Import a deck</h1>
      <EmptyState
        illustration={<Link2 />}
        title="Paste-link import coming soon"
        body="Drop a deck link from the game, RoyaleAPI, or a YouTube description and it'll land in your editor."
      />
    </div>
  );
}
