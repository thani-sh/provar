import { describe, expect, test } from "bun:test";
import {
  CONFIG_FILE,
  PROVAR_DIR,
  TESTS_DIR,
  configSchema,
  provarVariablesSchema,
  schemaForFile,
} from "../zod";

describe("constants", () => {
  test('PROVAR_DIR is the canonical ".provar" folder name', () => {
    expect(PROVAR_DIR).toBe(".provar");
  });

  test('TESTS_DIR is the conventional ".provar/tests" path', () => {
    expect(TESTS_DIR).toBe(".provar/tests");
  });

  test('CONFIG_FILE is the conventional ".provar/config.yml" path', () => {
    expect(CONFIG_FILE).toBe(".provar/config.yml");
  });
});

describe("configSchema", () => {
  test("accepts an empty object (all fields optional)", () => {
    const parsed = configSchema.parse({});
    expect(parsed).toEqual({});
  });

  test("accepts the three YAML primitives (string / number / boolean)", () => {
    // T011 consolidation: variables are now a typed union — `z.any()` was
    // the original looseness that made the union collapse at the boundary.
    const parsed = configSchema.parse({
      variables: { baseUrl: "https://x.test", retries: 3, enabled: true },
    });
    expect(parsed.variables).toEqual({
      baseUrl: "https://x.test",
      retries: 3,
      enabled: true,
    });
  });

  test("rejects arrays — arrays are out of the typed contract", () => {
    // If structured values are needed later, widen provarVariablesSchema
    // explicitly rather than reverting to z.any().
    const r = configSchema.safeParse({
      variables: { flags: ["a", "b"] },
    });
    expect(r.success).toBe(false);
  });

  test("rejects nested objects — same constraint as arrays", () => {
    const r = configSchema.safeParse({
      variables: { db: { host: "x" } },
    });
    expect(r.success).toBe(false);
  });
});

describe("provarVariablesSchema (canonical variables source of truth)", () => {
  test("is independently importable so consumers can reuse it", () => {
    expect(provarVariablesSchema.parse({ a: "x", b: 1, c: false })).toEqual({
      a: "x",
      b: 1,
      c: false,
    });
  });
});

describe("schemaForFile (serialized test file on disk)", () => {
  test("accepts a minimal valid test file shape", () => {
    const parsed = schemaForFile.parse({
      name: "demo",
      graph: {
        info: "",
        start: "task_aaaaa",
        nodes: {
          task_aaaaa: { title: "A", info: "" },
        },
      },
    });
    expect(parsed.name).toBe("demo");
    expect(parsed.code).toBeUndefined();
  });

  test("rejects node ids that do not match the task_xxxxx convention", () => {
    const r = schemaForFile.safeParse({
      name: "bad",
      graph: {
        info: "",
        start: "nope",
        nodes: { nope: { title: "x", info: "" } },
      },
    });
    expect(r.success).toBe(false);
  });
});
