import { describe, expect, test } from "bun:test";
import {
  CONFIG_FILE,
  PROVAR_DIR,
  TESTS_DIR,
  configSchema,
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

  test("accepts arbitrary variable shapes (the schema is intentionally loose)", () => {
    // configSchema uses z.any() for variable values on purpose — variables
    // flow through the runtime and YAML may supply any primitive.
    const parsed = configSchema.parse({
      variables: { baseUrl: "https://x.test", retries: 3, flags: ["a", "b"] },
    });
    expect(parsed.variables).toEqual({
      baseUrl: "https://x.test",
      retries: 3,
      flags: ["a", "b"],
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
