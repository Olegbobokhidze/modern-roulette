import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconClose } from './icons';

type Props = {
  readonly open: boolean;
  readonly onClose?: () => void;
  readonly title: string;
  readonly kicker?: string;
  /** modal: centred (bottom sheet on phones). drawer: right side panel, non-modal. */
  readonly variant: 'modal' | 'drawer';
  readonly className?: string;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
};

/** Open sheets, topmost last: Esc closes only the top one (rules modal over the inspector drawer). */
const openStack: symbol[] = [];

/**
 * Shared modal / drawer shell. Focus moves in on open and back out on close; Esc closes when allowed.
 * The footer is right-aligned with the primary action last (AGENTS.md §3).
 */
export function Sheet({ open, onClose, title, kicker, variant, className, footer, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const target = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el;
    // Drawers are non-modal: keep focus where the user was unless asked.
    if (variant === 'modal') target?.focus({ preventScroll: true });
    const me = Symbol(variant);
    openStack.push(me);
    const onKey = (e: KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== me) return;
      if (e.key === 'Escape' && closeRef.current) {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (variant === 'modal' && e.key === 'Tab' && el) {
        const f = [...el.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, [tabindex="0"]')];
        const first = f[0];
        const last = f[f.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      openStack.splice(openStack.indexOf(me), 1);
      window.removeEventListener('keydown', onKey, true);
      if (variant === 'modal') prev?.focus?.({ preventScroll: true });
    };
  }, [open, variant]);

  if (!open) return null;

  const panel = (
    <div
      ref={ref}
      className={`sheet sheet--${variant} ${className ?? ''}`}
      role="dialog"
      aria-modal={variant === 'modal'}
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <header className="sheet__header">
        <div>
          {kicker && <p className="sheet__kicker">{kicker}</p>}
          <h2 id={titleId} className="sheet__title">
            {title}
          </h2>
        </div>
        {onClose && (
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        )}
      </header>
      <div className="sheet__body">{children}</div>
      {footer && <footer className="sheet__footer">{footer}</footer>}
    </div>
  );

  if (variant === 'drawer') return panel;
  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      {panel}
    </div>
  );
}
