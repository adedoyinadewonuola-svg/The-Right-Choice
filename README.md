# The Right Choice — Stock & Sales

Daily stock, sales and end-of-day management for the shop. This is a full-stack web app (Next.js + PostgreSQL) with staff login. The original single-file prototype (which only saved data in the browser) is kept for reference in [`legacy/`](legacy/).

This README is written for someone setting this up for the first time on their own computer — no prior experience with these tools assumed.

## What you need installed first

You only need to do this section once per computer.

1. **Node.js** (version 20 or newer) — this runs the app.
   Download from [nodejs.org](https://nodejs.org) and install it. To check it worked, open a terminal and run:
   ```bash
   node -v
   ```
   You should see a version number like `v20.x.x` or higher.

2. **Docker Desktop** — this runs the database (PostgreSQL) for you, so you don't have to install a database by hand.
   Download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) and install it. After installing, **open Docker Desktop and leave it running** in the background — it needs to be running whenever you use this app.

3. **Git** (to download/manage the project) — usually already installed. Check with:
   ```bash
   git --version
   ```

## First-time setup (do this once)

Open a terminal in the project folder and run these commands one at a time.

1. **Install the project's dependencies** (downloads all the libraries the app needs):
   ```bash
   npm install
   ```

2. **Create your local settings file.** This tells the app how to connect to the database. Copy the example file:
   ```bash
   cp .env.example .env
   chmod 600 .env
   ```
   You don't need to edit anything inside it for local use — the defaults work with the database container below. (`chmod 600` is just good hygiene: the file holds the database password and the session secret. On Windows, skip it.)

3. **Start the database.** Make sure Docker Desktop is open and running first, then:
   ```bash
   npm run db:up
   ```
   This downloads and starts a small PostgreSQL database on your computer (only used by this app).

4. **Create the database tables:**
   ```bash
   npm run db:migrate
   ```

5. **Load the starter data** — this fills in the shop's product list and creates your first login:
   ```bash
   npm run db:seed
   ```
   Watch the terminal output — it prints a line like:
   ```
   Seeded admin user: admin@therightchoice.local / changeme123
   ```
   That's your login. **Write it down or take a screenshot.** (See "Login credentials" below for how to change it.)

## Running the app

Every time you want to use the app:

1. Make sure **Docker Desktop is open** (the database needs it).
2. Start the database if it isn't already running:
   ```bash
   npm run db:up
   ```
3. Start the app:
   ```bash
   npm run dev
   ```
4. Open your browser to **http://localhost:3000**
5. Sign in with the login shown when you ran `npm run db:seed` (default: `admin@therightchoice.local` / `changeme123`, unless you changed it — see below).

To stop the app, go back to the terminal and press `Ctrl+C`. The database container keeps running in the background (harmless) — stop it with `docker compose down` if you want to fully shut it down.

## Login credentials

The seed step creates **one admin account** you use to sign in. By default:

- **Email:** `admin@therightchoice.local`
- **Password:** `changeme123`

**You should change this password** once you're set up, since the default is public (it's in this README). Two ways to do that:

- **Easiest — reseed with your own values.** Before running `npm run db:seed` for the first time, set your own email/password as environment variables. In the terminal, run (replacing the values):
  ```bash
  # Windows PowerShell
  $env:SEED_ADMIN_EMAIL="you@example.com"
  $env:SEED_ADMIN_PASSWORD="a-real-password"
  npm run db:seed
  ```
  ```bash
  # Git Bash / macOS / Linux
  SEED_ADMIN_EMAIL="you@example.com" SEED_ADMIN_PASSWORD="a-real-password" npm run db:seed
  ```
  Re-running the seed is safe — it won't duplicate the account or the products; it just updates them.

Two other things to know about signing in:

- **Too many wrong passwords.** After **8 failed sign-in attempts** for the same email within 10 minutes, the form refuses further tries until the window passes. A successful sign-in clears the counter, so a few typos won't lock a clerk out. It's an in-memory counter in the running server (no database table), so it resets whenever the app restarts, and it is per-process — see "Deploying" if you ever run more than one instance.
- **To add more staff logins later**, ask whoever maintains the code to add a small script, or extend `prisma/seed.ts` — there's currently no "sign up" page by design, since this is a small internal tool.

## Everyday use — what each page does

- **Daily Stock** — today's (or any date's) opening/received/closing stock per product. Opening stock is filled in automatically from the previous day's closing stock. The **Price (₦)** column shows the price that day's revenue is counted at: it is frozen when the day is created, so a later Price List edit does not rewrite history. Clear the cell to make that row follow the price list again, or type a figure to correct that one day.
  - **Carry Forward** pulls the previous day's closing into Opening and never touches your counted Closing. On a day that already has entries, a second button — **Carry Forward & Reset Closing** — does the old overwrite behaviour, after asking you to confirm.
