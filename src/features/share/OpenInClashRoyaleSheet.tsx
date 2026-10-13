import { useEffect, useMemo, useState } from 'react';
import { Copy, Link2, QrCode, Smartphone, Swords } from 'lucide-react';
import { TOWER_PRINCESS_ID } from '@/domain/deck';
import { buildDeckLink, formsReminder, TOWER_TROOP_LINK_VERIFIED } from '@/domain/link';
import type { Deck } from '@/domain/types';
import { useCardContext } from '@/features/common/cards';
import { Badge, Button, CardArt, cardArtSrc, Sheet, toast } from '@/ui';
import { copyTextToClipboard, deckLinkQrDataUrl, usePreferMobileHandoff } from './shareUtils';

export interface OpenInClashRoyaleSheetProps {
  /** Must be a complete deck; the sheet never builds a link for drafts. */
  deck: Deck | null;
  open: boolean;
  onClose: () => void;
  /** Editor extras: when the working copy has unsaved edits, the primary CTA
   * becomes "Save & open" (saving never depends on the link working). */
  dirty?: boolean;
  onSave?: () => void;
}

/**
 * F6 — Hand off the deck to Clash Royale via the official copy-deck link.
 * Phones: big gold deep-link anchor + copy/QR secondary. Desktop: QR + copy +
 * manual link. Always shows the "set these forms in-game" reminder first —
 * the link cannot carry Evo/Hero/Wild activation.
 */
