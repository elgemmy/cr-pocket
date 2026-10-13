import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { backdropVariants, sheetVariants } from './motion';
import { Button } from './Button';
import { IconButton } from './Button';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Screen-reader label when no visible title is provided. */
  'aria-label'?: string;
  children: ReactNode;
  /** Footer actions (e.g. buttons), pinned below scrollable content. */
  footer?: ReactNode;
  className?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Adaptive overlay: bottom sheet on mobile, centered dialog ≥md.
 * Esc + backdrop dismiss, basic focus trap, drag-to-dismiss on touch sizes.
 */
export function Sheet({ open, onClose, title, 'aria-label': ariaLabel, children, footer, className }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Esc to close + focus trap + restore focus on unmount.
  useEffect(() => {
    if (!open) return;
    const prevActive = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus the panel (or first focusable) on open.
    const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE);
    (focusables && focusables.length > 0 ? focusables[0] : panel)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      prevActive?.focus?.();
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
          <motion.div
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={onClose}
            className="absolute inset-0 bg-night-950/70 backdrop-blur-[3px]"
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : ariaLabel}
            tabIndex={-1}
            variants={sheetVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
            className={cn(
              'relative flex max-h-[88dvh] w-full flex-col overflow-hidden border border-white/10 bg-night-850 shadow-2xl',
              'rounded-t-[1.75rem] md:max-w-lg md:rounded-[1.75rem]',
              'pb-safe',
              className,
            )}
          >
            {/* drag handle (mobile affordance) */}
            <div className="flex justify-center pt-2.5 md:hidden" aria-hidden>
              <div className="h-1.5 w-10 rounded-full bg-white/20" />
            </div>
            <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-1 md:pt-5">
              {title != null && <h2 className="font-display text-xl text-ink">{title}</h2>}
              <IconButton aria-label="Close dialog" size="sm" onClick={onClose} className="ml-auto">
                <X aria-hidden />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">{children}</div>
            {footer && <div className="flex gap-3 border-t border-white/8 px-5 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = red confirm button (destructive actions). */
  tone?: 'danger' | 'primary';
  loading?: boolean;
}

/** Small confirmation dialog for destructive or consequential actions. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading,
}: ConfirmDialogProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" fullWidth onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'gold'}
            fullWidth
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {body != null && <p className="text-sm leading-relaxed text-ink-dim">{body}</p>}
    </Sheet>
  );
}
