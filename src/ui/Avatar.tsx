import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { cn } from './cn';

export interface AvatarProps {
  /** User display name (used for initials + alt). */
  name?: string | null;
  photoURL?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'size-7 text-[0.6rem]', md: 'size-9 text-xs', lg: 'size-12 text-base' } as const;

function initials(name?: string | null): string {
  if (!name) return '';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** Round user avatar — photo with initials fallback. */
export function Avatar({ name, photoURL, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showPhoto = photoURL && !failed;
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-royal-400 to-elixir-500 font-display text-white ring-2 ring-white/15',
        sizes[size],
        className,
      )}
      role="img"
      aria-label={name ? `${name}'s avatar` : 'User avatar'}
    >
      {showPhoto ? (
        <img
          src={photoURL}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : name ? (
        <span aria-hidden>{initials(name)}</span>
      ) : (
        <UserRound className="size-1/2" aria-hidden />
      )}
    </span>
  );
}
