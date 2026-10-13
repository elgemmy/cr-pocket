/**
 * Clash Royale player tag handling.
 *
 * Tags are public, unverified identifiers (e.g. "#C0G20PR2"). Supercell tags use a
 * restricted alphabet that excludes easily-confused letters: 0289PYLQGRJCUV
 * (no 1, 3, 4, 5, 6, 7 and only a handful of letters). Observed player tags are
 * typically 8–9 characters; we accept 3–14 to stay lenient with clan/tournament
 * tags and future changes.
 */

/** Official Supercell tag alphabet (no I/O confusion; letter O is not part of it). */
export const TAG_CHARSET = '0289PYLQGRJCUV';
export const TAG_MIN_LENGTH = 3;
export const TAG_MAX_LENGTH = 14;

const TAG_BODY_RE = new RegExp(`^[${TAG_CHARSET}]{${TAG_MIN_LENGTH},${TAG_MAX_LENGTH}}$`);

/**
 * Normalize user input to canonical "#ABC123" form:
 * - trims and strips all whitespace (incl. spaces inside the tag)
 * - optional leading '#'
 * - uppercases
 * - maps letter O/o to digit 0 (the single most common typo; O is not in the charset)
 * Returns null when the result is not a plausible tag.
 */
export function normalizeTag(input: string | null | undefined): string | null {
  if (input == null) return null;
  let body = input.replace(/\s+/g, '');
  if (body.startsWith('#')) body = body.slice(1);
  body = body.toUpperCase().replace(/O/g, '0');
  if (!TAG_BODY_RE.test(body)) return null;
  return `#${body}`;
}

/** True when input can be normalized to a plausible tag (with or without '#'). */
export function isValidTag(input: string | null | undefined): boolean {
  return normalizeTag(input) !== null;
}

/**
 * URL-encoded tag for API path segments, e.g. "%23C0G20PR2"
 * (the official API expects the '#' percent-encoded).
 * Returns null for invalid input.
 */
export function tagForUrl(input: string | null | undefined): string | null {
  const tag = normalizeTag(input);
  return tag === null ? null : encodeURIComponent(tag);
}
