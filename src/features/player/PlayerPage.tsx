import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import {
  Copy,
  Crown,
  MapPin,
  RefreshCw,
  Search,
  Shield,
  Star,
  Swords,
  TriangleAlert,
  Trophy,
  User,
  WifiOff,
  X,
} from 'lucide-react';
import { deckSignature as playedDeckSignature, normalizeTag } from '@shared/normalize';
import type { ApiErrorCode, PlayerSummary } from '@shared/types';
import { gameApiMode } from '@/config';
import { DEMO_TAGS, GameApiError } from '@/game/api';
import { usePlayerLookup } from '@/game/usePlayerLookup';
import { useLibrary } from '@/data/libraryStore';
import type { Deck } from '@/domain/types';
import { Badge, Button, DeckTileSkeleton, EmptyState, Skeleton, cn, toast } from '@/ui';
import { listStagger, springSoft } from '@/ui/motion';
import { SaveDeckSheet } from '@/features/save/SaveDeckSheet';
import { OpenInClashRoyaleSheet } from '@/features/share/OpenInClashRoyaleSheet';
import { useRecentSearches, type RecentSearch } from './recentSearches';
import { hideCurrentDupes } from './playerView';
import { PlayerDeckCard } from './PlayerDeckCard';

const DEMO_PLAYERS: ReadonlyArray<readonly [string, string]> = [
  ['Clara', DEMO_TAGS.varied],
  ['Maximus', DEMO_TAGS.maxed],
  ['Nadia', DEMO_TAGS.newbie],
];

