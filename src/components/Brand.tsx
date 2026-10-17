import { Link } from "../lib/router";

const IMG = "/assets/img";

/** The NEXA icon. Both versions load; the CSS shows the one for the current theme. */
export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <img className="for-light" src={`${IMG}/nexa-icon-light.png`} alt="" width={128} height={128} />
      <img className="for-dark" src={`${IMG}/nexa-icon-dark.png`} alt="" width={128} height={128} />
    </span>
  );
}

/** The full NEXA wordmark, for pages without a team name (landing, log in, sign up). */
export function Brand({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="brand" aria-label="NEXA home">
      <img className="brand-wordmark for-light" src={`${IMG}/nexa-wordmark-light.png`} alt="" width={470} height={120} />
      <img className="brand-wordmark for-dark" src={`${IMG}/nexa-wordmark-dark.png`} alt="" width={457} height={120} />
    </Link>
  );
}
