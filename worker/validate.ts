import { z } from "zod";

const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

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

export const teamSchema = z.object({ name: text("Team name", 60) });

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
  .max(12, "PaQueueKame handles up to 12 courts.");

export const createSessionSchema = z.object({
  title: text("Session name", 60),
  venue: optionalText("Venue", 80),
  courtCount: courts,
});

export const updateSessionSchema = z.object({
  title: text("Session name", 60).optional(),
  venue: optionalText("Venue", 80),
  courtCount: courts.optional(),
  selfCheckin: z.boolean().optional(),
});

export const checkinSchema = z.union([
  z.object({ playerId: id }),
  z.object({ name: text("Name", 40), skill: skill.optional() }),
]);

export const statusSchema = z.object({ status: z.enum(["in", "break", "left"]) });

export const startSchema = z.object({ court: z.number().int().min(1).max(12) });

export const swapSchema = z.object({ out: id, in: id });

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

export const selfStatusSchema = z.object({
  k: z.string().min(8).max(64),
  playerId: id,
  status: z.enum(["in", "break", "left"]),
});
