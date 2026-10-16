import { Link } from "../lib/router";

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#2A5C96" />
      <rect x="5" y="9" width="22" height="14" fill="none" stroke="#fff" strokeWidth="1.6" />
      <rect x="12.5" y="9" width="7" height="14" fill="#2E7D5F" stroke="#fff" strokeWidth="1.2" />
      <path d="M16 7v18" stroke="#fff" strokeWidth="2" />
      <circle cx="23" cy="12.5" r="3.2" fill="#DCEB3B" />
    </svg>
  );
}

export function Brand({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="brand" aria-label="PaQueueKame home">
      <BrandMark />
      PaQueueKame
    </Link>
  );
}
