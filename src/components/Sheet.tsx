import { type ReactNode, useEffect, useRef } from "react";
import { Icon } from "./Icon";

/** Bottom drawer on phones, centered dialog on wider screens. Esc or the scrim closes it. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement | null>(null);
  // Keep the latest onClose without re-running the effect, so a re-render never moves the cursor.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>("input, button:not(.sheet-close), [href], select, textarea");
    (first ?? panel.current)?.focus();
    // Runs once when the sheet opens.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea")].filter(
        (el) => !el.hasAttribute("disabled"),
      );
      if (!items.length) return;
      const [a, z] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={panel} tabIndex={-1}>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn sheet-close" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
