import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { BookmarkPlus, Check, ClipboardPaste, Crown, ExternalLink, Link2, Pencil, TriangleAlert } from 'lucide-react';
import { useLibrary } from '@/data/libraryStore';
import { averageElixir, deckSignature, findDuplicate, newId } from '@/domain/deck';
import { parseDeckLink, type ParseDeckLinkError, type ParseDeckLinkResult } from '@/domain/link';
import { FORM_LABELS } from '@/domain/slots';
import { useCardContext, deckPreviewCards } from '@/features/common/cards';
import { SaveDeckSheet } from '@/features/save/SaveDeckSheet';
import { OpenInClashRoyaleSheet } from '@/features/share/OpenInClashRoyaleSheet';
import { suggestDeckName } from '@/features/player/playerView';
import type { Deck } from '@/domain/types';
import { AvgElixir, Badge, Button, DeckPreviewStrip, EmptyState, toast } from '@/ui';
import { springSoft } from '@/ui/motion';
import { draftFromParsedLink } from './importDraft';

/** F2/F5 — Paste-link import: official links, raw deep links, embedded text, RoyaleAPI URLs. */
export default function ImportPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ctx = useCardContext();
  const decks = useLibrary((s) => s.decks);
  const saveDeck = useLibrary((s) => s.saveDeck);

  const [text, setText] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [crOpen, setCrOpen] = useState(false);

  // Share-target style deep link: /import?link=<encoded>
  useEffect(() => {
    const link = searchParams.get('link');
    if (link) setText(link);
  }, [searchParams]);

  // Parse live as the user types/pastes.
  const parsed = useMemo(
    () => (text.trim() ? parseDeckLink(text, { cards: ctx.cards }) : null),
    [text, ctx.cards],
  );

  const draft = useMemo(() => {
    if (!parsed?.ok) return null;
    const result = draftFromParsedLink(parsed.deck, ctx.lookup);
    result.deck.name = suggestDeckName(parsed.deck.cardIds, ctx.lookup);
    return result;
  }, [parsed, ctx.lookup]);

  const dupe = draft ? findDuplicate(decks, draft.deck) : undefined;
  const avg = draft ? averageElixir(draft.deck, ctx.lookup) : null;
  const hasUnknownCards = draft?.deck.slots.some((s) => s.cardId != null && !ctx.lookup(s.cardId)) ?? false;

  const canPaste = typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function';
  const paste = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) setText(clip);
      else toast.info('Clipboard is empty — nothing to paste.');
    } catch {
      toast.info('Clipboard blocked by the browser — paste with Ctrl+V or a long-press.');
    }
  };

  const editFirst = () => {
    if (!draft) return;
    const now = Date.now();
    const copy: Deck = { ...draft.deck, id: newId(), createdAt: now, updatedAt: now };
    saveDeck(copy);
    toast.success('Saved — opening the editor');
    navigate(`/deck/${copy.id}${draft.needsFormReview ? '?review=1' : ''}`);
  };

  const towerTroopId = draft?.deck.towerTroopId ?? null;
  const towerName =
    towerTroopId == null ? 'Tower Princess (default)' : (ctx.towerLookup(towerTroopId)?.name ?? `Unknown tower troop #${towerTroopId}`);
  const activeForms =
    draft?.deck.slots.filter((s) => s.cardId != null && s.form !== 'base') ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <header>
        <h1 className="font-display text-2xl text-ink">Import a deck</h1>
        <p className="mt-1 text-sm text-ink-dim">
          Paste a deck link from the game, RoyaleAPI, or a YouTube description — we'll find it.
        </p>
      </header>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="import-link" className="text-sm font-semibold text-ink-dim">
            Deck link
          </label>
          {canPaste && (
            <Button variant="ghost" size="sm" icon={<ClipboardPaste />} onClick={() => void paste()}>
              Paste
            </Button>
          )}
        </div>
        <textarea
          id="import-link"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          autoFocus
          spellCheck={false}
          placeholder="https://link.clashroyale.com/en/?clashroyale://copyDeck?deck=…"
          className="mt-1.5 w-full resize-y rounded-2xl border border-white/10 bg-night-950/70 px-3.5 py-3 text-sm break-all text-ink placeholder:text-ink-faint focus:border-royal-400/70 focus:shadow-[0_0_0_3px_rgb(109_92_255/0.25)] focus:outline-none"
        />
      </div>

      {parsed && !parsed.ok && <ParseErrorPanel result={parsed} catalogReady={ctx.catalogReady} />}

      {parsed?.ok && draft && (
        <motion.section
          key={deckSignature(draft.deck)}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={springSoft}
          className="surface mt-4 p-4"
          aria-label="Imported deck preview"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="min-w-0 truncate font-display text-lg text-ink">{draft.deck.name}</h2>
            <AvgElixir value={avg} />
          </div>

          <div className="mt-3">
            <DeckPreviewStrip cards={deckPreviewCards(draft.deck, ctx)} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral" icon={<Crown />}>
              {towerName}
            </Badge>
            {activeForms.map((s) => (
              <Badge key={s.position} tone={s.form === 'evo' ? 'violet' : 'gold'}>
                {FORM_LABELS[s.form]} {ctx.lookup(s.cardId as number)?.name ?? `#${s.cardId}`}
              </Badge>
            ))}
            {dupe && (
              <Badge tone="good" icon={<Check />}>
                Already saved as {dupe.name}
              </Badge>
            )}
          </div>

          {hasUnknownCards && (
            <p className="mt-2 text-xs text-ink-faint">
              Some cards aren't in our card catalog yet — they're kept as numbered placeholders, nothing is lost.
            </p>
          )}
          {draft.needsFormReview && (
            <p className="mt-2 text-xs text-gold-300">
              Forms detected, but their slot placement is a best guess — you can review it in the editor after
              saving.
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button variant="gold" fullWidth icon={<BookmarkPlus />} onClick={() => setSaveOpen(true)}>
              Save to My Decks
            </Button>
            <Button variant="violet" fullWidth icon={<ExternalLink />} onClick={() => setCrOpen(true)}>
              Open in CR
            </Button>
            <Button variant="ghost" fullWidth icon={<Pencil />} onClick={editFirst}>
              Edit first
            </Button>
          </div>
        </motion.section>
      )}

      {!parsed && (
        <EmptyState
          illustration={<Link2 />}
          title="Paste a deck link to get started"
          body="Official copy-deck links, bare clashroyale:// links, links hidden inside longer text, and RoyaleAPI deck URLs all work."
        />
      )}

      <div className="surface mt-6 p-4">
        <h2 className="font-display text-base text-ink">Where do I find deck links?</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-dim">
          <li>
            <strong className="text-ink">In Clash Royale:</strong> open a deck and use the share/copy-deck
            option.
          </li>
          <li>
            <strong className="text-ink">RoyaleAPI:</strong> copy the URL of any deck page
            (royaleapi.com/decks/stats/…).
          </li>
          <li>
            <strong className="text-ink">Anywhere else:</strong> paste a whole YouTube description or a friend's
            message — we'll pick the link out.
          </li>
        </ul>
      </div>

      <SaveDeckSheet
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        draft={draft?.deck ?? null}
        needsFormReview={draft?.needsFormReview ?? false}
      />
      <OpenInClashRoyaleSheet open={crOpen} onClose={() => setCrOpen(false)} deck={draft?.deck ?? null} />
    </div>
  );
}

