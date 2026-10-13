import { HeroScene } from '@/scene3d';

/**
 * Decorative hero for the library's brand-new-user empty state. HeroScene lazy-loads the
 * optional Three.js scene and otherwise renders the CSS card stack, so it never blocks.
 */
export function LibraryHeroSlot() {
  return (
    // Cropped on small screens so the empty-state actions stay above the fold.
    <div className="mx-auto -mt-2 max-h-28 w-full overflow-clip sm:max-h-none">
      <HeroScene variant="empty" />
    </div>
  );
}
