import { useRef, useState, type ChangeEvent } from 'react';
import { Download, HardDrive, Upload } from 'lucide-react';
import { useAuth } from '@/data/auth';
import { useLibrary } from '@/data/libraryStore';
import { newId } from '@/domain/deck';
import { exportLibraryJson, parseLibraryJson } from '@/domain/export';
import type { SyncState } from '@/domain/types';
import { Button, toast } from '@/ui';

function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const SYNC_EXPLANATIONS: Record<SyncState, string> = {
  loading: 'Loading… — your library is still arriving.',
  synced: 'Synced — everything on this device is confirmed by the server.',
  pending: 'Waiting to sync — a change is saved locally and will reach the server shortly.',
  cached: 'Viewing cached data — you\u2019re seeing the last copy stored on this device (offline).',
  error: 'Sync error — a change failed to save; CR Pocket will keep retrying. Nothing is lost locally.',
};

/** F7 — export/import + an honest explanation of what the sync pill means. */
export function DataCard() {
  const mode = useAuth((s) => s.mode);
  const decks = useLibrary((s) => s.decks);
  const profile = useLibrary((s) => s.profile);
  const sync = useLibrary((s) => s.sync);
  const saveDeck = useLibrary((s) => s.saveDeck);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const exportJson = () => {
    const json = exportLibraryJson(decks, profile);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cr-pocket-decks-${todayStamp()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${decks.length} ${decks.length === 1 ? 'deck' : 'decks'} as JSON`);
  };

  const importJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const result = parseLibraryJson(text);
      if (!result.ok) {
        toast.error(
          result.error === 'invalid_json'
            ? 'That file isn\u2019t valid JSON.'
            : 'That file isn\u2019t a CR Pocket export.',
        );
        return;
      }
      if (result.decks.length === 0) {
        toast.info(
          result.skipped.length > 0
            ? `Nothing to import — ${result.skipped.length} invalid ${result.skipped.length === 1 ? 'entry' : 'entries'} skipped.`
            : 'That export file is empty.',
        );
        return;
      }
      // Always assign NEW ids so an import can never overwrite existing decks (F7).
      const now = Date.now();
      for (const deck of result.decks) {
        saveDeck({ ...deck, id: newId(), createdAt: now, updatedAt: now });
      }
      const skippedNote =
        result.skipped.length > 0 ? `, skipped ${result.skipped.length} invalid` : '';
      toast.success(
        `Imported ${result.decks.length} ${result.decks.length === 1 ? 'deck' : 'decks'}${skippedNote}`,
      );
    } catch {
      toast.error('Couldn\u2019t read that file.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="surface p-4 sm:p-5" aria-labelledby="settings-data">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-royal-500/20 text-royal-300">
          <HardDrive className="size-4.5" aria-hidden />
        </span>
        <h2 id="settings-data" className="font-display text-lg text-ink">
          Your data
        </h2>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button variant="ghost" icon={<Download />} onClick={exportJson} className="sm:flex-1">
          Export my decks (JSON)
        </Button>
        <Button
          variant="ghost"
          icon={<Upload />}
          loading={importing}
          onClick={() => fileRef.current?.click()}
          className="sm:flex-1"
        >
          Import JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Choose a CR Pocket JSON export to import"
          onChange={(e) => void importJson(e)}
        />
      </div>

      <div className="mt-4 rounded-xl border border-white/8 bg-night-950/50 p-3.5">
        <h3 className="text-sm font-bold text-ink">How syncing works</h3>
        {mode === 'demo' ? (
          <p className="mt-1.5 text-sm leading-relaxed text-ink-dim">
            You\u2019re in <strong className="font-semibold text-ink">demo mode</strong>: decks live
            only in this browser\u2019s storage. Set up Firebase to sync across devices for real.
          </p>
        ) : (
          <p className="mt-1.5 text-sm leading-relaxed text-ink-dim">
            Right now:{' '}
            <strong className="font-semibold text-ink">{SYNC_EXPLANATIONS[sync]}</strong>
          </p>
        )}
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-dim">
          <li>Each deck is its own record, so editing one never clobbers another.</li>
          <li>
            If the same deck is edited on two devices at once, the{' '}
            <strong className="font-semibold text-ink">last saved change wins</strong>.
          </li>
          <li>
            Firestore keeps an offline copy on this device so the app works without a connection —
            sign in only on <strong className="font-semibold text-ink">trusted devices</strong>.
          </li>
        </ul>
      </div>
    </section>
  );
}
