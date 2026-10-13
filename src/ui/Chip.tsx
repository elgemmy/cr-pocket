import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';
import { springSnappy } from './motion';

export interface ChipProps {
  label: ReactNode;
  active?: boolean;
  onClick?: () => void;
  /** Unique id for the animated active pill (shared layoutId within a ChipScroller). */
  layoutKey?: string;
  icon?: ReactNode;
  count?: number;
  className?: string;
}

/** A filter/category chip. Use inside ChipScroller for the animated active pill. */
export function Chip({ label, active = false, onClick, layoutKey, icon, count, className }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-150',
        active ? 'text-white' : 'border border-white/10 bg-white/5 text-ink-dim hover:bg-white/10 hover:text-ink',
        className,
      )}
    >
      {active && layoutKey && (
        <motion.span
          layoutId={layoutKey}
          transition={springSnappy}
          className="lip absolute inset-0 rounded-full bg-gradient-to-b from-royal-400 via-royal-500 to-royal-600 [--lip-color:var(--color-royal-800)]"
          aria-hidden
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-1.5">
        {icon && <span className="inline-flex [&>svg]:size-4" aria-hidden>{icon}</span>}
        {label}
        {count != null && (
          <span className={cn('rounded-full px-1.5 text-xs font-bold tabular-nums', active ? 'bg-black/25' : 'bg-white/10 text-ink-faint')}>
            {count}
          </span>
        )}
      </span>
    </button>
  );
}

export interface ChipScrollerProps {
  children: ReactNode;
  /** Optional trailing action (e.g. "+ New category"). */
  trailing?: ReactNode;
  className?: string;
  'aria-label'?: string;
}

/** Horizontally scrollable chip row with edge fade. Children should be Chips. */
export function ChipScroller({ children, trailing, className, 'aria-label': ariaLabel }: ChipScrollerProps) {
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className={cn(
        'no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1',
        '[mask-image:linear-gradient(90deg,transparent,black_16px,black_calc(100%-16px),transparent)]',
        className,
      )}
    >
      {children}
      {trailing}
    </div>
  );
}

/** "+ New" style trailing chip for ChipScroller. */
export function NewChip({ label = 'New', onClick }: { label?: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full border border-dashed border-royal-400/50 px-4 text-sm font-semibold text-royal-300 transition-colors hover:border-royal-400 hover:bg-royal-500/15 hover:text-royal-200"
    >
      <Plus className="size-4" aria-hidden />
      {label}
    </button>
  );
}
