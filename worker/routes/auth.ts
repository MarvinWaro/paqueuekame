// Organizer sign-up, log-in, team settings and co-organizers.
import type { Me, Organizer } from "../../shared/types";
import { type OrganizerRow, createLogin, destroyLogin, hashPassword, requireOrganizer, verifyPassword } from "../auth";
import { HttpError, json, readJson } from "../http";
import { ulid } from "../ids";
import type { Router } from "../router";
import { changePasswordSchema, loginSchema, organizerSchema, registerSchema, teamSchema } from "../validate";

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 10;
const MAX_ORGANIZERS = 10;

const toOrganizer = (o: { id: string; name: string; email: string }): Organizer => ({ id: o.id, name: o.name, email: o.email });

export function authRoutes(router: Router): void {
  router.post("/api/auth/register", async ({ env, req }) => {
    const body = await readJson(req, registerSchema);
    const [slugTaken, emailTaken] = await env.DB.batch([
      env.DB.prepare("SELECT 1 FROM teams WHERE slug = ?").bind(body.slug),
      env.DB.prepare("SELECT 1 FROM organizers WHERE email = ?").bind(body.email),
    ]);
    if (emailTaken.results.length) throw new HttpError(409, "This email already has an account. Log in instead.", "email_taken");
    if (slugTaken.results.length) throw new HttpError(409, "That team link is taken. Try adding your city to it.", "slug_taken");

    const now = Date.now();
    const teamId = ulid(now);
    const organizerId = ulid(now);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO teams (id, slug, name, created_at) VALUES (?, ?, ?, ?)").bind(teamId, body.slug, body.teamName, now),
      env.DB.prepare(
        "INSERT INTO organizers (id, team_id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(organizerId, teamId, body.name, body.email, await hashPassword(body.password), now),
    ]);
    const cookie = await createLogin(env, req, organizerId);
    const me: Me = {
      organizer: { id: organizerId, name: body.name, email: body.email },
      team: { id: teamId, slug: body.slug, name: body.teamName },
      liveSessionId: null,
    };
    return json(me, 201, { "set-cookie": cookie });
  });

  router.post("/api/auth/login", async ({ env, req }) => {
    const body = await readJson(req, loginSchema);
    const now = Date.now();
    const organizer = await env.DB.prepare("SELECT * FROM organizers WHERE email = ?").bind(body.email).first<OrganizerRow>();
    const wrong = new HttpError(401, "The email or password is wrong.", "bad_login");
    if (!organizer) throw wrong;

    if (organizer.locked_until > now) {
      const minutes = Math.ceil((organizer.locked_until - now) / 60000);
      throw new HttpError(429, `Too many wrong passwords. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`, "locked");
    }
    if (!(await verifyPassword(body.password, organizer.password_hash))) {
      const failed = organizer.failed_logins + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await env.DB.prepare("UPDATE organizers SET failed_logins = ?, locked_until = ? WHERE id = ?")
        .bind(lock ? 0 : failed, lock ? now + LOCK_MINUTES * 60000 : 0, organizer.id)
        .run();
      throw wrong;
    }

    const cookie = await createLogin(env, req, organizer.id);
    await env.DB.batch([
      env.DB.prepare("UPDATE organizers SET failed_logins = 0, locked_until = 0 WHERE id = ?").bind(organizer.id),
      env.DB.prepare("DELETE FROM logins WHERE organizer_id = ? AND expires_at < ?").bind(organizer.id, now),
    ]);
    return json({ ok: true }, 200, { "set-cookie": cookie });
  });

  router.post("/api/auth/logout", async ({ env, req }) => {
    return json({ ok: true }, 200, { "set-cookie": await destroyLogin(env, req) });
  });

  router.get("/api/me", async ({ env, req }) => {
    const { organizer, team } = await requireOrganizer(env, req);
    const live = await env.DB.prepare("SELECT id FROM sessions WHERE team_id = ? AND status = 'live' ORDER BY created_at DESC LIMIT 1")
      .bind(team.id)
      .first<{ id: string }>();
    const me: Me = {
      organizer: toOrganizer(organizer),
      team: { id: team.id, slug: team.slug, name: team.name },
      liveSessionId: live?.id ?? null,
    };
    return json(me);
  });

  router.post("/api/me/password", async ({ env, req }) => {
    const { organizer } = await requireOrganizer(env, req);
    const body = await readJson(req, changePasswordSchema);
    if (!(await verifyPassword(body.currentPassword, organizer.password_hash))) {
      throw new HttpError(400, "Your current password is wrong.", "bad_password");
    }
    await env.DB.prepare("UPDATE organizers SET password_hash = ? WHERE id = ?")
      .bind(await hashPassword(body.newPassword), organizer.id)
      .run();
    return json({ ok: true });
  });

  router.patch("/api/team", async ({ env, req }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, teamSchema);
    await env.DB.prepare("UPDATE teams SET name = ? WHERE id = ?").bind(body.name, team.id).run();
    return json({ ...team, name: body.name });
  });

  router.get("/api/organizers", async ({ env, req }) => {
    const { team } = await requireOrganizer(env, req);
    const { results } = await env.DB.prepare("SELECT id, name, email FROM organizers WHERE team_id = ? ORDER BY created_at")
      .bind(team.id)
      .all<Organizer>();
    return json(results.map(toOrganizer));
  });

  router.post("/api/organizers", async ({ env, req }) => {
    const { team } = await requireOrganizer(env, req);
    const body = await readJson(req, organizerSchema);
    const [count, taken] = await env.DB.batch([
      env.DB.prepare("SELECT COUNT(*) AS n FROM organizers WHERE team_id = ?").bind(team.id),
      env.DB.prepare("SELECT 1 FROM organizers WHERE email = ?").bind(body.email),
    ]);
    if ((count.results[0] as { n: number }).n >= MAX_ORGANIZERS) {
      throw new HttpError(400, `A team can have up to ${MAX_ORGANIZERS} organizers.`, "too_many");
    }
    if (taken.results.length) throw new HttpError(409, "This email already has an account.", "email_taken");
    const id = ulid();
    await env.DB.prepare("INSERT INTO organizers (id, team_id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, team.id, body.name, body.email, await hashPassword(body.password), Date.now())
      .run();
    return json(toOrganizer({ id, name: body.name, email: body.email }), 201);
  });

  router.delete("/api/organizers/:id", async ({ env, req, params }) => {
    const { organizer, team } = await requireOrganizer(env, req);
    if (params.id === organizer.id) throw new HttpError(400, "You can't remove yourself. Ask another organizer.", "self");
    const res = await env.DB.prepare("DELETE FROM organizers WHERE id = ? AND team_id = ?").bind(params.id, team.id).run();
    if (!res.meta.changes) throw new HttpError(404, "That organizer isn't on your team.", "not_found");
    return json({ ok: true });
  });
}
