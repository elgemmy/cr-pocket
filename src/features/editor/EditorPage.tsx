import { useParams } from 'react-router';
import { Hammer } from 'lucide-react';
import { EmptyState } from '@/ui/EmptyState';

/**
 * F4/F5 — Deck editor. STUB: replaced by the editor worker.
 * Layout: 8 slot CardArts on top (Evo/Hero/Wild rims), searchable card
 * gallery below, sticky bottom Save bar on mobile.
 */
export default function EditorPage() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">{id ? 'Edit deck' : 'New deck'}</h1>
      <EmptyState
        illustration={<Hammer />}
        title="Editor coming soon"
        body="Eight slots, Evo/Hero/Wild forms, your real card levels, and a sticky gold Save. Hang tight."
      />
    </div>
  );
}
