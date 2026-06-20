/**
 * Debug logging utility for the Provar editor app.
 *
 * Two integration points (both gated by env vars):
 *
 * - Bun main process: `PROVAR_DEBUG=1` enables verbose logging.
 * - Webview renderer: `VITE_PROVAR_DEBUG=1` enables verbose logging. Vite
 *   reads the env var at build / dev-server start, so the flag is captured
 *   once at startup.
 *
 * Default for both is OFF. When OFF, `debug()` is a true no-op (no string
 * formatting, no allocation beyond the args array spread). `console.error`
 * and `console.warn` for real failures are NOT routed through this module
 * — keep them so error visibility is unchanged.
 *
 * `redact()` returns a deep-cloned value with secret-shaped fields masked.
 * Use it on any payload that might contain API keys before passing the
 * payload to `debug()`.
 */

let cached: boolean | undefined;

function readBool(v: string | undefined): boolean | undefined {
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return undefined;
}

function readFromBun(): boolean | undefined {
  try {
    if (typeof process !== "undefined" && process.env) {
      return readBool(process.env.PROVAR_DEBUG);
    }
  } catch {
    // no-op
  }
  return undefined;
}

function readFromVite(): boolean | undefined {
  try {
    const meta = import.meta as { env?: { VITE_PROVAR_DEBUG?: string } };
    return readBool(meta.env?.VITE_PROVAR_DEBUG);
  } catch {
    // import.meta.env is Vite-only; in Bun this branch is a no-op
  }
  return undefined;
}

function compute(): boolean {
  return readFromBun() ?? readFromVite() ?? false;
}

/** True when verbose debug logging is enabled. Cached on first call. */
export function isDebug(): boolean {
  if (cached === undefined) cached = compute();
  return cached;
}

/**
 * Logs to console.log only when debug mode is enabled.
 * Behaves exactly like console.log otherwise (silent no-op, no formatting).
 */
export function debug(...args: unknown[]): void {
  if (isDebug()) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}

/**
 * Logs a label and a redacted deep-clone of `value` when debug mode is on.
 * Use for any payload that might contain settings (and therefore API keys).
 */
export function debugRedacted(label: string, value: unknown): void {
  if (!isDebug()) return;
  // eslint-disable-next-line no-console
  console.log(label, redact(value));
}

const SECRET_KEYS = new Set([
  "apikey",
  "api_key",
  "password",
  "token",
  "secret",
  "authorization",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
]);

function isSecretKey(k: string): boolean {
  return SECRET_KEYS.has(k.toLowerCase());
}

function isPlainObject(v: object): boolean {
  if (Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * Returns a deep clone of `value` with secret-shaped fields replaced by
 * the string `'***'`. Matches the following keys (case-insensitive):
 *
 *   apiKey, api_key, password, token, secret, authorization,
 *   accessToken, access_token, refreshToken, refresh_token.
 *
 * Only plain objects and arrays are walked. Class instances (Date, Map,
 * Set, Error, …) are returned by reference — callers can opt in to
 * custom handling if needed. Cyclic values are tolerated and rendered as
 * `'[Circular]'`. The original `value` is not mutated.
 */
export function redact<T>(value: T): T {
  const seen = new WeakSet<object>();
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v as object)) return "[Circular]";
    if (Array.isArray(v)) {
      seen.add(v as object);
      return v.map(walk);
    }
    if (!isPlainObject(v)) return v;
    seen.add(v as object);
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = isSecretKey(k) ? "***" : walk(val);
    }
    return out;
  };
  return walk(value) as T;
}
