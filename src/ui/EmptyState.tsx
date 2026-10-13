import type { ReactNode } from 'react';
import { cn } from './cn';

export interface EmptyStateProps {
  /** Illustration slot — emoji, icon, or a small custom graphic. */
  illustration?: ReactNode;
  title: string;
  body?: ReactNode;
  /** Primary action (usually a Button). */
  action?: ReactNode;
  className?: string;
}

/** Friendly empty state: illustration + title + optional action. */
export function EmptyState({ illustration, title, body, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {illustration && (
        <div className="mb-4 flex size-20 items-center justify-center rounded-3xl border border-white/8 bg-night-800/70 text-4xl shadow-[0_12px_32px_-16px_rgb(0_0_0/0.6)] [&>svg]:size-9 [&>svg]:text-royal-300">
          {illustration}
        </div>
      )}
      <h3 className="font-display text-xl text-ink">{title}</h3>
      {body && <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-dim">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
