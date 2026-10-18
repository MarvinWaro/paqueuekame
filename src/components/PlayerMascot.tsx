import { useEffect, useRef } from "react";

const SRC = "/assets/img/mascot";
const ease = 0.12;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The landing-page player: a girl with a paddle who watches the ball cursor. Five aligned layers
 * (body, arm, head, pupils, blink) cut from one illustration; the head, eyes and paddle arm move a
 * little toward the cursor, she blinks now and then or when poked, and swings when the ball gets
 * close to her paddle. Desktop with a mouse only (CSS hides it elsewhere, so phones never download
 * the images); a still pose for reduced motion. Amplitudes stay small because the layers come from
 * a flat drawing.
 */
export function PlayerMascot() {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!el || !fine || reduce) return;

    const cur = { hx: 0, hy: 0, hr: 0, ex: 0, ey: 0, ar: 0 };
    const goal = { ...cur };
    let frame = 0;
    let lastSwing = 0;
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const t = window.setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };

    const draw = () => {
      frame = 0;
      let moving = false;
      for (const k of Object.keys(cur) as (keyof typeof cur)[]) {
        cur[k] += (goal[k] - cur[k]) * ease;
        if (Math.abs(goal[k] - cur[k]) > 0.01) moving = true;
      }
      el.style.setProperty("--hx", `${cur.hx.toFixed(2)}px`);
      el.style.setProperty("--hy", `${cur.hy.toFixed(2)}px`);
      el.style.setProperty("--hr", `${cur.hr.toFixed(2)}deg`);
      el.style.setProperty("--ex", `${cur.ex.toFixed(2)}px`);
      el.style.setProperty("--ey", `${cur.ey.toFixed(2)}px`);
      el.style.setProperty("--ar", `${cur.ar.toFixed(2)}deg`);
      if (moving) frame = requestAnimationFrame(draw);
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };

    const blink = () => {
      el.classList.add("is-blink");
      later(() => el.classList.remove("is-blink"), 130);
    };
    const blinkLoop = () => {
      later(() => {
        blink();
        if (Math.random() < 0.25) later(blink, 260); // sometimes a double blink
        blinkLoop();
      }, 2500 + Math.random() * 3500);
    };

    const swing = () => {
      const now = performance.now();
      if (now - lastSwing < 1200) return;
      lastSwing = now;
      el.classList.remove("is-swing");
      void el.offsetWidth; // restart the animation
      el.classList.add("is-swing");
      window.dispatchEvent(new Event("nexa:hit")); // the ball cursor pops
      later(() => el.classList.remove("is-swing"), 420);
    };

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      // Head pivot (neck) and paddle face, as fractions of the stage.
      const nx = r.left + r.width * 0.494;
      const ny = r.top + r.height * 0.457;
      const dx = clamp((e.clientX - nx) / (innerWidth / 2), -1, 1);
      const dy = clamp((e.clientY - ny) / (innerHeight / 2), -1, 1);
      // Small on purpose: bigger moves open gaps between layers cut from one flat drawing.
      goal.hx = dx * 1.2;
      goal.hy = dy * 0.8;
      goal.hr = dx * 0.5;
      goal.ex = dx * 1.1;
      goal.ey = dy * 0.7;
      goal.ar = clamp(dx * 2 - dy * 1.5, -2.5, 2.5); // paddle leans toward the ball
      const px = r.left + r.width * 0.17;
      const py = r.top + r.height * 0.36;
      if (Math.hypot(e.clientX - px, e.clientY - py) < r.width * 0.32) swing();
      wake();
    };
    const rest = () => {
      Object.assign(goal, { hx: 0, hy: 0, hr: 0, ex: 0, ey: 0, ar: 0 });
      wake();
    };
    const poke = () => {
      blink();
      swing();
    };

    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("mouseleave", rest);
    el.addEventListener("click", poke);
    blinkLoop();
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((t) => clearTimeout(t));
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("mouseleave", rest);
      el.removeEventListener("click", poke);
    };
  }, []);

  return (
    <div className="mascot" aria-hidden="true">
      <div ref={stage} className="mascot-stage">
        <img src={`${SRC}/body.webp`} alt="" width={400} height={369} loading="lazy" decoding="async" />
        <div className="mascot-arm">
          <div className="mascot-swing">
            <img src={`${SRC}/arm.webp`} alt="" width={400} height={369} loading="lazy" decoding="async" />
          </div>
        </div>
        <div className="mascot-head">
          <img src={`${SRC}/head.webp`} alt="" width={400} height={369} loading="lazy" decoding="async" />
          <div className="mascot-eyes">
            <img src={`${SRC}/pupils.webp`} alt="" width={400} height={369} loading="lazy" decoding="async" />
          </div>
          <img className="mascot-blink" src={`${SRC}/blink.webp`} alt="" width={400} height={369} loading="lazy" decoding="async" />
        </div>
      </div>
    </div>
  );
}
