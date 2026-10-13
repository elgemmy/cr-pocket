/**
 * Subtle dismissible banner shown while the browser is offline.
 * Reappears on the next offline period (dismissal resets when back online).
 * Decks keep working from the Firestore/local cache — the banner only informs.
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from './online';

export function OfflineBanner() {
  const online = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  // Reset the dismissal whenever connectivity returns so a later offline
  // period informs again.
  useEffect(() => {
    if (online) setDismissed(false);
  }, [online]);

  const show = !online && !dismissed;

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="offline-banner"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0, transition: { duration: 0.14 } }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="overflow-hidden border-b border-gold-400/25 bg-gold-400/10"
        >
          <div
            role="status"
            className="mx-auto flex w-full max-w-6xl items-center gap-2.5 px-4 py-2 text-sm"
          >
            <WifiOff className="size-4 shrink-0 text-gold-300" aria-hidden />
            <p className="min-w-0 flex-1 font-semibold text-gold-200">
              Offline — your decks still work; changes sync when you're back.
            </p>
            <button
              type="button"
              aria-label="Dismiss offline notice"
              onClick={() => setDismissed(true)}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-gold-200/80 transition-colors hover:bg-white/10 hover:text-gold-200"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
