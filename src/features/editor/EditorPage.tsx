import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { Check, ChevronDown, Copy, Ghost, Sparkles, Swords, X } from 'lucide-react';
import {
  createEmptyDeck,
  duplicateDeck,
  isComplete,
  newId,
  touch,
  averageElixir,
} from '@/domain/deck';
import type { Deck } from '@/domain/types';
import { useLibrary } from '@/data/libraryStore';
import { useMyCollection } from '@/game/myCollectionStore';
import { useCardContext } from '@/features/common/cards';
import { CategoryPicker } from '@/features/library/CategoryPicker';
import { OpenInClashRoyaleSheet } from '@/features/share/OpenInClashRoyaleSheet';
import { AvgElixir, Badge, Button, EmptyState, Skeleton, toast } from '@/ui';
import { CardGallery } from './CardGallery';
import { DeckPanel } from './DeckPanel';
import { SlotMenuSheet } from './SlotMenuSheet';
import { TowerTroopSheet } from './TowerTroopSheet';
import { useDirtyGuard } from './useDirtyGuard';
import {
  clearDraft,
  editorDirty,
  emptySlotCount,
  firstEmptySlot,
  loadDraft,
  prefersReducedMotion,
  reduceEditor,
  saveDraft,
  type EditorAction,
  type EditorState,
} from './editorState';

function EditorSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading deck editor">
      <Skeleton className="h-9 w-56 rounded-xl" />
      <div className="surface mt-4 p-3">
        <Skeleton className="mb-3 h-4 w-32" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-[300/358] w-full rounded-[calc(var(--radius-tile)*0.62)]" />
          ))}
        </div>
      </div>
      <Skeleton className="mt-4 h-12 w-full rounded-2xl" />
    </div>
  );
}

