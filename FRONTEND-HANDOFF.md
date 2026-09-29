# Frontend handoff — The Right Choice

Everything below was read out of the code, not from memory. If something here disagrees with the
repo, the repo wins — but tell me and I'll fix the doc.

**App:** daily stock, sales and end-of-day management for a shop. Staff sign in, record opening /
received / closing counts per product per day, and the app works out units sold, expected revenue,
POS takings and expenses.

---

## 1. Read this before writing code

**This is not the Next.js you're used to.** It is **Next 16.2 with Turbopack**, React 19.2,
Tailwind 4, Prisma 7 and Auth.js (NextAuth v5) beta. The behaviour differs from older versions in
ways that will waste an afternoon if you assume otherwise.

- **Read the bundled docs before you write anything:**
  `node_modules/next/dist/docs/` — it ships with the repo and matches the exact version installed.
  The paths you'll want are under `01-app/` (App Router: layouts, `headers()`, Server Actions,
  `next.config.js` options).
- `next dev` re-adds a `<!-- BEGIN:nextjs-agent-rules -->` block to `AGENTS.md` on every start.
  **Commit it** — removing it just re-creates the uncommitted change. (`CLAUDE.md` is just
  `@AGENTS.md`.) That block is the authoritative statement of the project rules; this section does
  not replace it.
- The dev server is Turbopack. There is no webpack config and you should not add one.
- `npm run build` needs roughly 1.1 GB of heap. If it dies, run
  `NODE_OPTIONS=--max-old-space-size=1100 npx next build`.

**Project rules files** (`AGENTS.md`, `CLAUDE.md`) are authoritative and I have followed them;
re-read them before you start.

---

## 2. Running it

```bash
npm install
cp .env.example .env && chmod 600 .env
npm run db:up        # Postgres via Docker Compose — needs Docker Desktop running
npm run db:migrate   # creates the tables
npm run db:seed      # 155 products + the admin login
npm run dev          # http://localhost:3000
```

