import { useEffect, useRef } from "react";

/**
 * Landing background: a faint dot grid behind the hero that fades toward the edges. With a mouse, the
 * dots around the ball cursor light up orange. Phones and reduced motion get the still grid.
 */
export function DotGrid() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!el || !fine || reduce) return;

    let frame = 0;
    let x = 0;
    let y = 0;
    const draw = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${x - r.left}px`);
      el.style.setProperty("--my", `${y - r.top}px`);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX;
      y = e.clientY;
      el.classList.add("is-lit");
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const leave = () => el.classList.remove("is-lit");

    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("mouseleave", leave);
    };
  }, []);

  return <div ref={ref} className="dot-grid" aria-hidden="true" />;
}