/** F2 — Find a player: tag search + Current Deck + Recently Played Decks. */
export default function PlayerPage() {
  const { tag: rawTag } = useParams();
  const navigate = useNavigate();
  const myTag = useLibrary((s) => s.profile.playerTag);

  const param = rawTag ?? null;
  const normalized = param ? normalizeTag(param) : null;
  const invalidParam = param != null && normalized === null;
  const lookup = usePlayerLookup(invalidParam ? null : normalized);
  const { status, profile, battleDecks, error, reload } = lookup;

  const { items: recentItems, remember, remove } = useRecentSearches();

  const [saveTarget, setSaveTarget] = useState<{ draft: Deck; needsFormReview: boolean } | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [crDeck, setCrDeck] = useState<Deck | null>(null);
  const [crOpen, setCrOpen] = useState(false);

  const goToTag = (tag: string) => navigate(`/player/${tag.replace(/^#/, '')}`);

  // Remember successful lookups for one-tap re-search.
  useEffect(() => {
    if (status === 'ready' && profile) remember(profile.summary.tag, profile.summary.name);
  }, [status, profile, remember]);

  const recentDecks = useMemo(
    () => hideCurrentDupes(battleDecks?.decks ?? [], profile?.currentDeck ?? null),
    [battleDecks, profile],
  );

  const openSave = (draft: Deck, needsFormReview: boolean) => {
    setSaveTarget({ draft, needsFormReview });
    setSaveOpen(true);
  };
  const openInCR = (deck: Deck) => {
    setCrDeck(deck);
    setCrOpen(true);
  };

  const skipped = battleDecks?.skipped ?? 0;

  return (
    <div>
      <header>
        <h1 className="font-display text-2xl text-ink">Find a player</h1>
        <p className="mt-1 text-sm text-ink-dim">
          Peek at anyone's current and recently played decks — then save a copy to your shelf.
        </p>
      </header>

      <TagSearchForm key={normalized ?? 'empty'} initialValue={normalized?.slice(1) ?? ''} onSearch={goToTag} />

      <QuickChips
        recent={recentItems}
        myTag={myTag}
        showDemo={param == null && gameApiMode === 'demo'}
        onPick={goToTag}
        onRemove={remove}
      />

      {invalidParam && (
        <LookupErrorPanel
          error={new GameApiError('bad_tag', `"${param}" is not a valid player tag.`)}
          onRetry={() => navigate('/player')}
          retryLabel="Clear"
        />
      )}

      {!invalidParam && status === 'loading' && <PlayerSkeleton />}

      {!invalidParam && status === 'error' && error && <LookupErrorPanel error={error} onRetry={reload} />}

      {!invalidParam && status === 'idle' && (
        <EmptyState
          illustration={<Swords />}
          title="Who are we scouting?"
          body="Search a public player tag above. Tags look like #2CJV0LY8P and never need a login."
        />
      )}

      {status === 'ready' && profile && (
        <>
          <ProfileHeader summary={profile.summary} />
          <p className="mt-2 px-1 text-xs text-ink-faint">
            Card levels, where shown, come from your own saved tag — never theirs.
          </p>

          <section aria-labelledby="current-deck-heading" className="mt-7">
            <h2 id="current-deck-heading" className="font-display text-xl text-ink">
              Current deck
            </h2>
            <div className="mt-3">
              {profile.currentDeck ? (
                <PlayerDeckCard
                  played={profile.currentDeck}
                  context="current"
                  playerTag={profile.summary.tag}
                  playerName={profile.summary.name}
                  onSave={openSave}
                  onOpenInCR={openInCR}
                />
              ) : (
                <div className="surface p-6 text-center">
                  <p className="font-display text-lg text-ink">No complete current deck to show</p>
                  <p className="mx-auto mt-1 max-w-xs text-sm text-ink-dim">
                    {profile.summary.name || 'This player'} doesn't have a full eight-card deck equipped right
                    now.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section aria-labelledby="recent-decks-heading" className="mt-8">
            <h2 id="recent-decks-heading" className="font-display text-xl text-ink">
              Recently played decks
            </h2>
            <p className="mt-0.5 text-sm text-ink-dim">
              From their recent battles — not all of their saved deck slots.
            </p>
            {recentDecks.length > 0 ? (
              <motion.div
                variants={listStagger}
                initial="initial"
                animate="animate"
                className="mt-4 grid gap-4 md:grid-cols-2"
              >
                {recentDecks.map((d) => (
                  <PlayerDeckCard
                    key={playedDeckSignature(d.cards, d.towerTroopId)}
                    played={d}
                    context="recent"
                    playerTag={profile.summary.tag}
                    playerName={profile.summary.name}
                    onSave={openSave}
                    onOpenInCR={openInCR}
                  />
                ))}
              </motion.div>
            ) : (
              <div className="surface mt-4 p-5 text-sm text-ink-dim">
                {(battleDecks?.decks.length ?? 0) === 0
                  ? 'No complete eight-card decks found in their recent battles.'
                  : 'Their recent battles all used the current deck — nothing else to show.'}
              </div>
            )}
            {skipped > 0 && (
              <p className="mt-3 text-xs text-ink-faint">
                {skipped} {skipped === 1 ? 'battle' : 'battles'} skipped — unsupported modes.
              </p>
            )}
          </section>
        </>
      )}

      <SaveDeckSheet
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        draft={saveTarget?.draft ?? null}
        needsFormReview={saveTarget?.needsFormReview ?? false}
      />
      <OpenInClashRoyaleSheet open={crOpen} onClose={() => setCrOpen(false)} deck={crDeck} />
    </div>
  );
}

/* ------------------------------ tag search ------------------------------- */

function TagSearchForm({ initialValue, onSearch }: { initialValue: string; onSearch: (tag: string) => void }) {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();
  const invalid = trimmed !== '' && normalizeTag(trimmed) === null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const tag = normalizeTag(trimmed);
    if (tag) onSearch(tag);
  };

  return (
    <form role="search" onSubmit={submit} className="mt-4">
      <div
        className={cn(
          'flex min-h-13 items-center gap-2 rounded-2xl border bg-night-950/70 p-1.5 pl-2 transition-colors',
          'focus-within:shadow-[0_0_0_3px_rgb(109_92_255/0.25)]',
          invalid ? 'border-bad-400/60' : 'border-white/10 focus-within:border-royal-400/70',
        )}
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-royal-500/25 font-display text-lg text-royal-200"
          aria-hidden
        >
          #
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Player tag, e.g. 2CJV0LY8P"
          aria-label="Clash Royale player tag"
          aria-invalid={invalid || undefined}
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={16}
          className="min-w-0 flex-1 bg-transparent font-display text-lg tracking-wider text-ink uppercase placeholder:font-sans placeholder:text-sm placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-faint focus:outline-none"
        />
        <Button type="submit" variant="gold" icon={<Search />} disabled={trimmed === '' || invalid}>
          Search
        </Button>
      </div>
      {invalid && (
        <p role="alert" className="mt-2 text-sm text-bad-300">
          Tags only use the characters 0, 2, 8, 9, P, Y, L, Q, G, R, J, C, U, V.
        </p>
      )}
    </form>
  );
}

/* ------------------------------ quick chips ------------------------------ */

const chipClass =
  'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-ink-dim transition-colors hover:bg-white/10 hover:text-ink';

function QuickChips({
  recent,
  myTag,
  showDemo,
  onPick,
  onRemove,
}: {
  recent: RecentSearch[];
  myTag: string | null;
  showDemo: boolean;
  onPick: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const entries = recent.filter((e) => e.tag !== myTag);
  const covered = new Set([myTag, ...entries.map((e) => e.tag)]);
  const demoSuggestions = showDemo ? DEMO_PLAYERS.filter(([, tag]) => !covered.has(tag)) : [];
  if (!myTag && entries.length === 0 && demoSuggestions.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {myTag && (
        <button type="button" onClick={() => onPick(myTag)} className={cn(chipClass, 'border-gold-400/30')}>
          <User className="size-4 text-gold-300" aria-hidden />
          My profile
          <span className="text-xs text-ink-faint">{myTag}</span>
        </button>
      )}
      {entries.map((e) => (
        <span
          key={e.tag}
          className="inline-flex h-10 items-center rounded-full border border-white/10 bg-white/5 pr-1 pl-4 text-sm"
        >
          <button type="button" onClick={() => onPick(e.tag)} className="flex h-full items-center gap-1.5">
            {e.name && <span className="font-semibold text-ink">{e.name}</span>}
            <span className={e.name ? 'text-xs text-ink-faint' : 'font-semibold text-ink'}>{e.tag}</span>
          </button>
          <button
            type="button"
            aria-label={`Remove ${e.name || e.tag} from recent searches`}
            onClick={() => onRemove(e.tag)}
            className="ml-1 inline-flex size-8 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-white/10 hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      {demoSuggestions.map(([name, tag]) => (
          <button key={tag} type="button" onClick={() => onPick(tag)} className={chipClass}>
            <Swords className="size-4 text-royal-300" aria-hidden />
            {name}
            <span className="text-xs text-ink-faint">{tag}</span>
          </button>
        ))}
    </div>
  );
}

/* ----------------------------- profile header ---------------------------- */

function ProfileHeader({ summary }: { summary: PlayerSummary }) {
  const copyTag = async () => {
    try {
      await navigator.clipboard.writeText(summary.tag);
      toast.success('Player tag copied');
    } catch {
      toast.error('Copy failed — long-press the tag to copy it.');
    }
  };

  const stats: { icon: ReactNode; label: string }[] = [];
  if (summary.trophies != null) stats.push({ icon: <Trophy />, label: summary.trophies.toLocaleString() });
  if (summary.bestTrophies != null)
    stats.push({ icon: <Star />, label: `Best ${summary.bestTrophies.toLocaleString()}` });
  if (summary.arena) stats.push({ icon: <MapPin />, label: summary.arena });
  if (summary.expLevel != null && summary.expLevel > 0)
    stats.push({ icon: <Crown />, label: `Level ${summary.expLevel}` });
  if (summary.clan) stats.push({ icon: <Shield />, label: summary.clan.name });

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className="surface mt-6 p-5"
      aria-label="Player profile"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="font-display text-2xl text-ink">{summary.name || 'Unknown player'}</h2>
        <button
          type="button"
          onClick={() => void copyTag()}
          aria-label={`Copy player tag ${summary.tag}`}
          title="Copy tag"
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/10 bg-night-950/70 px-3.5 text-sm font-bold text-ink-dim transition-colors hover:bg-white/10 hover:text-ink"
        >
          {summary.tag}
          <Copy className="size-3.5" aria-hidden />
        </button>
      </div>
      {stats.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {stats.map((s) => (
            <Badge key={s.label} tone="neutral" icon={s.icon}>
              {s.label}
            </Badge>
          ))}
        </div>
      )}
    </motion.section>
  );
}

