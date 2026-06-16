# RIP — rip · battle · build

A competitive card-ripping web game and companion to **The Card Huddle**. Open virtual
packs, chase **globally-unique, finite serialed cards**, battle head-to-head, and build a
lineup that scores off a simulated football league. Full-stack, server-authoritative,
not a front-end mockup.

```
shared/   TypeScript constants + pure helpers shared by server and web (single source of truth)
server/   Node + Express + Prisma (PostgreSQL) — the authoritative game engine + REST API
web/      React + TypeScript + Vite SPA — the dark/gold UI and the pack-opening reveal
```

---

## The headline guarantee: numbered cards are unique and finite

A specific serial — say **Gold /250 #47** — can be owned by exactly one player, ever.
This is enforced server-side and is race-safe:

- **Atomic allocation.** Each numbered pull runs
  `UPDATE "CardTemplate" SET "nextSerial" = "nextSerial" + 1 WHERE id = … AND "nextSerial" < "printRun" RETURNING "nextSerial"`
  inside a transaction. Postgres serializes concurrent updates to that row, so two
  simultaneous rips get different serials — never the same one.
- **Hard constraint.** `CardInstance` has a unique index on `(templateId, serial)` as a
  second line of defense. (NULLs are distinct in Postgres, so unlimited Base cards stack.)
- **Sold-out fallback.** When a print run is exhausted the pull falls back to the next
  more-common parallel, ultimately to unlimited Base — it never fails or duplicates.
- **Proven.** `server/tests/concurrency.test.ts` fires **400 simultaneous rips at a
  Gold /250 template and asserts exactly 250 unique serials, zero duplicates** (plus
  Emerald /10 capping at 10 and both fallback paths).

Parallels and print runs (largest numbered run capped at 5000):

| Parallel | Print run | Refractor |
|---|---|---|
| Base | unlimited | – |
| Blue | /5000 | – |
| Purple | /999 | – |
| Gold | /250 | gold treatment |
| Black | /50 | ✦ holographic |
| Emerald | /10 | ✦ holographic |
| Superfractor | /1 | ✦ holographic |

---

## Open it on GitHub — Codespaces (no local setup)

RIP is a real full-stack app (Node + PostgreSQL), so GitHub Pages can't host it — but a
**GitHub Codespace** runs the whole thing in the cloud and forwards it to your browser:

1. On the repo: **Code ▸ Codespaces ▸ Create codespace on `claude/quirky-allen-m8fexv`**.
   Direct link: `https://codespaces.new/froggerscodes/rip/tree/claude/quirky-allen-m8fexv`
2. Wait ~1–2 minutes the first time while it installs, runs migrations, seeds the league,
   and builds the web app (all automatic via `.devcontainer`).
3. It auto-starts and forwards **port 4000**; a toast offers **Open in Browser**. (If you
   miss it, open the **Ports** tab and click the globe icon on port 4000.)
4. Log in with `demo` / `demo1234`.

Advance a league week from the Codespace terminal with `npm run sim:advance` (or the
**Dev** panel on the Home page). For live-reload development, run `npm run dev` and open
the forwarded port **5173** instead.

## Deploy a permanent public link

RIP is Node + PostgreSQL, so it needs an always-on host. Cloudflare can't run that
backend without a Workers/D1 rewrite — but you can still get a permanent **Cloudflare
`*.pages.dev`** link with no domain by hosting the frontend on Cloudflare Pages and the
backend on a free always-on host. The single Docker image already serves the whole app on
one port, and on boot it migrates + seeds itself (only if the DB is empty).

**A) Easiest single link — Render (free, permanent `*.onrender.com`):**
1. Render dashboard → **New ▸ Blueprint** → connect this repo → pick the branch → **Apply**.
   `render.yaml` provisions Postgres + the web service, builds the Docker image, runs
   migrations + seed, and deploys.
2. Open the resulting `https://rip-xxxx.onrender.com` and log in with `demo` / `demo1234`.

**B) A Cloudflare `*.pages.dev` link (frontend on Cloudflare Pages):**
1. Deploy the API first via step A; note its URL.
2. Cloudflare → **Workers & Pages ▸ Create ▸ Pages ▸ Connect to Git** → select this repo/branch.
3. Build command: `npm install && npm --workspace web run build` · Output directory:
   `web/dist` · Environment variable: `VITE_API_URL = https://rip-xxxx.onrender.com`.
4. Deploy → share `https://rip-xxxx.pages.dev`. (CORS and SPA routing are already handled.)

