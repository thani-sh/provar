import { describe, expect, test } from "bun:test";
import { CONFIG_FILE, PROVAR_DIR, TESTS_DIR } from "../paths";

describe("path constants", () => {
  test('PROVAR_DIR is the canonical ".provar" folder name', () => {
    expect(PROVAR_DIR).toBe(".provar");
  });

  test('TESTS_DIR is the conventional ".provar/tests" path', () => {
    expect(TESTS_DIR).toBe(".provar/tests");
  });

  test('CONFIG_FILE is the conventional ".provar/config.yml" path', () => {
    expect(CONFIG_FILE).toBe(".provar/config.yml");
  });

  test("TESTS_DIR and CONFIG_FILE are derived from PROVAR_DIR", () => {
    // Single source of truth — if these assertions break, the structure
    // changed in a way that may break loadProject's discovery.
    expect(TESTS_DIR.startsWith(`${PROVAR_DIR}/`)).toBe(true);
    expect(CONFIG_FILE.startsWith(`${PROVAR_DIR}/`)).toBe(true);
  });
});