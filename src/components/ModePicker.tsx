import { MATCH_MODES, MATCH_MODE_KEYS, type MatchMode } from "../../shared/matchModes";
import { Icon } from "./Icon";

/** The matching mode choices, as large tappable cards. */
export function ModePicker({ value, onChange }: { value: MatchMode; onChange: (mode: MatchMode) => void }) {
  return (
    <div className="modes" role="radiogroup" aria-label="Matching mode">
      {MATCH_MODE_KEYS.map((key) => {
        const m = MATCH_MODES[key];
        const on = key === value;
        return (
          <button key={key} type="button" role="radio" aria-checked={on} className="mode" onClick={() => onChange(key)}>
            <span className="mode-title">
              <span className="mode-check" aria-hidden="true">
                {on && <Icon name="check" />}
              </span>
              {m.label}
              {m.badge && <span className="mode-badge">{m.badge}</span>}
            </span>
            <span className="mode-desc">{m.description}</span>
          </button>
        );
      })}
    </div>
  );
}
