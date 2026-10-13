import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from './cn';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

type Listener = (toasts: ToastItem[]) => void;

/* --- tiny module-level store (no zustand needed) --- */
let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(toasts);
}

function push(kind: ToastKind, message: string, duration = 3200) {
  const id = nextId++;
  toasts = [...toasts.slice(-3), { id, kind, message }]; // keep max 4
  emit();
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
  return id;
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Imperative toast API — safe to call from anywhere (event handlers, stores). */
export const toast = {
  success: (message: string, duration?: number) => push('success', message, duration),
  error: (message: string, duration?: number) => push('error', message, duration ?? 5000),
  info: (message: string, duration?: number) => push('info', message, duration),
  dismiss,
};

const kindStyles: Record<ToastKind, { icon: ReactNode; bar: string }> = {
  success: { icon: <CheckCircle2 className="size-5 text-good-400" aria-hidden />, bar: 'bg-good-500' },
  error: { icon: <TriangleAlert className="size-5 text-bad-400" aria-hidden />, bar: 'bg-bad-500' },
  info: { icon: <Info className="size-5 text-royal-300" aria-hidden />, bar: 'bg-royal-500' },
};

/** Renders the toast stack. Mount once near the app root (App does this). */
export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>(toasts);

  useEffect(() => {
    const listener: Listener = (t) => setItems(t);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 px-4 pb-24 md:items-end md:px-6 md:pb-6"
      style={{ paddingBottom: 'max(6rem, calc(env(safe-area-inset-bottom) + 5rem))' }}
    >
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 14, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 480, damping: 32 }}
            className={cn(
              'pointer-events-auto relative flex w-full max-w-sm items-center gap-3 overflow-hidden rounded-2xl border border-white/12 bg-night-800/95 py-3 pr-2 pl-4 shadow-xl backdrop-blur',
            )}
          >
            <span className={cn('absolute inset-y-0 left-0 w-1', kindStyles[t.kind].bar)} aria-hidden />
            {kindStyles[t.kind].icon}
            <p className="min-w-0 flex-1 text-sm font-semibold text-ink">{t.message}</p>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-white/10 hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
