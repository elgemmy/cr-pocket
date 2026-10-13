import { Settings } from 'lucide-react';
import { EmptyState } from '@/ui/EmptyState';
import { Disclaimer } from '@/ui/Disclaimer';

/**
 * F1/F7 — Settings (player tag, sign-out, export). STUB.
 */
export default function SettingsPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Settings</h1>
      <EmptyState
        illustration={<Settings />}
        title="Settings coming soon"
        body="Player tag, sync details, JSON export, and sign-out will live here."
      />
      <Disclaimer className="mt-10" />
    </div>
  );
}
