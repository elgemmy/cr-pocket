/**
 * Clash Royale player tag handling. Tags are public, unverified identifiers (e.g. "#C0G20PR2").
 * The canonical normalizer lives in shared/ so the client and Pages Functions never disagree.
 */
import { normalizeTag, TAG_CHARS } from '@shared/normalize';

export { normalizeTag };

export const TAG_CHARSET = TAG_CHARS;
export const TAG_MIN_LENGTH = 3;
export const TAG_MAX_LENGTH = 14;

/** True when input can be normalized to a plausible tag (with or without '#'). */
export function isValidTag(input: string | null | undefined): boolean {
  return normalizeTag(input) !== null;
}

/** URL-encoded tag for API path segments, e.g. "%23C0G20PR2". Null for invalid input. */
export function tagForUrl(input: string | null | undefined): string | null {
  const tag = normalizeTag(input);
  return tag === null ? null : encodeURIComponent(tag);
}
