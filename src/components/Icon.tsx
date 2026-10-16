// Small stroke icon set, drawn on a 24px grid.
const paths = {
  court: "M3 6h18v12H3z M12 6v12 M8.5 6v12 M15.5 6v12",
  line: "M5 6h14 M5 12h14 M5 18h9",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5 M16 4.3a3.5 3.5 0 0 1 0 6.4 M18 14.8c1.8.8 3 2.6 3.5 5.2",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0V4Z M8 6H5a3 3 0 0 0 3 4 M16 6h3a3 3 0 0 1-3 4 M12 13v4 M8.5 20h7 M10 17h4",
  calendar: "M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 13.5l1.6 1.2-2 3.4-1.9-.8a7 7 0 0 1-1.9 1.1L15 20.5h-4l-.3-2.1a7 7 0 0 1-1.9-1.1l-1.9.8-2-3.4 1.6-1.2a7 7 0 0 1 0-2.9L4.9 9.4l2-3.4 1.9.8a7 7 0 0 1 1.9-1.1L11 3.5h4l.3 2.2a7 7 0 0 1 1.9 1.1l1.9-.8 2 3.4-1.6 1.2a7 7 0 0 1 0 2.9Z",
  plus: "M12 5v14 M5 12h14",
  minus: "M5 12h14",
  close: "M6 6l12 12 M18 6L6 18",
  back: "M15 5l-7 7 7 7",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M20 20l-4-4",
  shuffle: "M4 7h3c4 0 6 10 10 10h3 M4 17h3c1.5 0 2.6-1.4 3.6-3.2 M14.4 9.2C15.4 7.6 16.4 7 17 7h3 M17 4l3 3-3 3 M17 14l3 3-3 3",
  share: "M12 4v11 M7.5 8.5 12 4l4.5 4.5 M5 13v6h14v-6",
  qr: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2v2h-2z M18 14h2v2h-2z M14 18h2v2h-2z M18 18h2v2h-2z",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z",
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
  undo: "M9 5 4 10l5 5 M4 10h10a5 5 0 0 1 0 10h-3",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Z M10 20a2 2 0 0 0 4 0",
  check: "M5 12.5l4.5 4.5L19 7.5",
  logout: "M15 4h4v16h-4 M10 8l-4 4 4 4 M6 12h10",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, className = "icon", label }: { name: IconName; className?: string; label?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={paths[name]} />
    </svg>
  );
}