Notes: Render's free web service sleeps after ~15 min idle (first request after is slow),
and free Postgres is time-limited — for a long-lived database, create a free
[Neon](https://neon.tech) Postgres and set `DATABASE_URL` to its connection string
(append `?sslmode=require`). The same `Dockerfile` runs on Fly.io or any Docker host.
A full Cloudflare-only build (Workers + D1 + Pages) is possible but a larger rewrite.

## Prerequisites

- Node.js 20+ (built and tested on Node 22)
- PostgreSQL 16 — easiest via Docker, or any reachable Postgres

---

## Setup

```bash
# 1. Start Postgres (Docker). Creates a `rip` database with user/pass rip/rip.
docker compose up -d

# 2. Point the server at it.
cp .env.example server/.env          # defaults already match docker-compose

# 3. Install all workspaces.
npm install

# 4. Create the schema and seed 16 teams, 256 players, 1,792 templates, 3 products.
npm run migrate        # prisma migrate (creates tables)
npm run seed           # idempotent: wipes + reseeds, creates the `demo` account
```

> Not using Docker? Create a Postgres database and a `rip_test` database, then set
> `DATABASE_URL` / `TEST_DATABASE_URL` in `server/.env` before `npm run migrate`.

## Run it

```bash
# Terminal 1 — API on http://localhost:4000
npm run dev:server

# Terminal 2 — web app on http://localhost:5173 (proxies /api to the server)
npm run dev:web
```

Open **http://localhost:5173** and log in with the seeded account:

```
username: demo
password: demo1234
```

(Or create a new account — new users get 1,000 tokens + 2 cases to start.)

**One-port alternative:** `npm start` builds the web app and serves it together with the
API on **http://localhost:4000** (this is what the Codespace runs).

---

## Advance a league week

The league always has action. Advancing one week schedules matchups, simulates
per-player box scores, moves player values, writes value history, and scores everyone's
lineup. Run it any of three ways — all call the same `advanceWeek()`:

```bash
npm run sim:advance                                   # advance one week (prints recap + movers)
npm run sim:season            # advance a whole season (14 weeks + playoffs, default 17)
npm run sim:season 17 --workspace server              # explicit count
```
```bash
curl -X POST http://localhost:4000/api/admin/advance-week -H 'x-admin-token: dev-admin'
```
…or click **Advance week** in the *Dev* panel on the web Home page (admin token
defaults to `dev-admin`, configurable via `ADMIN_TOKEN`). A real cron can call the same
function later.

A season is **14 regular-season weeks → an 8-team playoff bracket (Quarterfinal →
Semifinal → Championship) → a champion**, then it rolls into the next season (player
values mean-revert toward their rating baseline). Each week also flags a **Game of the
Week** with an auto recap. Standings, the bracket, champions, and weekly/season stat
leaders all populate as you advance — see the **Standings** and **Stats** pages.

> Player photos are generated per player by a free image service in the browser, with a
> monogram fallback. Set `VITE_PORTRAITS=off` to use monograms only.

---

## Demo the full loop

1. **Daily pack** — Home → *Claim daily pack*. Server-enforced once per 24h; the streak
   bumps the tier at day 7 / 30. Cards reveal one at a time with the value tallying up.
2. **Rip** — *Rip* → pick a product (odds shown) → **RIP PACK**. Hits flash the screen and
   get the holographic treatment; every numbered card shows its real `#serial/run`.
3. **Battle** — *Battle* → pick a product → **Battle the house**. You and the bot open the
   same product; higher total market value wins tokens + a case + rating. **You keep every
   card you pull** (so does the bot — uniqueness holds either way).
4. **Lineup** — *Lineup* → equip a card into each role (QB/WR1/WR2/RB/TE/FLEX). Only
   eligible positions fit a slot (FLEX = RB/WR/TE). Watch the total lineup value.
5. **Advance a week** — run the sim (above). Now revisit:
   - **Teams / player pages** — values moved; sparklines and last-week box scores update.
   - **Leaderboard** — your lineup scored from your equipped players' real stats.
   - **Collection** — card market values shifted with their players.
6. **Recycle** — *Collection* → *Recycle base* → select base filler → convert to **dust**,
   then spend dust on a pack back on the *Rip* page. (Earn paths so you're never stuck:
   signup grant, daily tokens, battle consolation, recycling.)

---

## Tests

```bash
npm test     # Vitest: the concurrency proof + unit tests (valuation caps, daily tiers,
             # lineup eligibility, market value). Uses the rip_test database.
```

---

## How it fits together

- **Pull engine** (`server/src/ripping/pullEngine.ts`) — weighted parallel roll →
  top-player-biased player pick → atomic serial allocation → fallback → owned instance.
- **Economy** (`server/src/economy/wallet.ts`) — atomic, overdraft-safe token/case/dust
  changes; all currency moves happen server-side in the same transaction as the pull.
- **League** (`server/src/league/*`) — circle-method schedule, internally consistent box
  scores (a QB's passing yards equal his receivers' yards; passing TDs equal receiving
  TDs), fantasy + performance scores, value changes capped at ±15%/week into
  `ValueHistory`, and weekly lineup scoring.
- **Market value** = `player.currentValue × parallel.valueMultiplier × lowSerialPremium`,
  computed on read so it tracks live player values (#1 and single-digit serials carry a
  premium).
- **Shared source of truth** (`shared/src/index.ts`) — parallels, print runs, multipliers,
  role eligibility, and scoring live once and are imported by both server and web.

### Key API endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/signup` · `/api/auth/login` · GET `/api/auth/me` | accounts (JWT) |
| GET | `/api/products` | products + computed pull odds |
| POST | `/api/rip` | open a pack (`pay: tokens \| dust`) |
| GET/POST | `/api/daily/status` · `/api/daily/claim` | daily pack + streak |
| GET | `/api/cards` · POST `/api/cards/recycle` | collection + base→dust |
| GET/PUT/DELETE | `/api/lineup` · `/api/lineup/:role` | equip by role |
| POST/GET | `/api/battles` | head-to-head vs bot + history |
| GET | `/api/teams` · `/api/teams/:id` · `/api/players/:id` | browsers + trends |
| GET | `/api/league/current` · `/scoreboard` · `/leaderboard` | league state |
| POST | `/api/admin/advance-week` | simulate a week (admin token) |

---

## Notes

- **Auth** is intentionally minimal: JWT (bcrypt-hashed passwords) in `Authorization: Bearer`.
- **Bot battles** allocate the bot's pulls to a seeded house account, so every serial in
  existence is owned by exactly one user — the uniqueness invariant is never bent.
- Economy numbers (costs, rewards, multipliers, odds) live in the seed and a few config
  modules and are easy to tune.
