const LABELS = ["", "Beginner", "Advanced beginner", "Intermediate", "Advanced intermediate", "Advanced", "Expert"];

export function skillLabel(skill: number | null): string {
  return skill ? LABELS[skill] : "Skill not set";
}

// A pickleball: the ball with its holes punched out (even-odd fill), so it works on any background.
const BALL = "M0.5 8a7.5 7.5 0 1 0 15 0a7.5 7.5 0 1 0 -15 0M6.8 8a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0M10.71 10.2a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0M6.9 12.4a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0M3.09 10.2a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0M3.09 5.8a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0M6.9 3.6a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0M10.71 5.8a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0";

/** A small chip: a pickleball and the player's level (1-6). `plain` drops the chip outline. */
export function Skill({ value, plain = false }: { value: number | null; plain?: boolean }) {
  if (!value) return null;
  return (
    <span
      className={plain ? "skill skill-plain" : "skill"}
      role="img"
      aria-label={`Skill ${value} of 6, ${LABELS[value]}`}
      title={LABELS[value]}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d={BALL} fillRule="evenodd" />
      </svg>
      {value}
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
