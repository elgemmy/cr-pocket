/**
 * CR Pocket motion presets (motion/react).
 * Rules: everything ≤250ms, springs over long easings, never block actions.
 * Wrap the app in <MotionConfig reducedMotion="user"> so all of these
 * degrade automatically when the user prefers reduced motion.
 */
import type { Transition, Variants } from 'motion/react';

/** Snappy spring for presses, chips, small UI. */
export const springSnappy: Transition = { type: 'spring', stiffness: 500, damping: 34, mass: 0.8 };

/** Soft spring for sheets, cards, layout moves. */
export const springSoft: Transition = { type: 'spring', stiffness: 320, damping: 30, mass: 0.9 };

/** Quick fade/slide for overlays. */
export const fadeFast: Transition = { duration: 0.16, ease: 'easeOut' };

/** Page transition (used with AnimatePresence around routed content). */
export const pageTransition: Transition = { duration: 0.18, ease: [0.25, 0.8, 0.35, 1] };

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

/** Staggered list container + item (library grids, search results). */
export const listStagger: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};

export const listItem: Variants = {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: springSoft },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.12 } },
};

/** Tap squash / hover lift for interactive cards and tiles. */
export const tapSquash = { scale: 0.94, y: 1 } as const;
export const hoverLift = { y: -3, scale: 1.02 } as const;

/** Sheet (bottom sheet / dialog) entrance. */
export const sheetVariants: Variants = {
  initial: { opacity: 0, y: 48, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: springSoft },
  exit: { opacity: 0, y: 32, scale: 0.98, transition: { duration: 0.14, ease: 'easeIn' } },
};

export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: fadeFast },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};
