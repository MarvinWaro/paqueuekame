// Cloudflare Worker entry. Only /api/* reaches this code (see wrangler.jsonc);
// the React app's files are served by Cloudflare directly, free and unlimited.
import type { Env } from "./env";
import { HttpError, assertSameOrigin, json } from "./http";
import { Router } from "./router";
import { authRoutes } from "./routes/auth";
import { liveRoutes } from "./routes/live";
import { playerRoutes } from "./routes/players";
import { sessionRoutes } from "./routes/sessions";

const router = new Router();
authRoutes(router);
playerRoutes(router);
sessionRoutes(router);
liveRoutes(router);

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      assertSameOrigin(req);
      const res = await router.handle(req, env);
      return res ?? json({ error: "Not found." }, 404);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message, code: err.code }, err.status);
      console.error(err);
      // D1 refuses queries once the free daily limit is used up; it resets at 00:00 UTC (8 AM Manila).
      if (/limit|exceeded|quota/i.test(String(err))) {
        return json({ error: "PaQueueKame reached its free daily limit. It works again after 8:00 AM.", code: "daily_limit" }, 503);
      }
      return json({ error: "Something went wrong on our side. Try again in a moment.", code: "server_error" }, 500);
    }
  },
};
