/**
 * JSON export/import of the user's deck library (portability/backup).
 * The format is versioned and self-describing; import validates every entry
 * and skips (never repairs by guessing) malformed decks.
 */
import { DECK_SIZE } from './slots';
import type { Deck, DeckSlot, DeckSource, SlotForm, UserProfile } from './types';

export const LIBRARY_EXPORT_APP = 'cr-pocket';
export const LIBRARY_EXPORT_SCHEMA = 1;

export interface LibraryExportFile {
  app: typeof LIBRARY_EXPORT_APP;
  schema: typeof LIBRARY_EXPORT_SCHEMA;
  exportedAt: string;
  profile: { playerTag: string | null };
  decks: Deck[];
}

export function exportLibraryJson(decks: Deck[], profile: UserProfile | null): string {
  const file: LibraryExportFile = {
    app: LIBRARY_EXPORT_APP,
    schema: LIBRARY_EXPORT_SCHEMA,
    exportedAt: new Date().toISOString(),
    profile: { playerTag: profile?.playerTag ?? null },
    decks,
  };
  return JSON.stringify(file, null, 2);
}

export interface SkippedEntry {
  index: number;
  reason: string;
}

export interface LibraryImportResult {
  ok: boolean;
  /** null when the top-level shape isn't a CR Pocket export at all. */
  error: 'invalid_json' | 'invalid_shape' | 'wrong_app' | null;
  decks: Deck[];
  profile: { playerTag: string | null } | null;
  skipped: SkippedEntry[];
}

function importFail(error: NonNullable<LibraryImportResult['error']>): LibraryImportResult {
  return { ok: false, error, decks: [], profile: null, skipped: [] };
}

const FORMS: ReadonlySet<string> = new Set<SlotForm>(['base', 'evo', 'hero', 'champion']);
const SOURCE_KINDS: ReadonlySet<string> = new Set(['manual', 'link', 'player']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function sanitizeSlots(raw: unknown): DeckSlot[] | string {
  if (!Array.isArray(raw) || raw.length !== DECK_SIZE) {
    return `slots must be an array of ${DECK_SIZE}`;
  }
  const byPosition = new Map<number, DeckSlot>();
  for (const entry of raw) {
    if (!isRecord(entry)) return 'slot entries must be objects';
    const { position, cardId, form } = entry;
    if (typeof position !== 'number' || !Number.isInteger(position) || position < 0 || position >= DECK_SIZE) {
      return 'slot position must be an integer 0..7';
    }
    if (byPosition.has(position)) return `duplicate slot position ${position}`;
    if (cardId !== null && (typeof cardId !== 'number' || !Number.isInteger(cardId) || cardId <= 0)) {
      return `slot ${position} has an invalid cardId`;
    }
    if (typeof form !== 'string' || !FORMS.has(form)) {
      return `slot ${position} has an invalid form`;
    }
    byPosition.set(position, { position, cardId: cardId as number | null, form: form as SlotForm });
  }
  if (byPosition.size !== DECK_SIZE) return 'slots must cover positions 0..7';

  const slots = Array.from({ length: DECK_SIZE }, (_, i) => byPosition.get(i) as DeckSlot);
  const ids = slots.filter((s) => s.cardId != null).map((s) => s.cardId as number);
  if (new Set(ids).size !== ids.length) return 'deck contains duplicate cards';
  return slots;
}

function sanitizeSource(raw: unknown): DeckSource {
  if (isRecord(raw) && typeof raw['kind'] === 'string' && SOURCE_KINDS.has(raw['kind'])) {
    const source: DeckSource = { kind: raw['kind'] as DeckSource['kind'] };
    if (typeof raw['playerTag'] === 'string') source.playerTag = raw['playerTag'];
    if (typeof raw['playerName'] === 'string') source.playerName = raw['playerName'];
    if (raw['context'] === 'current' || raw['context'] === 'recent') source.context = raw['context'];
    if (typeof raw['playedAt'] === 'string') source.playedAt = raw['playedAt'];
    return source;
  }
  return { kind: 'manual' };
}

function sanitizeDeck(raw: unknown, index: number, now: number): Deck | SkippedEntry {
  if (!isRecord(raw)) return { index, reason: 'entry is not an object' };
  if (raw['schemaVersion'] !== undefined && raw['schemaVersion'] !== 1) {
    return { index, reason: `unsupported schemaVersion ${String(raw['schemaVersion'])}` };
  }
  if (typeof raw['id'] !== 'string' || raw['id'].length === 0) {
    return { index, reason: 'missing deck id' };
  }
  const slots = sanitizeSlots(raw['slots']);
  if (typeof slots === 'string') return { index, reason: slots };

  const towerTroopId = raw['towerTroopId'];
  const categoryIds = Array.isArray(raw['categoryIds'])
    ? raw['categoryIds'].filter((c): c is string => typeof c === 'string')
    : [];
  const createdAt = typeof raw['createdAt'] === 'number' && Number.isFinite(raw['createdAt']) ? raw['createdAt'] : now;
  const updatedAt = typeof raw['updatedAt'] === 'number' && Number.isFinite(raw['updatedAt']) ? raw['updatedAt'] : now;

  return {
    id: raw['id'],
    schemaVersion: 1,
    name: typeof raw['name'] === 'string' && raw['name'].length > 0 ? raw['name'] : 'Imported deck',
    notes: typeof raw['notes'] === 'string' ? raw['notes'] : '',
    favorite: raw['favorite'] === true,
    slots,
    towerTroopId:
      typeof towerTroopId === 'number' && Number.isInteger(towerTroopId) && towerTroopId > 0
        ? towerTroopId
        : null,
    categoryIds,
    source: sanitizeSource(raw['source']),
    createdAt,
    updatedAt,
  };
}

/**
 * Parse an export file. Bad individual decks are skipped with reasons; only a
 * fundamentally wrong file (not JSON, wrong top-level shape, another app's
 * export) fails the whole import.
 */
export function parseLibraryJson(text: string, now: number = Date.now()): LibraryImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return importFail('invalid_json');
  }
  if (!isRecord(data) || !Array.isArray(data['decks'])) {
    return importFail('invalid_shape');
  }
  if (data['app'] !== undefined && data['app'] !== LIBRARY_EXPORT_APP) {
    return importFail('wrong_app');
  }

  let profile: { playerTag: string | null } | null = null;
  if (isRecord(data['profile'])) {
    const tag = data['profile']['playerTag'];
    profile = { playerTag: typeof tag === 'string' ? tag : null };
  }

  const decks: Deck[] = [];
  const skipped: SkippedEntry[] = [];
  (data['decks'] as unknown[]).forEach((entry, index) => {
    const result = sanitizeDeck(entry, index, now);
    if ('reason' in result) skipped.push(result);
    else decks.push(result);
  });

  return { ok: true, error: null, decks, profile, skipped };
}
