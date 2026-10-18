import { useEffect } from "react";
import { holdBoot } from "../lib/boot";

/** The NEXA mark with a breathing bar, for a screen waiting on its data. Same shape as the boot splash. */
export function Loading({ label }: { label: string }) {
  useEffect(() => holdBoot(), []);
  return (
    <div className="loading" role="status">
      <svg className="loading-n" viewBox="0 0 118 112" aria-hidden="true">
        <path className="loading-tri" d="M62 0H110Q118 0 118 8V56Z" />
        <path d="M20 0H28L118 90V104Q118 112 110 112H94L28 46H20Z" />
        <path d="M0 12Q0 0 12 0H28V112H12Q0 112 0 100Z" />
      </svg>
      <span className="loading-bar" />
      <p>{label}</p>
    </div>
  );
}
