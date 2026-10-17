import { Icon } from "./Icon";

/** − 3 + for a number of courts, 1 to 12. */
export function CourtStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} aria-label="One court fewer" disabled={value <= 1}>
        <Icon name="minus" />
      </button>
      <output aria-live="polite" aria-label={`${value} courts`}>
        {value}
      </output>
      <button type="button" onClick={() => onChange(Math.min(12, value + 1))} aria-label="One more court" disabled={value >= 12}>
        <Icon name="plus" />
      </button>
    </div>
  );
}
