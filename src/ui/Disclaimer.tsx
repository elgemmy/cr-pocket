import { cn } from './cn';

/** Supercell fan-content disclaimer — required attribution (spec §6). */
export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn('text-center text-[0.7rem] leading-relaxed text-ink-faint', className)}>
      CR Pocket is unofficial fan content, not approved or endorsed by Supercell. Clash Royale and its
      artwork are trademarks of Supercell.{' '}
      <a
        href="https://supercell.com/en/fan-content-policy/"
        target="_blank"
        rel="noreferrer noopener"
        className="underline decoration-ink-faint/60 underline-offset-2 transition-colors hover:text-ink-dim"
      >
        Fan Content Policy
      </a>
    </p>
  );
}
