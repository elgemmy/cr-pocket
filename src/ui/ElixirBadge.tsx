import type { ReactNode } from 'react';
import { cn } from './cn';

export interface ElixirBadgeProps {
  cost: number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: { drop: 'size-5', text: 'text-[0.65rem]', dot: 'size-2.5' },
  md: { drop: 'size-6', text: 'text-xs', dot: 'size-3' },
  lg: { drop: 'size-7.5', text: 'text-sm', dot: 'size-3.5' },
} as const;

/**
 * Elixir drop badge — teardrop shape, elixir-magenta gradient.
 * Renders a plain "?" drop when the cost is unknown.
 */
export function ElixirBadge({ cost, size = 'md', className }: ElixirBadgeProps) {
  const s = sizes[size];
  return (
    <span
      className={cn('inline-flex items-center justify-center', className)}
      role="img"
      aria-label={cost == null ? 'Unknown elixir cost' : `${cost} elixir`}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-tl-none rounded-tr-full rounded-b-full bg-gradient-to-br from-elixir-300 via-elixir-400 to-elixir-600 shadow-[0_1px_4px_rgb(201_47_194/0.6),0_1px_0_rgb(255_255_255/0.35)_inset]',
          s.drop,
        )}
        style={{ transform: 'rotate(45deg)' }}
        aria-hidden
      >
        <span
          className={cn('font-display leading-none text-white drop-shadow-[0_1px_1px_rgb(0_0_0/0.5)]', s.text)}
          style={{ transform: 'rotate(-45deg) translate(-4%, -4%)' }}
        >
          {cost ?? '?'}
        </span>
      </span>
    </span>
  );
}

export interface AvgElixirProps {
  /** Average cost; null = unknown/partial deck. */
  value: number | null;
  className?: string;
}

/** Pill showing average elixir of a deck, e.g. used on deck tiles. */
export function AvgElixir({ value, className }: AvgElixirProps) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-full border border-elixir-400/40 bg-elixir-500/15 pr-2.5 pl-1.5',
        className,
      )}
      title={value == null ? 'Average elixir unknown' : `Average elixir ${value.toFixed(1)}`}
    >
      <ElixirDropGlyph className="size-3.5 text-elixir-300" />
      <span className="font-display text-sm leading-none text-elixir-200 tabular-nums">
        {value == null ? '—' : value.toFixed(1)}
      </span>
    </span>
  );
}

/** Standalone elixir-drop glyph (for inline use in text/buttons). */
export function ElixirDropGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path
        d="M8 1.2C8 1.2 3 6.4 3 9.8a5 5 0 0 0 10 0C13 6.4 8 1.2 8 1.2Z"
        fill="currentColor"
        stroke="rgb(255 255 255 / 0.35)"
        strokeWidth="0.8"
      />
      <circle cx="6.4" cy="9.6" r="1.3" fill="rgb(255 255 255 / 0.45)" />
    </svg>
  );
}

export function ElixirPill({ children }: { children: ReactNode }) {
  return <span className="text-elixir-200">{children}</span>;
}