/* ------------------------------ parse errors ----------------------------- */

const PARSE_ERROR_TITLES: Record<ParseDeckLinkError, string> = {
  not_found: 'No deck link found',
  wrong_count: 'Wrong number of cards',
  duplicate: 'A card appears twice',
  unknown_cards: 'Unrecognized cards',
};

const PARSE_ERROR_HINTS: Record<ParseDeckLinkError, string> = {
  not_found:
    'We understand link.clashroyale.com deck links, bare clashroyale://copyDeck links, and RoyaleAPI deck URLs — even inside longer text.',
  wrong_count: 'A Clash Royale deck has exactly 8 cards — this link says otherwise.',
  duplicate: 'Decks need 8 different cards; this link lists one of them twice.',
  unknown_cards: "These cards aren't in the card catalog we have — try again once the catalog has refreshed.",
};

function ParseErrorPanel({
  result,
  catalogReady,
}: {
  result: Extract<ParseDeckLinkResult, { ok: false }>;
  catalogReady: boolean;
}) {
  const catalogMissing = result.error === 'unknown_cards' && !catalogReady;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className="surface mt-4 flex gap-3 p-4"
      role="alert"
    >
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-bad-300" aria-hidden />
      <div className="min-w-0">
        <p className="font-display text-base text-ink">
          {catalogMissing ? 'One moment…' : PARSE_ERROR_TITLES[result.error]}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-dim">
          {catalogMissing
            ? 'Still loading the card catalog needed to read this link.'
            : `${result.message} ${PARSE_ERROR_HINTS[result.error]}`}
        </p>
        {!catalogMissing && result.unknownCards && result.unknownCards.length > 0 && (
          <p className="mt-1 text-sm break-all text-bad-300">{result.unknownCards.join(', ')}</p>
        )}
      </div>
    </motion.div>
  );
}
