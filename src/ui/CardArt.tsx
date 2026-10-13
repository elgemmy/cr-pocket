import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Lock, TriangleAlert } from 'lucide-react';
import type { CatalogCard } from '@shared/types';
import type { SlotForm, SlotRole } from '@/domain/types';
import { cn } from './cn';
import { ElixirBadge } from './ElixirBadge';
import { hoverLift, tapSquash } from './motion';

export type CardArtSize = 'xs' | 'sm' | 'md' | 'lg' | 'fill';
export type CardArtState = 'normal' | 'selected' | 'empty' | 'dimmed';
export type CardArtOwnership = 'owned' | 'not_owned' | 'form_locked' | 'unknown';

export interface CardArtProps {
  /** Catalog entry. null/undefined = unknown card id (renders a neutral placeholder, never another card's art). */
  card?: CatalogCard | null;
  /** Active special form; drives the rim + form badge. */
  form?: SlotForm;
  /** Player's normalized level. null = collection loaded but level unknown ("—"); undefined = no collection, badge hidden. */
  level?: number | null;
  size?: CardArtSize; // 'fill' stretches to the parent grid cell
  /** Slot role — used for empty-slot labels and rim when form is 'base'. */
  role?: SlotRole;
  state?: CardArtState;
  ownership?: CardArtOwnership;
  /** Resolved portrait URL chosen by the caller (form-aware). */
  src?: string | null;
  /** Fallback URL (usually base art) if `src` fails to load. */
  fallbackSrc?: string | null;
  /** Numeric id shown on the unknown-card placeholder. */
  unknownId?: number | string;
  /** Makes the tile a button. */
  onClick?: () => void;
  /** Accessible label override (defaults to card name + form + level). */
  label?: string;
  className?: string;
}

const sizeClasses: Record<CardArtSize, { box: string; elixir: 'sm' | 'md' | 'lg'; level: string; badge: string }> = {
  xs: { box: 'w-10', elixir: 'sm', level: 'hidden', badge: 'h-3 px-[3px] text-[0.45rem]' },
  sm: { box: 'w-14', elixir: 'sm', level: 'text-[0.6rem] px-1 py-px', badge: 'h-3.5 px-1 text-[0.55rem]' },
  md: { box: 'w-20', elixir: 'md', level: 'text-[0.65rem] px-1.5 py-0.5', badge: 'h-4 px-1.5 text-[0.6rem]' },
  lg: { box: 'w-28', elixir: 'lg', level: 'text-xs px-2 py-0.5', badge: 'h-5 px-2 text-[0.7rem]' },
  /** Stretches to its grid cell (aspect ratio preserved); badge scale of `md`. */
  fill: { box: 'w-full', elixir: 'md', level: 'text-[0.65rem] px-1.5 py-0.5', badge: 'h-4 px-1.5 text-[0.6rem]' },
};

/** Rim gradient per effective form/role. */
const rims = {
  none: 'bg-white/10',
  evo: 'bg-[linear-gradient(150deg,#8b7dff,#e14bd8_55%,#6d5cff)] shadow-[0_0_14px_rgb(225_75_216/0.45)]',
  hero: 'bg-[linear-gradient(150deg,#ffe79a,#ffb020_55%,#c78a12)] shadow-[0_0_14px_rgb(255_176_32/0.4)]',
  champion: 'bg-[linear-gradient(150deg,#ffd08a,#f59300_60%,#b45309)] shadow-[0_0_14px_rgb(245_147_0/0.45)]',
  wild: 'bg-[linear-gradient(150deg,#2dd4bf,#6d5cff_70%)] shadow-[0_0_14px_rgb(45_212_191/0.35)]',
} as const;

function rimFor(form: SlotForm, role: SlotRole): keyof typeof rims {
  if (form === 'evo') return 'evo';
  if (form === 'hero') return 'hero';
  if (form === 'champion') return 'champion';
  if (role === 'evo') return 'evo';
  if (role === 'hero') return 'hero';
  if (role === 'wild') return 'wild';
  return 'none';
}

const formBadge: Partial<Record<SlotForm, { text: string; cls: string }>> = {
  evo: { text: 'EVO', cls: 'bg-gradient-to-r from-royal-500 to-elixir-500 text-white' },
  hero: { text: 'HERO', cls: 'bg-gradient-to-r from-hero-400 to-gold-500 text-night-900' },
  champion: { text: 'CHAMP', cls: 'bg-gradient-to-r from-hero-300 to-hero-500 text-night-900' },
};

const emptyLabels: Record<SlotRole, string> = { evo: 'Evo', hero: 'Hero', wild: 'Wild', normal: '+' };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/**
 * Renders one Clash Royale card portrait tile.
 * Fixed ~300:358 aspect box (no layout shift), lazy images, graceful fallbacks:
 * `src` → `fallbackSrc` → stylized initials/id placeholder (never another card's art).
 */
