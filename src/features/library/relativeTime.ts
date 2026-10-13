/**
 * Compact relative timestamps for deck tiles ("2h ago"). Deterministic
 * (calendar-free buckets) so it stays unit-testable and stable across locales.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function relativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp;
  if (diff < 45_000) return 'just now'; // includes slightly-future clock skew
  if (diff < HOUR) {
    const m = Math.max(1, Math.round(diff / MINUTE));
    return `${m}m ago`;
  }
  if (diff < DAY) {
    const h = Math.round(diff / HOUR);
    return `${h}h ago`;
  }
  if (diff < WEEK) {
    const d = Math.round(diff / DAY);
    return `${d}d ago`;
  }
  const w = Math.round(diff / WEEK);
  return `${w}w ago`;
}
