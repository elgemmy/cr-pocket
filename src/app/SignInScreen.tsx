import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/ui/Button';
import { CardStackHero } from '@/ui/CardStackHero';
import { Disclaimer } from '@/ui/Disclaimer';
import { Wordmark } from './AppLayout';

/** Google "G" mark for the sign-in button. */
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-full" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.2-7-5.1l-3.9 3C3.2 21.3 7.3 24 12 24z" />
      <path fill="#FBBC05" d="M5 14.3c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3l-3.9-3C.4 8.3 0 10.1 0 12s.4 3.7 1.1 5.3l3.9-3z" />
      <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.2 2.7 1.1 6.7l3.9 3c1-2.9 3.8-5 7-5z" />
    </svg>
  );
}

export interface SignInScreenProps {
  onSignIn: () => void;
  loading?: boolean;
  /** Auth error message to show under the button. */
  error?: string | null;
  /** True when running without Firebase config (local demo). */
  demoMode?: boolean;
  /** Optional hero slot — the 3D worker mounts a lazy scene here. Defaults to the CSS card stack. */
  hero?: ReactNode;
}

/**
 * Landing / sign-in. Delightful, single action, no onboarding wizard.
 * Pure UI: auth wiring lives in src/data (another worker); App passes handlers.
 */
export function SignInScreen({ onSignIn, loading, error, demoMode, hero }: SignInScreenProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex w-full max-w-sm flex-col items-center text-center"
      >
        <Wordmark />
        <p className="mt-2 font-display text-lg text-royal-300">More decks. Less deck management.</p>

        <div className="mt-4 w-full">{hero ?? <CardStackHero />}</div>

        <p className="max-w-xs text-sm leading-relaxed text-ink-dim">
          Your unlimited shelf of Clash Royale decks — collect, tweak, and restore them on any device.
        </p>

        <Button
          variant="gold"
          size="lg"
          fullWidth
          className="mt-7 max-w-xs"
          onClick={onSignIn}
          loading={loading}
          icon={<GoogleGlyph />}
        >
          Continue with Google
        </Button>

        {error && (
          <p role="alert" className="mt-3 text-sm font-semibold text-bad-300">
            {error}
          </p>
        )}
        {demoMode && !error && (
          <p className="mt-3 text-xs font-semibold text-royal-300">
            Demo mode — decks are stored on this device only.
          </p>
        )}

        <p className="mt-4 text-xs text-ink-faint">
          One tap, no passwords. Set your player tag later if you want live card levels.
        </p>

        <Disclaimer className="mt-8 max-w-xs" />
      </motion.div>
    </div>
  );
}