- **History** — a list of every day recorded, with a link back to reopen any day, and a button to download a full backup of your data as a file.
- **Price List** — view and edit cost/selling prices, and add, rename, re-categorize, or delete products. Changing a selling price here applies to days recorded from now on.
- **Dashboard** — running totals across all recorded days (total sales, POS, expenses).

Numbers are checked when you leave a field: stock counts must be whole units of 0 or more, and money cannot be negative. A value that fails is **not** saved — the cell falls back to the stored figure and a message explains why, so a typo can't quietly become a negative stock count or a ₦-500 expense.

The checks live in the Server Actions (`src/lib/validate.ts`), not only in the inputs, so they hold however the action is called. Rejected input is never written and comes back as a message the form shows. Two details worth knowing: only the six editable stock columns can be written through `updateStockField` (the column name is whitelisted server-side, so a stale or crafted call cannot reach `unitPrice` or a foreign key), and an expense description may be left blank — the list then shows "Expense" — but is capped at 200 characters.

The **POS** box and the **Total Units Sold** / **Expected Sales** figures update as you type and are worked out from the numbers currently on screen. Figures on the History and Dashboard pages come from what was actually saved.

## Deploying

The app runs in production mode with three environment variables and one command:

```bash
cp -n .env.example .env && chmod 600 .env   # 600: it holds the database password and AUTH_SECRET
npm ci
npm run build
npm run db:deploy                            # applies existing migrations; no shadow database needed
AUTH_SECRET="$(npx auth secret)" npm start
```

- **`AUTH_SECRET`** — signs/encrypts the session cookie. Generate a fresh one per machine; never reuse the example value.
- **`APP_TIMEZONE`** (default `Africa/Lagos`) — decides which day the Daily Stock page opens on. The day key is deliberately *not* the server's UTC date, or a shop opening just after midnight would be shown yesterday.
- **`trustHost`** is set in `src/lib/auth.ts`. Without it Auth.js rejects the `Host` header in production and every `/api/auth/*` request answers `500 UntrustedHost`, so sign-in fails only in production and works fine in dev. Keep it if you sit behind a proxy; set `AUTH_URL` instead if you prefer pinning the public origin.
- **Session lifetime** is the Auth.js default (30 days, JWT cookie, `HttpOnly`, `SameSite=Lax`). There is no revocation list, so a copied cookie stays valid to expiry — serve over HTTPS (the cookie is marked `Secure` only then) and reseed the password when staff leave.
- **Response headers**: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` are set in `next.config.ts`, and `/api/export` sends `Cache-Control: private, no-store` so a full backup can't be cached by a proxy. There is **no CSP** — it fights Turbopack's dev-time inline scripts. Add one when you deploy, and check the login page still works.

### Known upstream advisories

`npm audit` reports 4 high findings, all inside the **Prisma CLI** dependency tree (`deepmerge-ts` via `@prisma/config`, plus `mysql2` via `prisma`). They affect the developer command line, not this app's runtime — the app talks to Postgres through `@prisma/client` + `pg`, never MySQL. The only remediation npm offers is downgrading to `prisma@6`, so the project pins Prisma 7 and waits for a patch rather than taking a breaking downgrade. Re-check with `npm audit` when bumping Prisma.

## Troubleshooting

- **"Can't reach database" / app won't start** → Docker Desktop probably isn't running, or the database container isn't started. Open Docker Desktop, then run `npm run db:up`.
- **Forgot the admin password** → re-run the seed with a new password (see "Login credentials" above); it updates the existing account rather than creating a duplicate.
- **"Too many failed attempts" on the login form** → the sign-in throttle (8 per email per 10 minutes) is open. Wait it out, or restart the app to clear it.
- **Sign-in works on `npm run dev` but fails after `npm run build`** → check `AUTH_SECRET` is set in the production environment. `trustHost` is already configured; a missing secret is the usual cause.
- **Port 3000 already in use** → another program (maybe a previous `npm run dev` you forgot to stop) is using it. Close that terminal, or stop the process, then try again.

## For developers

<details>
<summary>Stack, project structure, and scripts</summary>

### Stack

- **Next.js** (App Router, TypeScript, Server Actions)
- **PostgreSQL** + **Prisma ORM**
- **Auth.js (NextAuth v5)** — credentials login (email + password), JWT sessions

### Project structure

```
prisma/
  schema.prisma          Data model (User, Product, DailyRecord, StockEntry, Expense)
  migrations/             Applied schema history — add new ones with `npm run db:migrate`
  seed.ts                 Seeds products + an admin user
src/
  app/
    login/                Sign-in page
    (app)/                Authenticated views: today, history, prices, overview
    api/                  Auth route handler + JSON backup export
    globals.css           Design tokens and every shared class (no component library)
  actions/                Server Actions (mutations): stock, expenses, products, auth
  components/              Client components for the interactive views
  lib/
    prisma.ts             Prisma client singleton
    auth.ts               Auth.js config (credentials provider, trustHost, sign-in throttle)
    session.ts            requireUser() — the guard every action must call first
    validate.ts           Shared input validation (quantities, money, dates, ids, text)
    stock.ts              Day creation, carry-forward, frozen-price and total calculations
    money.ts              Formatting helpers used by both server and client
    rate-limit.ts         In-memory sign-in attempt limiter
