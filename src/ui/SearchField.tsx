import { useId, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Search, X } from 'lucide-react';
import { cn } from './cn';
import { springSnappy } from './motion';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Shared layoutId for the active pill; must be unique per Segmented on the page. */
  layoutKey?: string;
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}

/** Pill segmented control with an animated selection indicator. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  layoutKey,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: SegmentedProps<T>) {
  const autoKey = useId();
  const key = layoutKey ?? `segmented-${autoKey}`;
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-night-950/70 p-1', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap transition-colors',
              size === 'sm' ? 'h-7 px-3 text-xs' : 'h-8 px-3.5 text-sm',
              active ? 'text-white' : 'text-ink-faint hover:text-ink-dim',
            )}
          >
            {active && (
              <motion.span
                layoutId={key}
                transition={springSnappy}
                className="absolute inset-0 rounded-full bg-royal-500 shadow-[0_2px_8px_rgb(109_92_255/0.45)]"
                aria-hidden
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {opt.icon && <span className="inline-flex [&>svg]:size-3.5" aria-hidden>{opt.icon}</span>}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export type SearchMode = 'decks' | 'player';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /**
   * Optional mode toggle ("My decks" | "Player") rendered inside the field,
   * per spec: one search box that switches between personal decks and Search Player.
   */
  mode?: SearchMode;
  onModeChange?: (mode: SearchMode) => void;
  autoFocus?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Search decks or cards…',
  mode,
  onModeChange,
  autoFocus,
  className,
  'aria-label': ariaLabel,
}: SearchFieldProps) {
  const showModes = mode != null && onModeChange != null;
  return (
    <div
      className={cn(
        'flex min-h-12 items-center gap-2 rounded-2xl border border-white/10 bg-night-950/70 px-3.5',
        'transition-colors focus-within:border-royal-400/70 focus-within:shadow-[0_0_0_3px_rgb(109_92_255/0.25)]',
        className,
      )}
    >
      <Search className="size-4.5 shrink-0 text-ink-faint" aria-hidden />
      <input
        type="search"
        role="searchbox"
        aria-label={ariaLabel ?? 'Search'}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={mode === 'player' ? 'Search a player tag…' : placeholder}
        className="min-w-0 flex-1 bg-transparent py-2 text-[0.95rem] text-ink placeholder:text-ink-faint focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-white/10 hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
      {showModes && (
        <Segmented
          size="sm"
          aria-label="Search mode"
          value={mode}
          onChange={onModeChange}
          options={[
            { value: 'decks', label: 'My decks' },
            { value: 'player', label: 'Player' },
          ]}
        />
      )}
    </div>
  );
}
