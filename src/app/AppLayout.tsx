import { type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Download, LayoutGrid, Plus, Link2, Settings, Swords } from 'lucide-react';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/Button';
import { SyncPill, type SyncPillState } from '@/ui/SyncPill';
import { Avatar } from '@/ui/Avatar';
import { pageTransition, pageVariants, springSnappy } from '@/ui/motion';
import { OfflineBanner } from './pwa/OfflineBanner';
import { useInstallPrompt } from './pwa/installPrompt';

/**
 * CSS contract for page-level fixed bottom UI (e.g. the editor's sticky Save
 * bar): `--tabbar-h` is the height the mobile tab bar occupies, including the
 * bottom safe-area inset. It is `calc(4rem + env(safe-area-inset-bottom))` on
 * small screens and `0px` from `md` up (where the tab bar is hidden). Pages
 * should position sticky/fixed bottom bars with `bottom: var(--tabbar-h)` and
 * add `pb-safe` inside the bar.
 */
const TABBAR_CSS =
  ':root{--tabbar-h:calc(4rem + env(safe-area-inset-bottom,0px))}@media(min-width:48rem){:root{--tabbar-h:0px}}';

/** Tiny playful card-stack brand mark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="4" y="7" width="15" height="21" rx="3.5" fill="var(--color-royal-500)" transform="rotate(-10 11.5 17.5)" />
      <rect x="12" y="4" width="15" height="21" rx="3.5" fill="var(--color-gold-400)" transform="rotate(8 19.5 14.5)" />
      <circle cx="18" cy="13" r="2.4" fill="var(--color-night-900)" transform="rotate(8 19.5 14.5)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark className="size-7" />
      <span className="font-display text-xl tracking-wide text-ink">
        CR <span className="text-gold-400">Pocket</span>
      </span>
    </span>
  );
}

const NAV_ITEMS: ReadonlyArray<{ to: string; label: string; icon: typeof LayoutGrid; end?: boolean }> = [
  { to: '/', label: 'My Decks', icon: LayoutGrid, end: true },
  { to: '/player', label: 'Player', icon: Swords },
  { to: '/import', label: 'Import', icon: Link2 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export interface AppLayoutProps {
  /** Sync indicator state for the header pill. */
  syncState?: SyncPillState;
  /** Signed-in user for the avatar (falls back to initials). */
  user?: { name?: string | null; photoURL?: string | null } | null;
  /** Render the SignInScreen / landing instead of the tab shell (integrator wires this). */
  children?: ReactNode;
}

/**
 * App shell: sticky compact header (wordmark, desktop nav, sync pill, avatar),
 * routed content with short page transitions, mobile bottom tab bar with a
 * raised gold center "+ Add Deck" button, and an offline banner.
 */
export function AppLayout({ syncState = 'demo', user = null }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { canInstall, promptInstall } = useInstallPrompt();

  return (
    <div className="flex min-h-dvh flex-col">
      <style>{TABBAR_CSS}</style>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:bg-royal-500 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      {/* Header */}
      <header className="pt-safe sticky top-0 z-40 border-b border-white/8 bg-night-900/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
          <NavLink to="/" aria-label="CR Pocket — My Decks" className="shrink-0 rounded-lg">
            <Wordmark />
          </NavLink>

          {/* Desktop primary nav */}
          <nav aria-label="Primary" className="mx-2 hidden items-center gap-0.5 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className="relative rounded-full px-3.5 py-2 text-sm font-bold"
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="desktop-nav-pill"
                        transition={springSnappy}
                        className="absolute inset-0 rounded-full bg-white/10 ring-1 ring-white/15"
                        aria-hidden
                      />
                    )}
                    <span
                      className={cn(
                        'relative z-10 flex items-center gap-1.5 transition-colors',
                        isActive ? 'text-gold-300' : 'text-ink-dim hover:text-ink',
                      )}
                    >
                      <item.icon className="size-4" aria-hidden />
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {canInstall && (
              <button
                type="button"
                onClick={() => void promptInstall()}
                aria-label="Install app"
                title="Install app"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/12 bg-white/5 px-3 text-sm font-semibold text-ink-dim transition-colors hover:bg-white/10 hover:text-ink"
              >
                <Download className="size-4" aria-hidden />
                <span className="hidden lg:inline">Install app</span>
              </button>
            )}
            <Button
              variant="gold"
              size="sm"
              icon={<Plus className="size-4" strokeWidth={2.75} aria-hidden />}
              onClick={() => navigate('/deck/new')}
              className="max-md:hidden"
            >
              New deck
            </Button>
            <SyncPill state={syncState} />
            <button
              type="button"
              aria-label="Open settings"
              onClick={() => navigate('/settings')}
              className="rounded-full transition-transform active:scale-95"
            >
              <Avatar name={user?.name} photoURL={user?.photoURL} size="md" />
            </button>
          </div>
        </div>
      </header>

      <OfflineBanner />

      {/* Content */}
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-28 md:pb-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-night-900/85 backdrop-blur-md md:hidden"
      >
        <div className="grid h-16 grid-cols-5 items-stretch">
          <TabItem to="/" label="My Decks" icon={LayoutGrid} end />
          <TabItem to="/player" label="Player" icon={Swords} />
          {/* Raised gold center action */}
          <div className="relative flex items-start justify-center">
            <motion.button
              type="button"
              whileTap={{ scale: 0.9, y: 2 }}
              onClick={() => navigate('/deck/new')}
              aria-label="Add deck"
              className="lip absolute -top-5 flex size-14 items-center justify-center rounded-full bg-gradient-to-b from-gold-300 via-gold-400 to-gold-500 text-night-900 [--lip-color:var(--color-gold-600)]"
            >
              <Plus className="size-7" strokeWidth={2.75} aria-hidden />
            </motion.button>
          </div>
          <TabItem to="/import" label="Import" icon={Link2} />
          <TabItem to="/settings" label="Settings" icon={Settings} />
        </div>
      </nav>
    </div>
  );
}

function TabItem({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof LayoutGrid; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      className="relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-t-xl transition-colors active:bg-white/5"
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="tabbar-active-dot"
              transition={springSnappy}
              className="absolute top-1 h-1 w-6 rounded-full bg-gold-400"
              aria-hidden
            />
          )}
          <Icon
            className={cn('size-5 transition-colors', isActive ? 'text-gold-400' : 'text-ink-faint')}
            aria-hidden
          />
          <span
            className={cn(
              'text-[0.62rem] font-bold tracking-wide transition-colors',
              isActive ? 'text-ink' : 'text-ink-faint',
            )}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

/**
 * Two-column layout for desktop (≥lg). Pages opt in by wrapping their content:
 *   <TwoColumn main={<DeckList/>} aside={<EditorPanel/>} />
 * On mobile the columns stack (main first, aside below).
 */
export function TwoColumn({ main, aside, className }: { main: ReactNode; aside: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start', className)}>
      <section className="min-w-0">{main}</section>
      <section className="min-w-0 lg:sticky lg:top-20">{aside}</section>
    </div>
  );
}
