import { Crown, Droplet, Sparkles, Swords } from 'lucide-react';
import { cn } from './cn';

/**
 * CSS-animated fanned card stack — the sign-in hero visual.
 * This is also the fallback the optional lazy 3D scene should reuse for
 * `prefers-reduced-motion` and weak devices: render <CardStackHero/> in the
 * same <HeroVisual/> slot (see SignInScreen).
 */
export function CardStackHero({ className }: { className?: string }) {
  const cards = [
    { rot: -13, x: -66, delay: '0s', face: 'from-royal-400 via-royal-500 to-royal-700', Glyph: Swords, tint: 'text-royal-200' },
    { rot: -5, x: -24, delay: '0.7s', face: 'from-elixir-300 via-elixir-400 to-elixir-600', Glyph: Droplet, tint: 'text-elixir-200' },
    { rot: 4, x: 24, delay: '1.4s', face: 'from-gold-300 via-gold-400 to-gold-600', Glyph: Crown, tint: 'text-gold-200' },
    { rot: 12, x: 66, delay: '2.1s', face: 'from-wild-300 via-wild-400 to-royal-600', Glyph: Sparkles, tint: 'text-wild-300' },
  ];
  return (
    <div className={cn('relative flex items-center justify-center overflow-x-clip', className)} aria-hidden>
      {/* arena glow */}
      <div className="absolute size-[130%] rounded-full bg-[radial-gradient(closest-side,rgb(109_92_255/0.28),transparent)] blur-2xl" />
      {/* ground shadow */}
      <div className="absolute bottom-2 h-6 w-4/5 rounded-full bg-black/45 blur-md" />
      <div className="relative h-56 w-64">
        {cards.map((c, i) => (
          <div
            key={i}
            className="absolute top-4 left-1/2 h-44 w-32"
            style={{ transform: `translateX(calc(-50% + ${c.x}px)) rotate(${c.rot}deg)` }}
          >
            <div
              className={cn(
                'animate-float lip size-full rounded-2xl bg-gradient-to-br p-1 [--lip-color:rgb(0_0_0/0.45)]',
                c.face,
              )}
              style={{ animationDelay: c.delay }}
            >
              <div className="flex size-full flex-col items-center justify-center gap-2.5 rounded-[0.9rem] bg-night-900/55 ring-1 ring-white/15">
                <c.Glyph className={cn('size-10 drop-shadow-lg', c.tint)} strokeWidth={2.2} />
                <span className="h-1.5 w-12 rounded-full bg-white/25" />
                <span className="h-1.5 w-8 rounded-full bg-white/15" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
