import { z } from "zod";
import { THEME_CHOICES, courtColorProblem, normalizeHex } from "../shared/courtThemes";
import { MATCH_MODE_KEYS } from "../shared/matchModes";

const mode = z.enum(MATCH_MODE_KEYS, { message: "Pick one of the matching modes." });

const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(120);
const password = z.string().min(8, "Use at least 8 characters for the password.").max(200, "That password is too long.");
const id = z.string().min(1).max(40);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "The team link needs at least 3 characters.")
  .max(40, "Keep the team link to 40 characters or fewer.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use only letters, numbers and single dashes in the team link.");

export const registerSchema = z.object({
  teamName: text("Team name", 60),
  slug: slugSchema,
  name: text("Your name", 60),
  email,
  password,
});

export const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password.").max(200) });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(200),
  newPassword: password,
});

const courtColor = (area: "court" | "kitchen") =>
  z
    .string()
    .max(20)
    .transform(normalizeHex)
    .superRefine((hex, ctx) => {
      const problem = courtColorProblem(area, hex);
      if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
    });

export const teamSchema = z.object({
  name: text("Team name", 60).optional(),
  courtTheme: z.enum(THEME_CHOICES, { message: "Pick one of the court colors." }).optional(),
  customColors: z.object({ court: courtColor("court"), kitchen: courtColor("kitchen") }).optional(),
});

export const organizerSchema = z.object({ name: text("Name", 60), email, password });

const skill = z.number().int().min(1).max(6).nullable();

export const playerSchema = z.object({
  name: text("Name", 40),
  skill: skill.optional(),
  isGuest: z.boolean().optional(),
});

export const updatePlayerSchema = z.object({
  name: text("Name", 40).optional(),
  skill: skill.optional(),
  isGuest: z.boolean().optional(),
});

export const bulkPlayersSchema = z.object({
  names: z
    .array(text("Name", 40))
    .min(1, "Add at least one name.")
    .max(100, "Add up to 100 names at a time."),
});

const courts = z
  .number()
  .int()
  .min(1, "Use at least 1 court.")
  .max(12, "NEXA handles up to 12 courts.");

const placeName = text("Place name", 60);

export const createSessionSchema = z.object({
  title: text("Session name", 60),
  placeId: id.nullable().optional(),
  newPlace: placeName.optional(), // typed in the start form; reuses a place with the same name
  courtCount: courts,
  mode: mode.optional(),
});

export const placeSchema = z.object({ name: placeName, courtCount: courts });

export const updatePlaceSchema = z.object({
  name: placeName.optional(),
  courtCount: courts.optional(),
  archived: z.boolean().optional(),
});

export const leaderboardQuery = z.object({
  range: z.enum(["month", "last-month", "all"], { message: "Pick this month, last month or all time." }).default("month"),
  place: id.optional(),
});

export const updateSessionSchema = z.object({
  title: text("Session name", 60).optional(),
  courtCount: courts.optional(),
  selfCheckin: z.boolean().optional(),
  mode: mode.optional(),
});

export const checkinSchema = z.union([
  z.object({ playerId: id }),
  z.object({ name: text("Name", 40), skill: skill.optional() }),
]);

export const bulkCheckinSchema = z.object({
  playerIds: z.array(id).min(1, "Pick at least one player.").max(80, "Check in up to 80 players at a time."),
});

export const statusSchema = z.object({ status: z.enum(["in", "break", "left"]) });

export const startSchema = z.object({ court: z.number().int().min(1).max(12) });

export const swapSchema = z.object({ out: id, in: id });

export const courtSwapSchema = swapSchema.extend({ outOnBreak: z.boolean().optional() });

const score = z.number().int().min(0).max(99).nullable().optional();

export const resultSchema = z
  .object({ winner: z.union([z.literal(1), z.literal(2)]), score1: score, score2: score })
  .refine((v) => (v.score1 == null) === (v.score2 == null), "Enter both scores, or neither.")
  .refine(
    (v) => v.score1 == null || v.score2 == null || (v.winner === 1 ? v.score1 > v.score2 : v.score2 > v.score1),
    "The winning team needs the higher score.",
  );

export const selfCheckinSchema = z.object({
  k: z.string().min(8).max(64),
  playerId: id.optional(),
  name: text("Name", 40).optional(),
});

/** Organizer makes someone an umpire: a roster player, or a new guest by name. */
export const umpireSchema = z
  .object({ playerId: id.optional(), name: text("Name", 40).optional(), onBreak: z.boolean().optional() })
  .refine((v) => v.playerId || v.name, "Pick a player or type the umpire's name.");

const team = z.union([z.literal(1), z.literal(2)], { message: "Pick a team." });

export const umpStartSchema = z.object({ firstServer: team, force: z.boolean().optional() });

/** `seq` is how many rallies the phone has seen, so a double tap can't count one rally twice. */
export const rallySchema = z.object({ seq: z.number().int().min(0).max(500), winner: team });

export const undoRallySchema = z.object({ seq: z.number().int().min(0).max(500) });

/** "I'm coming" from the group-chat (live) link: pick a name or type one. */
export const comingSchema = z
  .object({ playerId: id.optional(), name: text("Name", 40).optional() })
  .refine((v) => v.playerId || v.name, "Pick your name or type it.");

export const cancelComingSchema = z.object({ playerId: id });

export const selfStatusSchema = z.object({
  k: z.string().min(8).max(64),
  playerId: id,
  status: z.enum(["in", "break", "left"]),
});
