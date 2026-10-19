import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';

const focusable =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]';

export default function Modal({
  labelId,
  busy = false,
  onClose,
  children,
  returnFocusTo,
}: {
  labelId: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
  returnFocusTo: HTMLElement | null;
}) {
  const dialog = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  const pending = useRef(busy);
  close.current = onClose;
  pending.current = busy;
  useLayoutEffect(() => {
    const previous = returnFocusTo;
    const element = dialog.current!;
    const controls = () =>
      Array.from(element.querySelectorAll<HTMLElement>(focusable));
    (controls()[0] ?? element).focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!pending.current) close.current();
      }
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0] ?? element;
      const last = items[items.length - 1] ?? element;
      if (
        !items.length ||
        (event.shiftKey
          ? document.activeElement === first
          : document.activeElement === last)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    const focusin = (event: FocusEvent) => {
      if (!element.contains(event.target as Node))
        (controls()[0] ?? element).focus();
    };
    document.addEventListener('keydown', keydown);
    document.addEventListener('focusin', focusin);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('focusin', focusin);
      // Wait for React to remove inert from the background before restoring focus.
      queueMicrotask(() => {
        if (previous?.isConnected) previous.focus();
      });
    };
  }, []);
  return (
    <div className="overlay">
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        aria-busy={busy}
        tabIndex={-1}
        className="dialog"
      >
        {children}
      </section>
    </div>
  );
}
