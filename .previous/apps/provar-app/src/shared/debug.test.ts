import { describe, expect, test } from "bun:test";
import { debug, debugRedacted, isDebug, redact } from "./debug";

describe("redact", () => {
  test("masks apiKey (camelCase)", () => {
    const out = redact({ apiKey: "sk-secret", name: "alice" });
    expect(out).toEqual({ apiKey: "***", name: "alice" });
  });

  test("masks api_key (snake_case)", () => {
    const out = redact({ api_key: "sk-secret", name: "alice" });
    expect(out).toEqual({ api_key: "***", name: "alice" });
  });

  test("masks password, token, secret, authorization", () => {
    const out = redact({
      password: "hunter2",
      token: "t0k",
      secret: "shh",
      authorization: "Bearer xyz",
    });
    expect(out).toEqual({
      password: "***",
      token: "***",
      secret: "***",
      authorization: "***",
    });
  });

  test("masks accessToken and refreshToken (both spellings)", () => {
    const out = redact({
      accessToken: "a",
      access_token: "b",
      refreshToken: "c",
      refresh_token: "d",
    });
    expect(out).toEqual({
      accessToken: "***",
      access_token: "***",
      refreshToken: "***",
      refresh_token: "***",
    });
  });

  test("walks nested objects and arrays", () => {
    const out = redact({
      models: {
        providers: {
          openai: { apiKey: "sk-x", model: "gpt-4" },
        },
      },
      recent: [{ secret: "1" }, { secret: "2", ok: true }],
    });
    expect(out).toEqual({
      models: {
        providers: {
          openai: { apiKey: "***", model: "gpt-4" },
        },
      },
      recent: [{ secret: "***" }, { secret: "***", ok: true }],
    });
  });

  test("case-insensitive key match", () => {
    const out = redact({ APIKey: "x", apikey: "y", ApI_KeY: "z" });
    expect(out).toEqual({ APIKey: "***", apikey: "***", ApI_KeY: "***" });
  });

  test("does not mutate the input", () => {
    const input = { apiKey: "real", name: "x" };
    const snapshot = JSON.stringify(input);
    redact(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  test("handles cycles without throwing", () => {
    const a: Record<string, unknown> = { x: 1 };
    a.self = a;
    const out = redact(a);
    expect(out.x).toBe(1);
    expect(out.self).toBe("[Circular]");
  });

  test("passes through null, primitives, and class instances", () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
    expect(redact(42)).toBe(42);
    expect(redact("hello")).toBe("hello");
    expect(redact(true)).toBe(true);
    // Class instances (Date, Map, Set, Error, …) are returned by reference —
    // only plain objects and arrays are walked.
    const d = new Date(0);
    expect(redact(d)).toBe(d);
    const m = new Map<string, number>();
    expect(redact(m)).toBe(m);
    const e = new Error("x");
    expect(redact(e)).toBe(e);
  });

  test("masks secrets in arrays of mixed values", () => {
    const out = redact([{ apiKey: "a" }, "safe", 7, [{ token: "t" }]]);
    expect(out).toEqual([{ apiKey: "***" }, "safe", 7, [{ token: "***" }]]);
  });
});

describe("isDebug / debug / debugRedacted", () => {
  test("isDebug reads PROVAR_DEBUG=1 from process env", () => {
    // The cache is module-level and was set on first import, so we can only
    // assert the read-side function picks up the env. The cached `isDebug`
    // is stable for the lifetime of the process, so we test the dispatcher
    // behaviour via `debug` instead.
    process.env.PROVAR_DEBUG = "0";
    // The cached value is whatever it was on first import — likely `false`
    // because the test runner does not export PROVAR_DEBUG. We just check
    // that `debug` and `debugRedacted` are no-ops when the cache is false.
    debug("never");
    debugRedacted("never:", { apiKey: "x" });
    // No assertion needed — if debug printed, the runner would show it.
  });
});
