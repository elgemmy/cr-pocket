/**
 * Helpers for the "Open in Clash Royale" flow: device detection (deep link on
 * phones, QR/copy on desktop), clipboard with fallback, and lazy QR generation.
 */
import { useSyncExternalStore } from 'react';

export type MediaMatcher = (query: string) => { matches: boolean };

function defaultMatcher(query: string): { matches: boolean } {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { matches: false };
  }
  return window.matchMedia(query);
}

/**
 * True on phones/tablets where tapping the clashroyale deep link is the primary
 * path (coarse pointer AND a small screen). Desktop gets QR + copy instead.
 * Injectable matcher keeps it unit-testable.
 */
export function preferMobileHandoff(match: MediaMatcher = defaultMatcher): boolean {
  return match('(pointer: coarse)').matches && match('(max-width: 767px)').matches;
}

const HANDOFF_QUERIES = ['(pointer: coarse)', '(max-width: 767px)'];

function subscribeHandoff(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mqs = HANDOFF_QUERIES.map((q) => window.matchMedia(q));
  for (const mq of mqs) mq.addEventListener('change', onChange);
  return () => {
    for (const mq of mqs) mq.removeEventListener('change', onChange);
  };
}

/** Reactive preferMobileHandoff for components. */
export function usePreferMobileHandoff(): boolean {
  return useSyncExternalStore(subscribeHandoff, () => preferMobileHandoff(), () => false);
}

/**
 * Copy text with a legacy fallback for browsers without the async clipboard
 * API (or a denied permission). Returns whether the copy succeeded.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the selection-based fallback
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.insetInlineStart = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = typeof document.execCommand === 'function' && document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

const QR_OPTIONS = {
  errorCorrectionLevel: 'M' as const,
  margin: 1,
  width: 320,
  color: { dark: '#14183a', light: '#ffffff' },
};

/**
 * Render the deck link as a QR PNG data URL. `qrcode` is imported lazily so
 * it never lands in the critical editor chunk.
 */
export async function deckLinkQrDataUrl(link: string): Promise<string> {
  const { toDataURL } = await import('qrcode');
  return toDataURL(link, QR_OPTIONS);
}
