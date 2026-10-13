import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BadgeCheck, X } from 'lucide-react';
import { useLibrary } from '@/data/libraryStore';
import { isValidTag } from '@/domain/tag';
import { Button, IconButton, toast } from '@/ui';

/**
 * F1 — subtle, dismissible "Add your player tag" prompt shown on top of the
 * library until the user saves a tag or dismisses it. The tag is an
 * UNVERIFIED public-game profile preference (levels display only), never
 * proof of ownership — the copy must say so.
 */
export function TagPrompt() {
  const playerTag = useLibrary((s) => s.profile.playerTag);
  const dismissed = useLibrary((s) => s.profile.tagPromptDismissed);
  const setPlayerTag = useLibrary((s) => s.setPlayerTag);
  const dismissTagPrompt = useLibrary((s) => s.dismissTagPrompt);

  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const visible = playerTag === null && !dismissed;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidTag(value)) {
      setError('That doesn\u2019t look like a player tag — e.g. #2CJV0LY8P');
      return;
    }
    setPlayerTag(value);
    toast.success('Player tag saved — your card levels will show up now');
  };

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.section
          key="tag-prompt"
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="overflow-hidden"
          aria-label="Add your player tag"
        >
          <div className="surface relative mb-4 p-4 sm:p-5">
            <IconButton
              aria-label="Dismiss player tag prompt"
              size="sm"
              onClick={() => dismissTagPrompt()}
              className="absolute top-2.5 right-2.5"
            >
              <X aria-hidden />
            </IconButton>
            <div className="flex items-start gap-3 pr-8">
              <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-royal-500/20 text-royal-300">
                <BadgeCheck className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-lg text-ink">Add your player tag</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-dim">
                  See your own card levels on every deck. Your tag is an{' '}
                  <strong className="font-semibold text-ink">unverified public game profile</strong>{' '}
                  preference — it only tells CR Pocket which public collection to read, and is never
                  proof that you own the account.
                </p>
              </div>
            </div>
            <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <label htmlFor="tag-prompt-input" className="sr-only">
                  Clash Royale player tag
                </label>
                <input
                  id="tag-prompt-input"
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
                  aria-describedby={error ? 'tag-prompt-error' : undefined}
                  className="h-11 w-full rounded-xl border border-white/12 bg-night-950/70 px-3.5 text-[0.95rem] font-semibold tracking-wide text-ink uppercase placeholder:font-normal placeholder:normal-case placeholder:text-ink-faint focus:border-royal-400/70 focus:outline-none"
                />
                {error && (
                  <p id="tag-prompt-error" role="alert" className="mt-1.5 text-xs font-semibold text-bad-300">
                    {error}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="violet" size="md" className="flex-1 sm:flex-none">
                  Save tag
                </Button>
                <Button variant="ghost" size="md" onClick={() => dismissTagPrompt()} className="flex-1 sm:flex-none">
                  Not now
                </Button>
              </div>
            </form>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
