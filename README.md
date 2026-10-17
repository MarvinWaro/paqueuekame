# NEXA

(Internal and infrastructure name: `paqueuekame`, used for the Worker, the D1 database, cookies and storage keys.)

An open-play queue for a pickleball team. The organizer runs the courts from a phone; players follow the line on theirs.

- **Fair line:** whoever waited longest plays next. After a game, all four go to the back. Up Next avoids repeat partners and opponents and keeps the teams' skill close. Nobody gets passed over more than twice.
- **Up Next is confirmed by the organizer:** tap *Start on Court 2* when the court is ready. Swap a player or shuffle if needed.
- **Live link for players:** share one link in the group chat. Players tap their name to see their place, the wait, and get a buzz when they're up.
- **Self check-in:** players scan the QR code at the court, tap their name (or add themselves as a guest), and can take a break or go home from their phone.
- **Results:** record the winner (score optional), undo the latest result, standings with wins and point difference, and history of past sessions.
- **Light and dark mode.**

Organizers log in. Players never need an account.

## Stack

| Part | Choice |
|---|---|
| Frontend | React 19 + Vite 7, TypeScript, plain CSS (`src/styles.css`), small custom router |
| API | One Cloudflare Worker (`worker/`), Zod validation, raw SQL |
| Database | Cloudflare D1 (SQLite), migrations in `migrations/` |
| Hosting | Cloudflare Workers with static assets; only `/api/*` runs the Worker |

Free on Cloudflare's free plan. One 3-hour session with 30 players polling every 15 seconds is about 22,000 requests, well under the 100,000 a day limit.

## Run it on your computer (Windows, VS Code terminal)

```powershell
npm install
npx wrangler login
npx wrangler d1 create paqueuekame
```

Copy the `database_id` it prints into `wrangler.jsonc` (replace `REPLACE_WITH_YOUR_DATABASE_ID`). If wrangler offers to add the binding for you, say no; the file already has it.

```powershell
npm run dev
```

Open http://localhost:5173, create your team, add players, start a session. `npm run dev` applies the database migrations to your local database first.

To try the player side, open the live link in a private window, or open the check-in QR's link.

## Put it online

1. Push this folder to a new GitHub repo (for example `MarvinWaro/paqueuekame`).
2. Create the tables in the live database once:
   ```powershell
   npm run db:migrate:remote
   ```
3. In the Cloudflare dashboard: **Workers & Pages → Create → Import a repository**, pick the repo.
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
4. Live address: **https://nexa.nexus** (registered with Cloudflare). It is set in `wrangler.jsonc` under `routes` with `custom_domain: true`, so `npm run deploy` attaches it and sets up HTTPS. The `*.workers.dev` address keeps working as a backup.

**New migration later?** Run `npm run db:migrate:remote` before merging to `main`.

## How the queue works

`worker/queue.ts` is a pure function, easy to read and test:

1. Look at the first 8 people in line.
2. The person who waited longest is always included. So is anyone who was passed over twice.
3. Try every group of 4 and every way to split them into two teams. Score each option:
   wait position (×10), repeat partners (×25), repeat opponents (×6), team skill difference (×8). Lowest score wins.
4. When a game starts, anyone ahead in line who wasn't picked gets a skip.

In a simulated session (30 players, 4 courts, 40 games) every player got 5 or 6 games and nobody repeated a partner.
