import { CloudUpload, CloudOff, Loader2, RefreshCw, TriangleAlert, FlaskConical } from 'lucide-react';
import type { SyncState } from '@/domain/types';
import { cn } from './cn';

export type SyncPillState = SyncState | 'demo';

export interface SyncPillProps {
  state: SyncPillState;
  className?: string;
}

const config: Record<SyncPillState, { label: string; cls: string; icon: typeof RefreshCw; spin?: boolean }> = {
  loading: { label: 'Loading…', cls: 'border-white/10 bg-white/5 text-ink-faint', icon: Loader2, spin: true },
  synced: { label: 'Synced', cls: 'border-good-400/30 bg-good-500/12 text-good-400', icon: RefreshCw },
  pending: { label: 'Waiting to sync', cls: 'border-gold-400/30 bg-gold-400/12 text-gold-300', icon: CloudUpload },
  cached: { label: 'Viewing cached data', cls: 'border-white/12 bg-white/6 text-ink-dim', icon: CloudOff },
  error: { label: 'Sync error', cls: 'border-bad-400/40 bg-bad-500/15 text-bad-300', icon: TriangleAlert },
  demo: { label: 'Demo mode — stored on this device', cls: 'border-royal-400/40 bg-royal-500/15 text-royal-200', icon: FlaskConical },
};

/**
 * Honest sync-state indicator (F7). Compact dot + label pill for the header;
 * the label hides on very small screens and remains in the accessible name.
 */
export function SyncPill({ state, className }: SyncPillProps) {
  const c = config[state];
  const Icon = c.icon;
  return (
    <span
      role="status"
      aria-label={c.label}
      title={c.label}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[0.7rem] font-bold whitespace-nowrap',
        c.cls,
        className,
      )}
    >
      <Icon className={cn('size-3.5', c.spin && 'animate-spin')} aria-hidden />
      <span className="hidden min-[420px]:inline" aria-hidden>
        {c.label}
      </span>
    </span>
  );
}
