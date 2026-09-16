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
   ```
   You don't need to edit anything inside it for local use — the defaults work with the database container below.

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

- **To add more staff logins later**, ask whoever maintains the code to add a small script, or extend `prisma/seed.ts` — there's currently no "sign up" page by design, since this is a small internal tool.

## Everyday use — what each page does

- **Daily Stock** — today's (or any date's) opening/received/closing stock per product. Opening stock is filled in automatically from the previous day's closing stock.
- **History** — a list of every day recorded, with a link back to reopen any day, and a button to download a full backup of your data as a file.
- **Price List** — view and edit cost/selling prices, and add, rename, re-categorize, or delete products.
- **Dashboard** — running totals across all recorded days (total sales, POS, expenses).

## Troubleshooting

- **"Can't reach database" / app won't start** → Docker Desktop probably isn't running, or the database container isn't started. Open Docker Desktop, then run `npm run db:up`.
- **Forgot the admin password** → re-run the seed with a new password (see "Login credentials" above); it updates the existing account rather than creating a duplicate.
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
  seed.ts                 Seeds products + an admin user
src/
  app/
    login/                Sign-in page
    (app)/                Authenticated views: today, history, prices, overview
    api/                  Auth route handler + JSON backup export
  actions/                Server Actions (mutations): stock, expenses, products, auth
  components/              Client components for the interactive views
  lib/                      Prisma client, Auth.js config, business logic, formatting
legacy/                    The original single-file HTML prototype (reference only)
```

### Business logic

Each day's **opening stock** is automatically carried forward from the previous recorded day's **closing stock** (or from a product's seeded initial stock if no earlier day exists) — see `getOrCreateDailyRecord` in [`src/lib/stock.ts`](src/lib/stock.ts). Adding a new product later automatically backfills a stock entry into any already-created days.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / start |
| `npm run lint` | ESLint |
| `npm run db:up` | Start local Postgres via Docker Compose |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed products + admin user |
| `npm run db:studio` | Open Prisma Studio (a GUI for browsing the database) |

</details>