export function OpenInClashRoyaleSheet({ deck, open, onClose, dirty = false, onSave }: OpenInClashRoyaleSheetProps) {
  const { lookup, towerLookup } = useCardContext();
  const isMobile = usePreferMobileHandoff();

  const link = useMemo(() => (deck && open ? buildDeckLink(deck) : null), [deck, open]);
  const reminders = useMemo(() => (deck && open ? formsReminder(deck, lookup) : []), [deck, open, lookup]);

  const towerNote = useMemo(() => {
    if (!deck || deck.towerTroopId == null || deck.towerTroopId === TOWER_PRINCESS_ID) return null;
    if (TOWER_TROOP_LINK_VERIFIED) return null;
    const name = towerLookup(deck.towerTroopId)?.name ?? `#${deck.towerTroopId}`;
    return `Set your Tower Troop (${name}) in the game — links can't carry it yet.`;
  }, [deck, towerLookup]);

  const [showQr, setShowQr] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [handedOff, setHandedOff] = useState(false);

  // Reset transient state each time the sheet opens.
  useEffect(() => {
    if (open) {
      setHandedOff(false);
      setShowQr(false);
    }
  }, [open]);

  // Generate the QR lazily: always on desktop, on demand on phones.
  const wantQr = open && link != null && (!isMobile || showQr);
  useEffect(() => {
    if (!wantQr || !link) return;
    let alive = true;
    setQrUrl(null);
    deckLinkQrDataUrl(link)
      .then((url) => {
        if (alive) setQrUrl(url);
      })
      .catch(() => {
        if (alive) setQrUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [wantQr, link]);

  const copy = async () => {
    if (!link) return;
    const ok = await copyTextToClipboard(link);
    if (ok) toast.success('Deck link copied!');
    else toast.error('Copy failed — long-press the link text to copy it.');
  };

  const handleOpenTap = () => {
    if (dirty) onSave?.();
    setHandedOff(true);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Open in Clash Royale" className="md:max-w-xl">
      {!deck || !link ? (
        <p className="py-6 text-center text-sm text-ink-dim">
          This deck isn&apos;t ready yet — fill all 8 slots to build a game link.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Post-import form reminder — must be visible BEFORE the handoff. */}
          <section
            aria-label="Set these forms in-game after import"
            className="rounded-2xl border border-royal-400/30 bg-royal-500/10 p-3"
          >
            {reminders.length > 0 || towerNote ? (
              <>
                <p className="mb-2 font-display text-sm tracking-wide text-royal-200">
                  Set these forms in-game after import:
                </p>
                <ul className="space-y-1.5">
                  {reminders.map((r) => {
                    const card = lookup(r.cardId) ?? null;
                    const { src, fallbackSrc } = cardArtSrc(card, r.form);
                    return (
                      <li key={r.position} className="flex items-center gap-2.5">
                        <span aria-hidden className="shrink-0">
                          <CardArt card={card} form={r.form} size="xs" src={src} fallbackSrc={fallbackSrc} unknownId={card ? undefined : r.cardId} />
                        </span>
                        <span className="text-sm font-semibold text-ink">
                          <Badge tone={r.form === 'evo' ? 'elixir' : 'gold'} className="mr-1.5">
                            {r.formLabel}
                          </Badge>
                          {r.cardName}
                          <span className="text-ink-faint"> · {r.roleLabel} slot</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {towerNote && <p className="mt-2 text-xs font-semibold text-ink-dim">{towerNote}</p>}
              </>
            ) : (
              <p className="text-sm font-semibold text-ink-dim">
                No special forms to set — this deck imports as-is.
              </p>
            )}
          </section>

          {dirty && (
            <p className="rounded-2xl border border-gold-400/30 bg-gold-400/10 px-3.5 py-2 text-xs font-semibold text-gold-300">
              You have unsaved changes — the gold button saves first, then opens the game.
            </p>
          )}

          {isMobile ? (
            <>
              {/* Real anchor navigation — no popups, OS hands off to the game. */}
              <a
                href={link}
                onClick={handleOpenTap}
                className="lip inline-flex h-13 min-h-13 items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-b from-gold-300 via-gold-400 to-gold-500 px-7 font-display text-lg tracking-wide text-night-900 [--lip-color:var(--color-gold-600)] transition-[filter] duration-100 hover:brightness-105"
              >
                <Swords className="size-5" aria-hidden />
                {dirty ? 'Save & open in Clash Royale' : 'Open in Clash Royale'}
              </a>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" fullWidth icon={<Copy />} onClick={() => void copy()}>
                  Copy link
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  fullWidth
                  icon={<QrCode />}
                  onClick={() => setShowQr((v) => !v)}
                  aria-expanded={showQr}
                >
                  {showQr ? 'Hide QR' : 'Show QR'}
                </Button>
              </div>
              {showQr && <QrFrame url={qrUrl} />}
            </>
          ) : (
            <>
              <QrFrame url={qrUrl} />
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-ink-faint">Deck link</span>
                <input
                  readOnly
                  value={link}
                  aria-label="Deck link"
                  onFocus={(e) => e.currentTarget.select()}
                  onClick={(e) => e.currentTarget.select()}
                  className="w-full rounded-xl border border-white/10 bg-night-950 px-3 py-2 font-mono text-[0.7rem] break-all text-ink-dim select-all focus:border-royal-400/70 focus:outline-none"
                />
              </label>
              <div className="flex gap-2">
                <Button variant="gold" fullWidth icon={<Copy />} onClick={() => void copy()}>
                  Copy link
                </Button>
                <a
                  href={link}
                  onClick={handleOpenTap}
                  className="inline-flex h-11 min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-5 text-[0.95rem] font-semibold whitespace-nowrap text-ink-dim transition-colors hover:bg-white/10 hover:text-ink"
                >
                  <Link2 className="size-4" aria-hidden />
                  Open link
                </a>
              </div>
            </>
          )}

          {handedOff && (
            <p role="status" className="flex items-center gap-2 text-sm font-bold text-good-400">
              <Smartphone className="size-4 shrink-0" aria-hidden />
              Handed off to Clash Royale — confirm in the game.
            </p>
          )}

          <p className="text-xs leading-relaxed text-ink-faint">
            In the game, choose a deck slot and confirm. If nothing happens, the game may not be
            installed or your browser blocked the link — scan the QR on your phone or copy the link.
          </p>
        </div>
      )}
    </Sheet>
  );
}

/** QR code in a gold-ringed brand frame (white mat so any camera scans it). */
function QrFrame({ url }: { url: string | null }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-tile bg-white p-3 ring-4 ring-gold-400/70 shadow-[0_16px_40px_-16px_rgb(255_200_60/0.4)]">
        {url ? (
          <img src={url} alt="QR code for this deck link" className="size-44 md:size-52" />
        ) : (
          <div className="size-44 animate-pulse rounded-lg bg-night-400/25 md:size-52" aria-hidden />
        )}
      </div>
      <p className="text-xs font-semibold text-ink-faint">Scan with your phone</p>
    </div>
  );
}