legacy/                    The original single-file HTML prototype (reference only)
```

There is **no component library** — styling is plain CSS classes defined in `src/app/globals.css` (`card`, `btn`, `input`, `label`, `grid`, `field`, `form-grid`, `notice`, `notice danger`, `toolbar`, `controls`, `num`, `section`) over a small set of colour variables (`--brown`, `--gold`, `--cream`, `--ink`, `--muted`, `--line`, `--green`, `--red`). Match the existing class names rather than introducing inline styles or a new dependency.

### Business logic

Each day's **opening stock** is automatically carried forward from the previous recorded day's **closing stock** (or from a product's seeded initial stock if no earlier day exists) — see `getOrCreateDailyRecord` in [`src/lib/stock.ts`](src/lib/stock.ts). Adding a new product later automatically backfills a stock entry into any already-created days.

Each day's **revenue is counted at a frozen price**. `StockEntry.unitPrice` is written from `Product.price` when the entry is created, and `resolvedUnitPrice` uses it for the sold-times-price calculation; `Product.price` is only the fallback for rows created before a price existed. Editing a price on the Price List therefore never rewrites a day that has already been counted. Daily Stock, History and Dashboard all read the same helper, so a price change can never appear differently between them.

**Opening a day is safe to do twice at once.** `getOrCreateDailyRecord` inserts the day, and if a second request loses the race it catches the duplicate-key error and reads the row the first request created. Two clerks opening the same morning at the same time therefore both get a working page instead of one of them seeing a 500.

### Input is validated on the server

`src/lib/validate.ts` holds the rules (whole non-negative units, non-negative money within `Decimal(12,2)`, real `YYYY-MM-DD` dates, 200-character text) and every action calls it before touching Prisma. Actions return `{ error }` rather than writing, and the client turns that into a message plus a fallback to the stored value. This is deliberate: the inputs already carry `min`/`step`, but those are hints a browser, a stale page, or curl can ignore — and a rejected value that vanishes silently is worse than one that complains.

### Sign-in is required for every mutation

Server Actions are POSTs to the page URL, and the `(app)` layout only guards *rendering*. So every action in `src/actions/` starts with `await requireUser()` ([`src/lib/session.ts`](src/lib/session.ts)), which sends an anonymous caller to `/login` instead of running the write. Keep that first line when you add a new action — a mutation without it is writable by anyone who can reach the site.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / start |
| `npm run lint` | ESLint |
| `npm run db:up` | Start local Postgres via Docker Compose |
| `npm run db:migrate` | Apply Prisma migrations (dev; creates/edits them, needs a shadow database) |
| `npm run db:deploy` | Apply existing migrations only — use this in production |
| `npm run db:seed` | Seed products + admin user |
| `npm run db:studio` | Open Prisma Studio (a GUI for browsing the database) |
| `npm run verify` | End-to-end checks against a running dev server — see below |

### Checking a change

A green `tsc`, `lint` and `build` proves very little: every bug fixed so far was invisible to them.
There is a real check for that:

```bash
npm run dev                 # in one terminal
npm run verify              # in another — 32 assertions, expect PASS=32 FAIL=0
```

`npm run verify` signs in for real, calls the real Server Actions, and reads the database back with
`psql` to confirm rejected input was *not* written. It covers the timezone, input validation, the
column whitelist, frozen prices, two clerks opening the same new day, and the sign-in throttle. It
is idempotent and leaves your data as it found it.

It needs `psql` on your PATH (the Docker image has one; if you don't have the client installed, the
script will tell you) and a `.env` with `DATABASE_URL`. It signs in as the seeded admin, so pass
`ADMIN_EMAIL` / `ADMIN_PASSWORD` if you changed them. It is most useful before opening a pull
request.

### Known limitations

Worth knowing before you promise anyone a feature:

- **Sessions cannot be revoked.** They are 30-day JWTs with no server-side list, so "log this person out everywhere" is not possible without adding one. Changing the password does not invalidate existing cookies.
- **The sign-in throttle is per-process and in memory.** It resets on restart and is not shared between instances. Fine for one small box; it needs Redis or a table if you ever run two.
- **The first staff accounts come from `prisma/seed.ts`.** There is no invitation or sign-up flow, so adding a clerk means a seed run or a small script.
- **33 of the 155 seeded products have no selling price and 111 have no cost.** That is seed data, not a bug — a blank price means "not set", and a product with no price contributes ₦0 to expected sales.
- **No Content-Security-Policy header.** See the note under Deploying.
- **A wrongly *typed* argument to a Server Action fails before our code runs.** The transport rejects it, so the clerk sees a 500 rather than a friendly message. This is rare (it needs a bug in the client), and the database stays safe because the write never happens.

</details>
