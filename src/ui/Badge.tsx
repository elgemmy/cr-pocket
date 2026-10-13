import type { ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'violet' | 'gold' | 'elixir' | 'teal' | 'neutral' | 'good' | 'bad';

const tones: Record<BadgeTone, string> = {
  violet: 'border-royal-400/40 bg-royal-500/20 text-royal-200',
  gold: 'border-gold-400/40 bg-gold-400/15 text-gold-300',
  elixir: 'border-elixir-400/40 bg-elixir-500/15 text-elixir-200',
  teal: 'border-wild-400/40 bg-wild-400/15 text-wild-300',
  neutral: 'border-white/12 bg-white/8 text-ink-dim',
  good: 'border-good-400/40 bg-good-500/15 text-good-400',
  bad: 'border-bad-400/40 bg-bad-500/15 text-bad-300',
};

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Small labeled pill (categories, meta info, source attribution…). */
export function Badge({ tone = 'neutral', icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[0.7rem] font-bold whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {icon && <span className="inline-flex [&>svg]:size-3" aria-hidden>{icon}</span>}
      {children}
    </span>
  );
}
