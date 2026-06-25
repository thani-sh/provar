import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getNodeGeneratedCode } from "../compiler/extract-generated-code";

// A representative slice of the file the compiler writes. Mirrors the format
// produced by `libs/engine/src/compiler/compiler.ts:tasksMap` so the test
// exercises the real shape, not a simplified toy. The body is indented by
// 4 spaces to match the compiler's formatter.
const SAMPLE_TS = `// hash: abc123
import type { TestAPI } from "@libs/engine";

export const tasks = {
  ["task_aaaaa"]: async (api: TestAPI) => {
    // go to homepage
    await api.goto("/");
  },
  ["task_bbbbb"]: async (api: TestAPI) => {
    /* multi-line
       comment */
    await api.locator("#email").fill("a@b.com");
  },
};

export const paths = [
  ["task_aaaaa", "task_bbbbb"],
];
`;

let tmpDir: string;

describe("getNodeGeneratedCode", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "provar-extract-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeSample(): string {
    const p = path.join(tmpDir, "demo.test.ts");
    fs.writeFileSync(p, SAMPLE_TS, "utf-8");
    return p;
  }

  test("returns the body text with the arrow wrapper stripped", () => {
    const tsPath = writeSample();
    const body = getNodeGeneratedCode(tsPath, "task_aaaaa");
    expect(body).not.toBeNull();
    // No arrow wrapper
    expect(body).not.toContain("async (api: TestAPI)");
    // No braces
    expect(body!.startsWith("{")).toBe(false);
    expect(body!.endsWith("}")).toBe(false);
    // Body content is there
    expect(body).toContain("// go to homepage");
    expect(body).toContain('await api.goto("/");');
  });

  test("dedents the body to remove the surrounding block's indentation", () => {
    const tsPath = writeSample();
    const body = getNodeGeneratedCode(tsPath, "task_aaaaa")!;
    // Every non-empty line should have no leading whitespace.
    for (const line of body.split("\n")) {
      if (line.trim().length === 0) continue;
      expect(line.startsWith(" ")).toBe(false);
      expect(line.startsWith("\t")).toBe(false);
    }
    // First non-empty line is the comment, last is the await call.
    const lines = body.split("\n").filter((l) => l.trim().length > 0);
    expect(lines[0]).toBe("// go to homepage");
    expect(lines.at(-1)).toBe('await api.goto("/");');
  });

  test("preserves inner comments and multi-line structure verbatim", () => {
    const tsPath = writeSample();
    const body = getNodeGeneratedCode(tsPath, "task_bbbbb")!;
    // Block comments survive; internal whitespace inside the comment is
    // also dedented along with the surrounding block (consistent with
    // how a real code formatter would reflow the body).
    expect(body).toContain("/* multi-line");
    expect(body).toContain("comment */");
    expect(body).toContain('await api.locator("#email").fill("a@b.com");');
  });

  test("returns null for an unknown id", () => {
    const tsPath = writeSample();
    expect(getNodeGeneratedCode(tsPath, "task_zzzzz")).toBeNull();
  });

  test("returns null when the .test.ts file does not exist", () => {
    expect(
      getNodeGeneratedCode(path.join(tmpDir, "missing.test.ts"), "task_aaaaa"),
    ).toBeNull();
  });

  test("finds the matching entry even when other consts are declared first", () => {
    const tsPath = path.join(tmpDir, "extra.test.ts");
    fs.writeFileSync(
      tsPath,
      `import type { TestAPI } from "@libs/engine";

export const paths = [
  ["task_aaaaa"],
];

export const tasks = {
  ["task_aaaaa"]: async (api: TestAPI) => {
    return 42;
  },
};
`,
      "utf-8",
    );
    const body = getNodeGeneratedCode(tsPath, "task_aaaaa");
    expect(body).not.toBeNull();
    expect(body).toContain("return 42;");
    expect(body).not.toContain("async (api: TestAPI)");
  });
});
