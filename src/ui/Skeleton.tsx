import type { CSSProperties } from 'react';
import { cn } from './cn';

export interface SkeletonProps {
  className?: string;
  /** Optional explicit size helpers. */
  width?: number | string;
  height?: number | string;
  /** Circle instead of rounded rect. */
  circle?: boolean;
  style?: CSSProperties;
}

/**
 * Shimmer placeholder. Reduced-motion users get a static block
 * (the shimmer keyframes are disabled in index.css).
 */
export function Skeleton({ className, width, height, circle, style }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn('shimmer bg-night-700/60', circle ? 'rounded-full' : 'rounded-xl', className)}
      style={{ width, height, ...style }}
    />
  );
}

/** Prebuilt skeleton for a deck tile in the library grid. */
export function DeckTileSkeleton() {
  return (
    <div className="surface p-4" aria-hidden>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <div className="mt-3 grid grid-cols-8 gap-1.5">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-[300/358] w-full rounded-lg" />
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-14" />
      </div>
    </div>
  );
}
