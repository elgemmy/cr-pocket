import { useMemo } from 'react';
import { motion } from 'motion/react';
import { BookmarkPlus, Check, ExternalLink, Shield } from 'lucide-react';
import type { PlayedDeck } from '@shared/types';
import { useCardContext, playedPreviewCards } from '@/features/common/cards';
import { useLibrary } from '@/data/libraryStore';
import { deckFromPlayed, findDuplicate } from '@/domain/deck';
import type { Deck, DeckSource, SlotForm } from '@/domain/types';
import { AvgElixir, Badge, Button, DeckPreviewStrip } from '@/ui';
import { listItem } from '@/ui/motion';
import { playedAvgElixir, playedMeta, suggestDeckName } from './playerView';

export interface PlayerDeckCardProps {
  played: PlayedDeck;
  context: 'current' | 'recent';
  playerTag: string;
  playerName: string;
  /** Open the SaveDeckSheet with a ready-to-save private copy. */
  onSave: (draft: Deck, needsFormReview: boolean) => void;
  /** Open the OpenInClashRoyaleSheet with the converted deck. */
  onOpenInCR: (deck: Deck) => void;
}

type ActiveForm = Exclude<SlotForm, 'base'>;
const FORM_BADGE_TONE = { evo: 'violet', hero: 'gold', champion: 'gold' } as const;
const FORM_BADGE_LABEL: Record<ActiveForm, string> = { evo: 'Evo', hero: 'Hero', champion: 'Champion' };

/**
 * One observed deck of a browsed player (current deck or a recent battle).
 * Card levels shown are the SIGNED-IN user's own levels (their saved tag),
 * never the browsed player's — the page says so next to the section titles.
 * Evo/Hero/Champion badges show the forms the player actually had active.
 */
export function PlayerDeckCard({ played, context, playerTag, playerName, onSave, onOpenInCR }: PlayerDeckCardProps) {
  const ctx = useCardContext();
  const decks = useLibrary((s) => s.decks);

  const preview = useMemo(() => playedPreviewCards(played, ctx), [played, ctx]);

  // The save/open draft is derived eagerly so the "Already saved" badge and both
  // actions share one conversion. Ids/timestamps are refreshed at save time.
  const draft = useMemo(() => {
    const source: DeckSource = { kind: 'player', playerTag, playerName, context };
    if (played.playedAt) source.playedAt = played.playedAt;
    const result = deckFromPlayed(played, ctx.lookup, source);
    result.deck.name = suggestDeckName(
      played.cards.map((c) => c.id),
      ctx.lookup,
      playerName,
    );
    return result;
  }, [played, ctx.lookup, playerTag, playerName, context]);

  const savedCopy = useMemo(() => findDuplicate(decks, draft.deck), [decks, draft.deck]);
  const avg = useMemo(() => playedAvgElixir(played, ctx.lookup), [played, ctx.lookup]);

  const towerLabel =
    played.towerTroopId == null ? null : (ctx.towerLookup(played.towerTroopId)?.name ?? `#${played.towerTroopId}`);

  const formBadges = preview
    .map((p) => ({
      form: (p.form ?? 'base') as SlotForm,
      name: p.card?.name ?? (p.unknownId != null ? `#${p.unknownId}` : 'Unknown card'),
    }))
    .filter((b): b is { form: ActiveForm; name: string } => b.form !== 'base');

  const meta = context === 'current' ? 'In use right now' : playedMeta(played, Date.now());

  return (
    <motion.article
      variants={listItem}
      className="surface flex h-full flex-col gap-3 p-4"
      aria-label={`${playerName ? `${playerName}'s` : 'Player'} deck${meta ? ` — ${meta}` : ''}`}
    >
      <div className="flex min-h-7 items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink-faint">{meta}</p>
        <div className="flex items-center gap-2">
          {savedCopy && (
            <Badge tone="good" icon={<Check />}>
              Already saved
            </Badge>
          )}
          <AvgElixir value={avg} />
        </div>
      </div>

      <DeckPreviewStrip cards={preview} />

      {(towerLabel != null || formBadges.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {towerLabel != null && (
            <Badge tone="neutral" icon={<Shield />}>
              {towerLabel}
            </Badge>
          )}
          {formBadges.map((b, i) => (
            <Badge key={`${b.form}-${b.name}-${i}`} tone={FORM_BADGE_TONE[b.form]}>
              {FORM_BADGE_LABEL[b.form]} {b.name}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-auto flex gap-2 pt-1">
        <Button
          variant="violet"
          fullWidth
          icon={<BookmarkPlus />}
          onClick={() => onSave(draft.deck, draft.needsFormReview)}
        >
          Save to My Decks
        </Button>
        <Button variant="ghost" icon={<ExternalLink />} onClick={() => onOpenInCR(draft.deck)}>
          Open in CR
        </Button>
      </div>
    </motion.article>
  );
}