/** F4/F5 — Deck editor: 8 slots (Evo/Hero/Wild + 5), tower troop, searchable gallery, sticky Save. */
export default function EditorPage() {
  const { id } = useParams();
  const routeKey = id ?? 'new';
  const [searchParams] = useSearchParams();
  const showReviewBanner = searchParams.get('review') === '1';
  const location = useLocation();
  const navigate = useNavigate();

  const libStatus = useLibrary((s) => s.status);
  const decks = useLibrary((s) => s.decks);
  const saveDeck = useLibrary((s) => s.saveDeck);
  const ctx = useCardContext();
  const ownedTowerTroops = useMyCollection((s) => s.towerTroops);
  const collectionStatus = useMyCollection((s) => s.status);
  const tag = useMyCollection((s) => s.tag);
  const hasTag = Boolean(tag);
  const hasCollection = Boolean(tag) && collectionStatus === 'ready' && ctx.owned != null;

  // The reducer always sees the freshest catalog lookup.
  const lookupRef = useRef(ctx.lookup);
  lookupRef.current = ctx.lookup;

  const [state, setState] = useState<EditorState | null>(null);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [menuSlot, setMenuSlot] = useState<number | null>(null);
  const [towerOpen, setTowerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const galleryRef = useRef<HTMLElement | null>(null);
  /** True while the working copy came from a restored draft (kept alive even when clean). */
  const draftActiveRef = useRef(false);

  const stored = id ? decks.find((d) => d.id === id) : undefined;
  const seeded = (location.state as { deck?: Deck } | null)?.deck;
  const seededForRoute = seeded && id && seeded.id === id ? seeded : undefined;

  // Initialize once per route: stored deck (or navigation-seeded copy), with an
  // unsaved draft winning only when it is newer than the stored deck.
  useLayoutEffect(() => {
    if (initializedFor === routeKey) return;
    draftActiveRef.current = false;
    if (id) {
      if (libStatus !== 'ready' && !seededForRoute) return; // keep the skeleton
      const base = stored ?? seededForRoute;
      if (!base) {
        setState(null);
        setInitializedFor(routeKey);
        return;
      }
      const draft = loadDraft(routeKey);
      const useDraft = draft != null && draft.savedAt > base.updatedAt;
      setState({ deck: useDraft ? draft.deck : base, baseline: base, initial: base, activeSlot: null, swapSource: null });
      if (useDraft) {
        draftActiveRef.current = true;
        setRestoredDraft(true);
      }
    } else {
      const draft = loadDraft('new');
      const deck = draft?.deck ?? createEmptyDeck(newId(), Date.now());
      setState({ deck, baseline: null, initial: deck, activeSlot: null, swapSource: null });
      if (draft) {
        draftActiveRef.current = true;
        setRestoredDraft(true);
      }
    }
    setInitializedFor(routeKey);
  }, [routeKey, initializedFor, id, libStatus, stored, seededForRoute]);

  useEffect(() => {
    if (restoredDraft) {
      toast.info('Restored your unsaved draft.');
      setRestoredDraft(false);
    }
  }, [restoredDraft]);

  const dirty = state != null && editorDirty(state);

  // Persist the working draft while there is something unsaved (or a restored
  // draft is still being worked on); a clean state means no draft should exist.
  useEffect(() => {
    if (!state || initializedFor !== routeKey) return;
    if (editorDirty(state) || draftActiveRef.current) saveDraft(routeKey, state.deck);
    else clearDraft(routeKey);
  }, [state, initializedFor, routeKey]);

  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 1500);
    return () => clearTimeout(t);
  }, [justSaved]);

  const dispatch = useCallback((action: EditorAction) => {
    setState((cur) => (cur ? reduceEditor(cur, action, lookupRef.current) : cur));
  }, []);

  const guard = useDirtyGuard(
    dirty,
    useCallback(() => {
      draftActiveRef.current = false;
      clearDraft(routeKey);
    }, [routeKey]),
  );

  const complete = state != null && isComplete(state.deck);
  const missing = state ? emptySlotCount(state.deck) : 8;
  const avg = state ? averageElixir(state.deck, ctx.lookup) : null;

  const inDeck = useMemo(() => {
    const set = new Set<number>();
    for (const s of state?.deck.slots ?? []) if (s.cardId != null) set.add(s.cardId);
    return set;
  }, [state?.deck]);

  /* ------------------------------- handlers ------------------------------ */

  const onSlotTap = (position: number) => {
    if (!state) return;
    const slot = state.deck.slots[position];
    const swapping = state.swapSource != null;
    dispatch({ type: 'slotTap', position });
    if (swapping) return;
    if (slot?.cardId != null) {
      setMenuSlot(position);
    } else {
      // Empty slot became active: bring the gallery into view / focus.
      requestAnimationFrame(() => {
        galleryRef.current?.scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'start',
        });
        if (window.matchMedia('(pointer: fine)').matches) {
          galleryRef.current
            ?.querySelector<HTMLInputElement>('input[type="search"]')
            ?.focus({ preventScroll: true });
        }
      });
    }
  };

  const onGalleryTap = (cardId: number) => {
    if (!state) return;
    if (!inDeck.has(cardId) && state.activeSlot == null && firstEmptySlot(state.deck) == null) {
      toast.info('Deck is full — tap a slot to replace its card.');
      return;
    }
    dispatch({ type: 'galleryTap', cardId });
  };

  const handleSave = useCallback(() => {
    if (!state || !isComplete(state.deck)) return;
    const named = state.deck.name.trim() ? state.deck : { ...state.deck, name: 'Untitled deck' };
    const saved = touch(named, Date.now());
    saveDeck(saved);
    draftActiveRef.current = false;
    clearDraft(routeKey);
    setState((cur) => (cur ? { ...cur, deck: saved, baseline: saved, initial: saved } : cur));
    setJustSaved(true);
    toast.success('Deck saved to your shelf!');
    if (!id) {
      guard.allowNextNavigation();
      navigate(`/deck/${saved.id}`, { replace: true, state: { deck: saved } });
    }
  }, [state, id, routeKey, saveDeck, navigate, guard]);

  const handleDuplicate = () => {
    if (!state?.baseline) return;
    const copy = duplicateDeck(touch(state.deck, Date.now()), Date.now());
    saveDeck(copy);
    toast.success('Duplicated — you are editing the copy.');
    guard.allowNextNavigation();
    navigate(`/deck/${copy.id}`, { state: { deck: copy } });
  };

  /* -------------------------------- render ------------------------------- */

  if (initializedFor !== routeKey || (state === null && id && libStatus !== 'ready' && !seededForRoute)) {
    return <EditorSkeleton />;
  }

  if (!state) {
    return (
      <EmptyState
        illustration={<Ghost />}
        title="Deck not found"
        body="This deck may have been deleted on another device, or the link is wrong."
        action={
          <Button variant="violet" onClick={() => navigate('/')}>
            Back to My Decks
          </Button>
        }
      />
    );
  }

  const saveHint = complete
    ? dirty
      ? 'Unsaved changes'
      : 'All changes saved'
    : `Add ${missing} more card${missing === 1 ? '' : 's'}`;

  const saveButtonContent = justSaved ? (
    <motion.span
      key="saved"
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="inline-flex items-center gap-2"
    >
      <Check className="size-5" strokeWidth={3} aria-hidden />
      Saved!
    </motion.span>
  ) : (
    <motion.span key="save" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-2">
      Save deck
    </motion.span>
  );

  return (
    <div className="lg:grid lg:grid-cols-[21rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      {/* Left: slots, stats, tower troop, details, actions (sticky on desktop) */}
      <div className="min-w-0 space-y-4 lg:sticky lg:top-20">
        {showReviewBanner && !reviewDismissed && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-gold-400/30 bg-gold-400/10 px-3.5 py-2.5">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-gold-300" aria-hidden />
            <p className="min-w-0 flex-1 text-sm font-semibold text-gold-200">
              Check which cards are in Evo / Hero / Wild slots — we couldn&apos;t tell from the source.
            </p>
            <button
              type="button"
              onClick={() => setReviewDismissed(true)}
              aria-label="Dismiss"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-gold-300 transition-colors hover:bg-gold-400/20"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        )}

        {!state.baseline ? (
          <Badge tone="neutral">Draft — not saved yet</Badge>
        ) : dirty ? (
          <Badge tone="gold">Unsaved changes</Badge>
        ) : null}

        <DeckPanel
          state={state}
          ctx={ctx}
          hasCollection={hasCollection}
          ownedTowerTroops={ownedTowerTroops}
          onSlotTap={onSlotTap}
          onCancelSwap={() => dispatch({ type: 'armSwap', position: null })}
          onOpenTower={() => setTowerOpen(true)}
          onRename={(name) => dispatch({ type: 'rename', name })}
        />

        {/* Details: notes + categories */}
        <details className="surface group p-4">
          <summary className="flex cursor-pointer items-center justify-between font-display text-sm tracking-wide text-ink-dim select-none">
            Details — notes &amp; categories
            <ChevronDown className="size-4 transition-transform duration-150 group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-ink-faint">Notes</span>
              <textarea
                value={state.deck.notes}
                onChange={(e) => dispatch({ type: 'setNotes', notes: e.target.value })}
                rows={3}
                maxLength={500}
                placeholder="e.g. replace Fireball with Poison vs bait"
                className="w-full resize-none rounded-xl border border-white/10 bg-night-950/70 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-royal-400/70 focus:outline-none"
              />
            </label>
            <div>
              <span className="mb-1 block text-xs font-bold text-ink-faint">Categories</span>
              <CategoryPicker
                value={state.deck.categoryIds}
                onChange={(ids) => dispatch({ type: 'setCategories', ids })}
              />
            </div>
          </div>
        </details>

        {/* Actions */}
        <div className="space-y-2">
          <Button
            variant="violet"
            size="lg"
            fullWidth
            icon={<Swords />}
            disabled={!complete}
            onClick={() => setShareOpen(true)}
          >
            Open in Clash Royale
          </Button>
          {!complete && (
            <p className="text-center text-xs font-semibold text-ink-faint">
              Fill all 8 slots to open the deck in the game.
            </p>
          )}
          {/* Desktop save (mobile uses the sticky bottom bar). NB: wrap instead of
              passing `hidden` to Button — Button's own `inline-flex` would win. */}
          <div className="hidden lg:block">
            <Button variant="gold" fullWidth disabled={!complete} onClick={handleSave}>
              {saveButtonContent}
            </Button>
          </div>
          {state.baseline && (
            <div>
              <Button variant="ghost" icon={<Copy />} onClick={handleDuplicate}>
                Duplicate
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Right: the card gallery */}
      <div className="mt-6 min-w-0 lg:mt-0">
        <CardGallery ctx={ctx} inDeck={inDeck} hasTag={hasTag} onTap={onGalleryTap} containerRef={galleryRef} />
      </div>

      {/* Spacer so the fixed save bar never covers gallery content (mobile) */}
      <div className="h-20 md:h-24 lg:hidden" aria-hidden />

      {/* Sticky mobile Save bar — sits above the fixed tab bar (h-16 + safe area) */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 md:bottom-0 lg:hidden">
        <div className="mx-auto w-full max-w-6xl px-4 pb-2 md:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="surface flex items-center gap-3 p-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {complete && <AvgElixir value={avg} />}
              <span
                className={
                  complete && !dirty ? 'text-xs font-bold text-good-400' : 'text-xs font-bold text-ink-dim'
                }
                aria-live="polite"
              >
                {saveHint}
              </span>
            </div>
            <Button variant="gold" className="min-w-32" disabled={!complete} onClick={handleSave}>
              {saveButtonContent}
            </Button>
          </div>
        </div>
      </div>

      {/* Overlays */}
      <SlotMenuSheet
        deck={state.deck}
        position={menuSlot}
        lookup={ctx.lookup}
        owned={ctx.owned}
        onClose={() => setMenuSlot(null)}
        onSetForm={(position, form) => dispatch({ type: 'setForm', position, form })}
        onSwap={(position) => dispatch({ type: 'armSwap', position })}
        onRemove={(position) => dispatch({ type: 'remove', position })}
      />
      <TowerTroopSheet
        open={towerOpen}
        onClose={() => setTowerOpen(false)}
        towerTroopId={state.deck.towerTroopId}
        towerTroops={ctx.towerTroops}
        ownedTowerTroops={ownedTowerTroops}
        hasCollection={hasCollection}
        onPick={(troopId) => dispatch({ type: 'setTowerTroop', id: troopId })}
      />
      <OpenInClashRoyaleSheet
        deck={state.deck}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        dirty={dirty}
        onSave={handleSave}
      />
      {guard.dialog}
    </div>
  );
}
