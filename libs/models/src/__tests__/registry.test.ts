import { describe, expect, test } from "bun:test";
import { createClient, ProviderConfigError } from "../registry";

describe("createClient provider gate", () => {
  test("throws ProviderConfigError when the apiKey is missing", () => {
    expect(() => createClient({ provider: "google-generative-ai" })).toThrow(
      ProviderConfigError,
    );
  });

  test("throws ProviderConfigError when the apiKey is an empty string", () => {
    expect(() => createClient({ provider: "openai", apiKey: "" })).toThrow(
      ProviderConfigError,
    );
  });

  test("throws ProviderConfigError when the apiKey is whitespace-only", () => {
    expect(() => createClient({ provider: "minimax", apiKey: "   " })).toThrow(
      ProviderConfigError,
    );
  });

  test("ProviderConfigError carries the active provider name", () => {
    try {
      createClient({ provider: "minimax" });
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderConfigError);
      const e = err as ProviderConfigError;
      expect(e.provider).toBe("minimax");
      expect(e.message).toContain("minimax");
      return;
    }
    throw new Error("expected createClient to throw");
  });
});