export function CardArt({
  card,
  form = 'base',
  level,
  size = 'md',
  role = 'normal',
  state = 'normal',
  ownership,
  src,
  fallbackSrc,
  unknownId,
  onClick,
  label,
  className,
}: CardArtProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const s = sizeClasses[size];

  const effectiveSrc = imgFailed ? (usedFallback ? null : (fallbackSrc ?? null)) : (src ?? null);
  const showImage = state !== 'empty' && effectiveSrc != null;

  const ariaLabel = useMemo(() => {
    if (label) return label;
    if (state === 'empty') return `Empty ${role === 'normal' ? '' : `${emptyLabels[role]} `}slot`;
    const name = card?.name ?? (unknownId != null ? `Unknown card ${unknownId}` : 'Unknown card');
    const parts = [name];
    if (form !== 'base') parts.push(`${form} form`);
    if (level != null) parts.push(`level ${level}`);
    return parts.join(', ');
  }, [label, state, role, card, unknownId, form, level]);

  const rim = rimFor(form, role);
  const badge = form !== 'base' ? formBadge[form] : undefined;

  const body = (
    <>
      {/* portrait / placeholder */}
      <span className="absolute inset-0 overflow-hidden rounded-[inherit] bg-night-700">
        {showImage ? (
          <img
            src={effectiveSrc}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => {
              if (!imgFailed) setImgFailed(true);
              else if (!usedFallback) setUsedFallback(true);
            }}
            className={cn(
              'size-full object-cover transition-opacity duration-200',
              state === 'dimmed' && 'opacity-45 saturate-50',
            )}
          />
        ) : (
          <span
            className={cn(
              'flex size-full flex-col items-center justify-center gap-0.5 bg-gradient-to-br from-night-600 to-night-800 text-ink-faint',
              state === 'empty' && 'bg-none',
            )}
          >
            {state === 'empty' ? (
              <span className={cn('font-display text-ink-dim', size === 'lg' ? 'text-2xl' : 'text-base')}>
                {emptyLabels[role]}
              </span>
            ) : (
              <>
                <span className={cn('font-display text-ink-dim', size === 'lg' ? 'text-xl' : 'text-sm')}>
                  {card ? initials(card.name) : '?'}
                </span>
                {unknownId != null && size !== 'xs' && (
                  <span className="text-[0.55rem] font-bold tracking-wide text-ink-faint tabular-nums">#{unknownId}</span>
                )}
              </>
            )}
          </span>
        )}
      </span>

      {/* bottom shade for the level badge */}
      {state !== 'empty' && (
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 rounded-b-[inherit] bg-gradient-to-t from-night-950/85 to-transparent"
          aria-hidden
        />
      )}

      {/* elixir badge */}
      {state !== 'empty' && size !== 'xs' && (
        <ElixirBadge cost={card?.elixir ?? null} size={s.elixir} className="absolute top-0.5 left-0.5" />
      )}

      {/* level badge (size classes may mark it hidden — `hidden` loses to `inline-flex`,
          so honor it by not rendering at all) */}
      {/* undefined = no collection loaded at all → no badge; null = collection loaded, level unknown → "—" */}
      {state !== 'empty' && level !== undefined && !s.level.includes('hidden') && (
        <span
          className={cn(
            'absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-night-950/85 font-display leading-none text-ink tabular-nums ring-1 ring-white/15',
            s.level,
          )}
        >
          {level != null ? `Lv ${level}` : 'Lv —'}
        </span>
      )}

      {/* form badge */}
      {badge && !s.badge.includes('hidden') && (
        <span
          className={cn(
            'absolute inline-flex items-center rounded-full font-display leading-none tracking-wide',
            size === 'xs' ? 'top-0.5 left-1/2 -translate-x-1/2' : 'top-1 right-1',
            s.badge,
            badge.cls,
          )}
        >
          {badge.text}
        </span>
      )}

      {/* ownership warning dot */}
      {state !== 'empty' && (ownership === 'not_owned' || ownership === 'form_locked') && (
        <span
          className={cn(
            'absolute flex items-center justify-center rounded-full ring-2 ring-night-900',
            size === 'xs' ? 'size-3' : 'size-4',
            badge ? 'top-6 right-1' : 'top-1 right-1',
            ownership === 'form_locked' ? 'bg-hero-400 text-night-900' : 'bg-bad-500 text-white',
          )}
          role="img"
          aria-label={ownership === 'form_locked' ? 'Form not unlocked' : 'Card not owned'}
        >
          {ownership === 'form_locked' ? (
            <Lock className="size-2.5" aria-hidden />
          ) : (
            <TriangleAlert className="size-2.5" aria-hidden />
          )}
        </span>
      )}

      {/* selected ring */}
      {state === 'selected' && (
        <span
          className="pointer-events-none absolute -inset-1 rounded-[calc(var(--radius-tile)*0.62+4px)] ring-2 ring-gold-400 ring-offset-2 ring-offset-night-900"
          aria-hidden
        />
      )}
    </>
  );

  const frameCls = cn(
    'relative inline-block aspect-[300/358] align-top select-none rounded-[calc(var(--radius-tile)*0.62)] p-[2.5px]',
    rims[rim],
    state === 'empty' && 'border-2 border-dashed border-white/25 bg-white/[0.04] p-0 shadow-none',
    state === 'dimmed' && 'saturate-75',
    s.box,
    className,
  );

  const innerCls = 'relative block size-full overflow-hidden rounded-[calc(var(--radius-tile)*0.62-2.5px)]';

  if (onClick && state !== 'dimmed') {
    return (
      <motion.button
        type="button"
        aria-label={ariaLabel}
        onClick={onClick}
        whileHover={hoverLift}
        whileTap={tapSquash}
        className={cn(frameCls, 'cursor-pointer')}
      >
        <span className={innerCls}>{body}</span>
      </motion.button>
    );
  }

  return (
    <span role="img" aria-label={ariaLabel} className={frameCls}>
      <span className={innerCls}>{body}</span>
    </span>
  );
}

/** Helper: pick the right art URL for a card + form (form-aware, base fallback). */
export function cardArtSrc(card: CatalogCard | null | undefined, form: SlotForm): { src: string | null; fallbackSrc: string | null } {
  if (!card) return { src: null, fallbackSrc: null };
  const base = card.art.base;
  if (form === 'evo') return { src: card.art.evo ?? base, fallbackSrc: base };
  if (form === 'hero' || form === 'champion') return { src: card.art.hero ?? base, fallbackSrc: base };
  return { src: base, fallbackSrc: null };
}