/* --------------------------- loading / errors ---------------------------- */

function PlayerSkeleton() {
  return (
    <div className="mt-6" aria-busy="true">
      <span className="sr-only">Looking up player…</span>
      <div className="surface p-5" aria-hidden>
        <Skeleton className="h-7 w-44" />
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2" aria-hidden>
        <DeckTileSkeleton />
        <DeckTileSkeleton />
      </div>
    </div>
  );
}

const ERROR_COPY: Record<ApiErrorCode, { title: string; body: string }> = {
  bad_tag: {
    title: "That tag doesn't look right",
    body: 'Player tags only use the characters 0, 2, 8, 9, P, Y, L, Q, G, R, J, C, U, V — check for typos.',
  },
  not_found: {
    title: 'No player found',
    body: 'Nobody answers to that tag. Double-check the spelling and try again.',
  },
  rate_limited: {
    title: 'Too many lookups',
    body: 'Try again in a minute.',
  },
  upstream: {
    title: 'The game servers are having a wobble',
    body: 'The Clash Royale API failed to respond. Your saved decks still work — try again shortly.',
  },
  not_configured: {
    title: 'Player lookup not configured',
    body: "Player lookup isn't configured on this server yet.",
  },
  offline: {
    title: "You're offline",
    body: 'Player lookup needs a connection. Your saved decks still work.',
  },
};

function LookupErrorPanel({
  error,
  onRetry,
  retryLabel = 'Retry',
}: {
  error: GameApiError;
  onRetry: () => void;
  retryLabel?: string;
}) {
  const copy = ERROR_COPY[error.code] ?? ERROR_COPY.upstream;
  const Icon = error.code === 'offline' ? WifiOff : TriangleAlert;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className="surface mt-6 flex flex-col items-center gap-2 p-6 text-center"
      role="alert"
    >
      <div className="flex size-12 items-center justify-center rounded-2xl border border-white/8 bg-night-800 text-bad-300">
        <Icon className="size-6" aria-hidden />
      </div>
      <h2 className="font-display text-lg text-ink">{copy.title}</h2>
      <p className="max-w-sm text-sm text-ink-dim">{copy.body}</p>
      <Button variant="violet" className="mt-2" icon={<RefreshCw />} onClick={onRetry}>
        {retryLabel}
      </Button>
    </motion.div>
  );
}
