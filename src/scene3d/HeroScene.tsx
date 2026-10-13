/**
 * Public entry to the optional decorative 3D hero scene.
 *
 * Rules (spec F8 / design.md §4):
 * - Decorative only — sign-in hero and library empty state; never in the
 *   editor, deck-copy flow, or card grids.
 * - Renders the CSS `CardStackHero` immediately and keeps it permanently when
 *   the device shouldn't run 3D (reduced motion, no WebGL, low-end heuristics)
 *   or when the 3D chunk fails (error boundary).
 * - The three.js chunk starts loading only after first paint/idle AND when the
 *   slot is near the viewport, so it never delays the sign-in button or the
 *   library.
 *
 * Mounting (for the library worker's LibraryHeroSlot):
 *   import { HeroScene } from '@/scene3d';
 *   <HeroScene variant="empty" />   // inside the library empty state
 */
import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { CardStackHero } from '@/ui/CardStackHero';
import { cn } from '@/ui/cn';
import { getDeviceSignals, shouldUse3D } from './capability';

// Separate chunk: three + @react-three/fiber load only when actually mounted.
const LazyHeroScene3D = lazy(() => import('./HeroScene3D'));

export interface HeroSceneProps {
  /** `signin` = full-size landing hero; `empty` = compact empty-state version. */
  variant?: 'signin' | 'empty';
  className?: string;
}

interface BoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

/** Any 3D failure (chunk, WebGL context, texture) → permanent CSS fallback. */
class SceneErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    console.warn('[cr-pocket] 3D hero scene disabled after error:', error);
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Run a callback after first paint / when the main thread is idle. */
function onIdle(callback: () => void): () => void {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    const id = window.requestIdleCallback(callback, { timeout: 1800 });
    return () => window.cancelIdleCallback(id);
  }
  const timer = setTimeout(callback, 300);
  return () => clearTimeout(timer);
}

export function HeroScene({ variant = 'signin', className }: HeroSceneProps) {
  const fallback = <CardStackHero className={variant === 'empty' ? 'scale-[0.72]' : undefined} />;

  // Decide once per session; SSR/unknown environments get the CSS fallback.
  const [capable] = useState(() => typeof window !== 'undefined' && shouldUse3D(getDeviceSignals()));
  const hostRef = useRef<HTMLDivElement>(null);
  const [idle, setIdle] = useState(false);
  const [nearViewport, setNearViewport] = useState(false);
  const [inViewport, setInViewport] = useState(true);

  useEffect(() => {
    if (!capable) return;
    return onIdle(() => setIdle(true));
  }, [capable]);

  useEffect(() => {
    const el = hostRef.current;
    if (!capable || !el || typeof IntersectionObserver === 'undefined') {
      if (capable && typeof IntersectionObserver === 'undefined') setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setNearViewport(entry.isIntersecting);
          setInViewport(entry.isIntersecting);
        }
      },
      // Start loading a bit before it scrolls into view; pause when it leaves.
      { rootMargin: '240px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [capable]);

  const shouldLoad = capable && idle && nearViewport;

  return (
    <div ref={hostRef} className={cn('w-full', className)} aria-hidden>
      {shouldLoad ? (
        <SceneErrorBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <LazyHeroScene3D variant={variant} active={inViewport} />
          </Suspense>
        </SceneErrorBoundary>
      ) : (
        fallback
      )}
    </div>
  );
}