Login: `admin@therightchoice.local` / `changeme123` (change it — the seed takes
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

Production: `npm run db:deploy` (not `db:migrate` — that needs a shadow database), then
`npm run build && npm start`. **`AUTH_SECRET` must be set or sign-in fails in production only.**

---

## 3. The four rules you must not break

These are the fixes from the last review round. Each one fixed a bug that actually happened to a
real user, so please don't undo them "while tidying up".

### 3.1 Every action starts with `await requireUser()`

```ts
const user = await requireUser();   // first line, before anything else
```

The `(app)` layout only guards *rendering*. A Server Action is a separate POST that React dispatches
to the page URL, and it can run without the layout. An action without this guard is writable by
anyone who can reach the site.

### 3.2 Never fire an action and forget it

The bug that started all this: inputs saved with `void someAction(...)`, so a rejected or failed
save disappeared with no message. **Every** call must handle the result.

### 3.3 Optimistic edits go in an override map, not in state synced by effect

The shape to copy (`StockTable`, `PriceTable`, `ExpensePanel`, `DailyStockPanel`):

```ts
const [overrides, setOverrides] = useState<Record<string, string>>({});   // local, keyed by row+field
const rows = useMemo(() => initialRows.map(r => apply(r, overrides)), [initialRows, overrides]);
// on save: setOverrides[key] = value   (optimistic)
// on success: delete overrides[key]    (server already agrees)
// on { error }: delete overrides[key] and show the message   (fall back to server truth)
```

**Do not** write `useEffect(() => setRows(initialRows), [initialRows])`. ESLint's
`react-hooks/set-state-in-effect` rule (enabled in v6) errors on it, and it also fights React's
render model. Derive during render instead, as above.

### 3.4 Validate server-side, in `src/lib/validate.ts`

Client `min`/`step` are hints a browser, a stale tab, or curl can ignore. The shared validators are
`stockQuantity`, `moneyValue`, `dateKey`, `recordId`, `requiredText`, `textOrEmpty`. Actions return
`{ error }` and **do not write**. Two things that bit us and are now deliberate:

- `stockQuantity` / `moneyValue` require `typeof value === "number"`. Do **not** reintroduce
  `Number(value)` — `Number(null)` and `Number("")` are both `0`, which turns a cleared cell into a
  counted zero.
- `updateStockField` whitelists the column name server-side. `field` is interpolated into a Prisma
  `data` object, so without that check a crafted call could write `unitPrice` or a foreign key. The
  TypeScript union does not exist at runtime.

---

## 4. The contracts you'll be calling

### Server Actions — `src/actions/`

| Action | Signature | Returns |
| --- | --- | --- |
| `updateStockField` | `(date, productId, field: StockField, value: number)` | `SaveResult` = `{ error? } \| void` |
| `setUnitPrice` | `(date, productId, price: number \| null)` | `SaveResult` |
| `setPos` | `(date, pos: number)` | `SaveResult` |
| `addExpense` | `(date, note: string, amount: number)` | `{ id, … } \| { error }` |
| `removeExpense` | `(expenseId)` | `{ error? }` |
| `createProduct` | `({ name, category, cost, price })` | `{ id } \| { error }` |
| `updatePrice` / `updateCost` | `(productId, value: number \| null)` | `{ error? }` |
| `updateProductInfo` | `(productId, name, category)` | `{ error? }` |
| `deleteProduct` | `(productId)` | `{ error? }` |
| `carryForward` | `(date, overwriteClosing = false)` | `boolean` (false = no earlier day) |
| `loginAction` | `useActionState` form action | `string \| undefined` (the message) |
| `logoutAction` | `()` | — |

`StockField` is exactly `"opening" | "received" | "closing" | "transfer" | "supply" | "bd"`.

Note: actions that return an object you need a field from (`created.id`) return
`{ id, error? }` — a widened return type is what broke callers last time.

### Components — `src/components/`

| Component | Props |
| --- | --- |
| `StockTable` | `{ date, initialRows: StockRow[], onTotalsChange }` |
| `PriceTable` | `{ initialRows: PriceRow[] }` |
| `ExpensePanel` | `{ date, initialExpenses: ExpenseRow[], cashCollected }` |
| `DailyStockPanel` | `{ date, initialRows, initialPos, initialExpenses, loggedByName }` |
| `DateControls` | `{ date, hasCountedData: boolean }` |
| `MetricCard` | `{ label, value: ReactNode, hint? }` |
| `Pagination` | `{ page, totalPages, onPageChange }` |
| `Nav` | — (reads `usePathname`) |

`StockRow` is `{ productId, name, category, price, unitPrice, opening, received, closing, transfer,
supply, bd }` — `price` is the live list price, `unitPrice` is the frozen price for that day, and
`effectivePrice(row)` picks between them. `PriceRow` is `{ id, name, category, cost, price }` with
both money fields nullable.

### Styling

No component library, no inline styles, no new CSS framework. Plain classes from
`src/app/globals.css`: `card`, `btn`, `btn light`, `input`, `label`, `grid`, `field`, `form-grid`,
`notice`, `notice danger`, `toolbar`, `controls`, `num`, `section`, over colour variables
(`--brown`, `--gold`, `--cream`, `--ink`, `--muted`, `--line`, `--green`, `--red`).
Error messages use `<div className="notice danger" role="alert">` and inputs set `aria-invalid`.

---

## 5. Business rules that affect the UI

- **Prices are frozen per day.** `StockEntry.unitPrice` is copied from `Product.price` when the
  entry is created, and all three pages (Daily Stock, History, Dashboard) compute revenue through
  the same `resolvedUnitPrice` helper. Editing a price on the Price List must never change an
  already-counted day — that's the whole point of the column. Clearing a row's price cell makes it
  follow the list again; typing a figure overrides it for that day only.
- **Opening a day is idempotent.** Two clerks can open the same date at once; the loser of the race
  catches the duplicate-key error and reads the winner's row. Don't add a "check it doesn't exist
  first" guard on the client.
- **Carry Forward is non-destructive.** The default button brings Opening in and leaves Closing
  alone. Overwriting Closing is a second, separately-labelled button behind a `window.confirm`.
- **Opening stock flows forward** from the previous recorded day's Closing.
- **A day is not "counted" until it has real data** — `dayHasCountedData` decides whether the
  destructive carry-forward button appears at all.
- The six count columns are `opening, received, closing, transfer, supply, bd`. The last one is
  labelled **"B/D"** in the sheet; the code doesn't define what it stands for, so **ask the shop
  owner before changing its label or behaviour.** All six are non-negative whole units, and all six
  reduce what counts as sold (`opening + received − closing − transfer − supply − bd`, floored at
  0).

---

## 6. Gotchas that cost real time here

- **Server Action ids are only in the per-page build output**
  (`.next/dev/server/app/**/server-reference-manifest.json`) and **change on every dev restart**.
  If you're testing actions from curl/scripts, re-extract them each time; a stale id 404s with
  "Server action not found", and posting to the wrong page's bundle 404s the same way.
- **A `FormData` argument can't be sent through a JSON-invoked action** — it fails with
  `Connection closed`. That's why the login form's friendly message is hard to test from curl.
- **`unauthorized()` doesn't work mid-stream** without `experimental.authInterrupts`; that's why
  `requireUser()` uses `redirect("/login")`.
- **An exported Server Action gets no usable id** unless a client component actually references it.
  To unit-test a pure function, add a temporary `app/api/<name>/route.ts` — but **not** in a
  `__`-prefixed folder, which Next treats as private and 404s.
- Action ids live only in the dev build output and are regenerated on every `next dev` start, so
  re-extract them after any restart or build rather than caching them in a script.
- `prisma migrate diff` — use `--from-schema-datasource … --to-schema-datamodel … --exit-code`.
  `--from-config-datasource` prints usage and exits 0, which looks like a pass.
- Never edit an already-applied migration; the checksum check will fail. Add a new one.
- Postgres does not index foreign keys by default — cascade deletes on the 155-row tables are
  unindexed unless you add `@@index`. Done for `StockEntry` and `Expense`; keep it in mind for any
  new relation.

---

## 7. Verifying your change

`tsc`, `lint` and `build` all have to pass — that's necessary, not sufficient. The changes that
mattered here were all invisible to a green build.

**There is a committed check script** — `npm run verify` (`scripts/verify.sh`, 32 assertions
covering all the bugs fixed so far: timezone, validation, the column whitelist, frozen prices, the
day-creation race and the sign-in throttle). It signs in for real, calls the real actions, and reads
the database back with `psql` to confirm rejected input was **not** written.

```bash
npm run dev          # in one terminal
npm run verify       # in another — expect: PASS=32 FAIL=0
```

It needs `psql` on your PATH and a `.env` with `DATABASE_URL`; override the account with
`ADMIN_EMAIL` / `ADMIN_PASSWORD` if you reseeded. It is idempotent and leaves your data as it found
it. Run it before opening a pull request.

**Checklist for any change that saves data:**

1. Send a value the app should reject. Does the database actually stay unchanged, and does the
   clerk see a message? (`psql` the row — don't trust the HTTP status, a rejected save returns 200.)
2. Clear a cell and save. Does it become `0`, or is it rejected?
3. Does a *second* clerk opening the same date get a working page?
4. Does the rejected value visibly fall back to what's stored, or does the box keep lying?
5. After editing a price on the Price List, is a previously counted day unchanged?

---

## 8. State of the repo

- Branch `main`. Work is **staged but not committed** — review the diff before you commit.
- `npm audit` reports 4 high findings, all in the **Prisma CLI** tree (`deepmerge-ts`, `mysql2`).
  They don't affect the runtime (this app talks to Postgres) and the only fix npm offers is a
  breaking `prisma@6` downgrade, so it's deliberately left alone.
- `EBADENGINE` warnings from `@prisma/streams-local` (wants Node ≥22) are upstream noise; the app
  targets Node ≥20.9.
- Everything in "Everyday use" in the README is current as of this handoff.
