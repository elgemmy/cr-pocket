import { useEffect, useState, type FormEvent } from 'react';
import { RefreshCw, Tag, Trash2 } from 'lucide-react';
import { useLibrary } from '@/data/libraryStore';
import { useMyCollection } from '@/game/myCollectionStore';
import { isValidTag } from '@/domain/tag';
import { relativeTime } from '@/features/library/relativeTime';
import { Button, ConfirmDialog, toast } from '@/ui';

/**
 * F1/F4 — save / replace / clear the (unverified, public) player tag, plus the
 * status of the card collection loaded from it (levels shown across the app).
 */
export function PlayerTagCard() {
  const playerTag = useLibrary((s) => s.profile.playerTag);
  const setPlayerTag = useLibrary((s) => s.setPlayerTag);
  const collection = useMyCollection();

  const [value, setValue] = useState(playerTag ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Keep the field in sync when the tag changes elsewhere (e.g. library prompt).
  useEffect(() => {
    setValue(playerTag ?? '');
  }, [playerTag]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidTag(value)) {
      setError('That doesn\u2019t look like a player tag — letters/numbers only, e.g. #2CJV0LY8P');
      return;
    }
    setPlayerTag(value);
    setError(null);
    toast.success('Player tag saved');
  };

  return (
    <section className="surface p-4 sm:p-5" aria-labelledby="settings-tag">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-royal-500/20 text-royal-300">
          <Tag className="size-4.5" aria-hidden />
        </span>
        <h2 id="settings-tag" className="font-display text-lg text-ink">
          Player tag
        </h2>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-dim">
        CR Pocket uses your tag to read your <em>public</em> card collection and show your levels on
        decks. It is an <strong className="font-semibold text-ink">unverified public-game profile</strong>{' '}
        preference — never proof of account ownership, and never used to sign you in.
      </p>

      <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <label htmlFor="settings-tag-input" className="sr-only">
            Clash Royale player tag
          </label>
          <input
            id="settings-tag-input"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder="#2CJV0LY8P"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={error != null}
            aria-describedby={error ? 'settings-tag-error' : undefined}
            className="h-11 w-full rounded-xl border border-white/12 bg-night-950/70 px-3.5 text-[0.95rem] font-semibold tracking-wide text-ink uppercase placeholder:font-normal placeholder:normal-case placeholder:text-ink-faint focus:border-royal-400/70 focus:outline-none"
          />
          {error && (
            <p id="settings-tag-error" role="alert" className="mt-1.5 text-xs font-semibold text-bad-300">
              {error}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="violet" className="flex-1 sm:flex-none">
            {playerTag ? 'Replace tag' : 'Save tag'}
          </Button>
          {playerTag && (
            <Button variant="ghost" icon={<Trash2 />} onClick={() => setConfirmClear(true)} className="flex-1 sm:flex-none">
              Clear
            </Button>
          )}
        </div>
      </form>

      {/* Collection status (F4: levels come from this lookup) */}
      {playerTag && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-night-950/50 px-3.5 py-2.5 text-sm">
          <span className="font-bold tracking-wide text-ink">{playerTag}</span>
          <span className="text-ink-faint" aria-hidden>
            ·
          </span>
          {collection.status === 'loading' && <span className="text-ink-dim">Loading your collection…</span>}
          {collection.status === 'ready' && (
            <span className="text-ink-dim">
              Collection ready{collection.updatedAt ? ` · updated ${relativeTime(collection.updatedAt)}` : ''}
            </span>
          )}
          {collection.status === 'error' && (
            <span className="text-bad-300">{collection.error ?? 'Collection lookup failed'}</span>
          )}
          {collection.status === 'idle' && <span className="text-ink-dim">Collection not loaded yet</span>}
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw />}
            loading={collection.status === 'loading'}
            onClick={() => void collection.refresh()}
            className="ml-auto"
          >
            Refresh collection
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          setPlayerTag(null);
          setValue('');
          toast.info('Player tag cleared — card levels are hidden until you add one');
        }}
        title="Clear your player tag?"
        body="Your decks stay put, but card levels and owned-form indicators disappear until you save a tag again."
        confirmLabel="Clear tag"
        tone="danger"
      />
    </section>
  );
}
