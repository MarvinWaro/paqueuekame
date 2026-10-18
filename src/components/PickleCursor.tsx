import { type CSSProperties, useEffect, useRef } from "react";

const TRAIL = 10;
// Holes of a pickleball, as on the skill chip: a center hole and a ring of six (viewBox 0 0 24 24).
const HOLES = [[12, 12], ...[30, 90, 150, 210, 270, 330].map((a) => {
  const r = (a * Math.PI) / 180;
  return [12 + 6.4 * Math.cos(r), 12 + 6.4 * Math.sin(r)];
})];

/**
 * A pickleball that follows the mouse, with a fading trail. Desktop only (a real mouse or trackpad),
 * never on touch screens, and off for people who ask for reduced motion. The normal cursor comes back
 * whenever the ball isn't showing.
 */
export function PickleCursor() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!el || !fine || reduce) return;

    const html = document.documentElement;
    const ball = el.querySelector<HTMLElement>(".pc-ball")!;
    const dots = Array.from(el.querySelectorAll<HTMLElement>(".pc-dot"));
    const pos = dots.map(() => ({ x: -100, y: -100 }));
    const at = { x: -100, y: -100 };
    let frame = 0;

    const draw = () => {
      frame = 0;
      ball.style.transform = `translate3d(${at.x}px, ${at.y}px, 0)`;
      let moving = false;
      let lead = at;
      pos.forEach((p, i) => {
        p.x += (lead.x - p.x) * 0.34;
        p.y += (lead.y - p.y) * 0.34;
        if (Math.abs(lead.x - p.x) + Math.abs(lead.y - p.y) > 0.3) moving = true;
        dots[i].style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
        lead = p;
      });
      if (moving) frame = requestAnimationFrame(draw); // stop once the trail has caught up
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (!html.classList.contains("pc-on")) {
        pos.forEach((p) => Object.assign(p, { x: e.clientX, y: e.clientY })); // no streak from the corner
        html.classList.add("pc-on");
      }
      at.x = e.clientX;
      at.y = e.clientY;
      const target = e.target as Element | null;
      el.classList.toggle("is-hover", !!target?.closest("a, button, summary, label, [role='button']"));
      el.classList.toggle("is-text", !!target?.closest("input, textarea, select")); // normal caret for typing
      wake();
    };
    const hide = () => html.classList.remove("pc-on");
    const down = () => el.classList.add("is-down");
    const up = () => el.classList.remove("is-down");
    let hitTimer = 0;
    const hit = () => {
      el.classList.remove("is-hit");
      void el.offsetWidth; // restart the pop
      el.classList.add("is-hit");
      clearTimeout(hitTimer);
      hitTimer = window.setTimeout(() => el.classList.remove("is-hit"), 320);
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    html.addEventListener("mouseleave", hide);
    window.addEventListener("blur", hide);
    window.addEventListener("nexa:hit", hit);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(hitTimer);
      window.removeEventListener("nexa:hit", hit);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      html.removeEventListener("mouseleave", hide);
      window.removeEventListener("blur", hide);
      hide();
    };
  }, []);

  return (
    <div ref={root} className="pc" aria-hidden="true">
      {Array.from({ length: TRAIL }, (_, i) => (
        <i key={i} className="pc-dot" style={{ "--i": i } as CSSProperties} />
      ))}
      <span className="pc-ball">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="11" className="pc-shell" />
          {HOLES.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.5" className="pc-hole" />
          ))}
        </svg>
      </span>
    </div>
  );
}
