const LABELS = ["", "Beginner", "Advanced beginner", "Intermediate", "Advanced intermediate", "Advanced", "Expert"];

export function skillLabel(skill: number | null): string {
  return skill ? LABELS[skill] : "Skill not set";
}

/** Six dots, filled up to the player's level. */
export function Skill({ value }: { value: number | null }) {
  if (!value) return null;
  return (
    <span className="skill" role="img" aria-label={`Skill ${value} of 6, ${LABELS[value]}`} title={LABELS[value]}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <i key={i} className={i <= value ? "on" : ""} />
      ))}
    </span>
  );
}

export function SkillPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="skill-picker" role="group" aria-label="Skill level">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <button
          key={i}
          type="button"
          aria-pressed={value === i}
          title={LABELS[i]}
          aria-label={`${i}, ${LABELS[i]}`}
          onClick={() => onChange(value === i ? null : i)}
        >
          {i}
        </button>
      ))}
    </div>
  );
}
