/**
 * Input validation for the Server Actions.
 *
 * Before this, values went straight to Prisma: a negative stock count was stored, a fractional
 * one was silently rounded by the integer column, and anything above int4 range threw
 * `P2020 ... out of range for type integer` — a 500 the clerk never saw because the UI fires
 * actions with `void`. Everything here turns those cases into a message instead.
 */

/** Stock counts live in int4 columns; stay far below 2,147,483,647. */
export const MAX_QUANTITY = 1_000_000_000;
/** Money columns are Decimal(12,2), i.e. up to 9,999,999,999.99. */
export const MAX_MONEY = 9_999_999_999;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T,>(value: T): Parsed<T> => ({ ok: true, value });
const err = (error: string): Parsed<never> => ({ ok: false, error });

/**
 * Whole units, 0 or more — opening/received/closing/transfer/supply/B/D.
 *
 * The type check is deliberate rather than `Number(value)`: `Number(null)` and `Number("")` are
 * both 0, so coercion would quietly turn a cleared or missing cell into "counted zero units".
 */
export function stockQuantity(value: unknown, label = "Stock quantity"): Parsed<number> {
  if (typeof value !== "number" || !Number.isFinite(value)) return err(`${label} must be a number.`);
  const n = value;
  if (!Number.isInteger(n)) return err(`${label} must be a whole number of units — ${n} is not.`);
  if (n < 0) return err(`${label} cannot be negative.`);
  if (n > MAX_QUANTITY) return err(`${label} is too large — the maximum is ${MAX_QUANTITY.toLocaleString("en-US")}.`);
  return ok(n);
}

/**
 * A non-negative amount, rounded to kobo. Empty input is a legitimate `null` when
 * `allowEmpty` is set, so an optional price can be cleared rather than forced to 0.
 */
export function moneyValue(
  value: unknown,
  label = "Amount",
  opts: { allowEmpty?: boolean; positive?: boolean } = {}
): Parsed<number | null> {
  if (value === null || value === undefined || value === "") {
    return opts.allowEmpty ? ok(null) : err(`${label} must be a number.`);
  }

  if (typeof value !== "number" || !Number.isFinite(value)) return err(`${label} must be a number.`);
  const n = value;
  if (n < 0) return err(`${label} cannot be negative.`);
  if (opts.positive && n <= 0) return err(`${label} must be greater than zero.`);
  if (n > MAX_MONEY) return err(`${label} is too large — the maximum is ${MAX_MONEY.toLocaleString("en-US")}.`);

  return ok(Math.round(n * 100) / 100);
}

/** A real calendar day as "YYYY-MM-DD" (the shape parseDateOnly and the @db.Date column expect). */
export function dateKey(value: unknown): Parsed<string> {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return err("Pick a valid date.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return err("Pick a real date.");
  }
  return ok(value);
}

export function requiredText(value: unknown, label: string, maxLength = 120): Parsed<string> {
  const s = String(value ?? "").trim();
  if (!s) return err(`${label} is required.`);
  if (s.length > maxLength) return err(`${label} must be ${maxLength} characters or fewer.`);
  return ok(s);
}

/** Like `requiredText` but empty is fine — for columns that allow "". */
export function textOrEmpty(value: unknown, label: string, maxLength = 200): Parsed<string> {
  const s = String(value ?? "").trim();
  if (s.length > maxLength) return err(`${label} must be ${maxLength} characters or fewer.`);
  return ok(s);
}

export function recordId(value: unknown, label = "Record"): Parsed<string> {
  const s = String(value ?? "").trim();
  if (!s) return err(`${label} id is missing.`);
  if (s.length > 64) return err(`${label} id is malformed.`);
  return ok(s);
}

/** Shape returned by actions that now report validation problems to the UI. */
export type ActionResult = { error?: string } | void;
