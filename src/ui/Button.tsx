import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

export type ButtonVariant = 'gold' | 'violet' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Show a spinner and block interaction while true. */
  loading?: boolean;
  /** Icon rendered before the label. */
  icon?: ReactNode;
  /** Stretch to container width. */
  fullWidth?: boolean;
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 min-h-9 px-3.5 text-sm gap-1.5 rounded-xl',
  md: 'h-11 min-h-11 px-5 text-[0.95rem] gap-2 rounded-2xl',
  lg: 'h-13 min-h-13 px-7 text-lg gap-2.5 rounded-2xl',
};

const variants: Record<ButtonVariant, string> = {
  // Gold primary: chunky game button with a darker bottom lip that presses down.
  gold: [
    'lip font-display tracking-wide text-night-900',
    'bg-gradient-to-b from-gold-300 via-gold-400 to-gold-500',
    '[--lip-color:var(--color-gold-600)]',
    'hover:brightness-105 disabled:brightness-75',
  ].join(' '),
  violet: [
    'lip font-display tracking-wide text-white',
    'bg-gradient-to-b from-royal-400 via-royal-500 to-royal-600',
    '[--lip-color:var(--color-royal-800)]',
    'hover:brightness-110 disabled:brightness-75',
  ].join(' '),
  ghost: [
    'font-semibold text-ink-dim border border-white/12 bg-white/5',
    'hover:bg-white/10 hover:text-ink',
    'disabled:opacity-50',
  ].join(' '),
  danger: [
    'lip font-display tracking-wide text-white',
    'bg-gradient-to-b from-bad-400 via-bad-500 to-bad-600',
    '[--lip-color:#8f1d1d]',
    'hover:brightness-105 disabled:brightness-75',
  ].join(' '),
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'violet', size = 'md', loading = false, icon, fullWidth, className, children, disabled, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap transition-[filter,background-color,transform,box-shadow] duration-100',
        'disabled:cursor-not-allowed',
        sizes[size],
        variants[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="size-[1.1em] animate-spin" aria-hidden />
      ) : (
        icon && <span className="inline-flex size-[1.15em] items-center justify-center [&>svg]:size-full" aria-hidden>{icon}</span>
      )}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required for accessibility — there is no visible label. */
  'aria-label': string;
  variant?: 'ghost' | 'solid' | 'gold';
  size?: 'sm' | 'md';
  loading?: boolean;
  children: ReactNode;
}

const iconSizes = { sm: 'size-9', md: 'size-11' } as const;
const iconVariants = {
  ghost: 'text-ink-dim hover:bg-white/10 hover:text-ink',
  solid: 'surface text-ink hover:bg-night-700',
  gold: 'lip bg-gradient-to-b from-gold-300 via-gold-400 to-gold-500 text-night-900 [--lip-color:var(--color-gold-600)] hover:brightness-105',
} as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', size = 'md', loading = false, className, children, disabled, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50',
        '[&>svg]:size-5',
        iconSizes[size],
        iconVariants[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : children}
    </button>
  );
});
