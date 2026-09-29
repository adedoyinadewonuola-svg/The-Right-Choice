/**
 * Fixed-window attempt limiter for the credentials sign-in form.
 *
 * In-memory on purpose: this is a single-box shop tool, and the alternative (a table or Redis)
 * is more machinery than the threat deserves. It is per-process, so it resets on a restart and
 * does not share state if the app is ever scaled to several instances — see the note in the
 * README under "Deploying".
 */

type Bucket = { count: number; resetAt: number };

const globalForLimiter = globalThis as unknown as { trcLoginBuckets?: Map<string, Bucket> };

const buckets = globalForLimiter.trcLoginBuckets ?? new Map<string, Bucket>();
if (process.env.NODE_ENV !== "production") globalForLimiter.trcLoginBuckets = buckets;

export const MAX_ATTEMPTS = 8;
export const WINDOW_MS = 10 * 60 * 1000;

export type Limit = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export function attemptKey(email: string, forwardedFor?: string | null): string {
  const ip = (forwardedFor ?? "").split(",")[0]?.trim() ?? "";
  return `${email.trim().toLowerCase()}|${ip}`;
}

export function checkAttempts(key: string, now = Date.now()): Limit {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) return { allowed: true, remaining: MAX_ATTEMPTS, retryAfterSeconds: 0 };

  return {
    allowed: bucket.count < MAX_ATTEMPTS,
    remaining: Math.max(0, MAX_ATTEMPTS - bucket.count),
    retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

export function recordFailedAttempt(key: string, now = Date.now()): void {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  bucket.count += 1;
}

/** Human-readable lockout notice, shared by the login form and tests. */
export function retryMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many failed attempts. Wait about ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`;
}

export function clearAttempts(key: string): void {
  buckets.delete(key);
}

/**
 * Clears every bucket for an email, whatever IP it came from. Called from the credentials
 * `authorize` callback on success, because a successful `signIn` throws a redirect and no code
 * after it runs.
 */
export function clearAttemptsForEmail(email: string): void {
  const prefix = `${email.trim().toLowerCase()}|`;
  for (const key of buckets.keys()) {
    if (key.startsWith(prefix)) buckets.delete(key);
  }
}
