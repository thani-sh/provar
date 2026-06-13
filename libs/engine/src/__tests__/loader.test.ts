import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { buildGraphPaths, parseTestFile } from "../loader";
import type { Task } from "@libs/domain";

const task = (id: string, next: string[] = []): Task => ({
  id,
  title: id,
  info: "",
  next,
});

describe("buildGraphPaths", () => {
  test("returns a single path for a linear chain", () => {
    const tasks = {
      a: task("a", ["b"]),
      b: task("b", ["c"]),
      c: task("c"),
    };
    const paths = buildGraphPaths("a", tasks);
    expect(paths).toHaveLength(1);
    expect(paths[0]!.tasks.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  test("emits one path per leaf for a branching graph", () => {
    const tasks = {
      a: task("a", ["b", "c"]),
      b: task("b"),
      c: task("c"),
    };
    const paths = buildGraphPaths("a", tasks);
    expect(paths).toHaveLength(2);
    const seqs = paths.map((p) => p.tasks.map((t) => t.id));
    expect(seqs).toContainEqual(["a", "b"]);
    expect(seqs).toContainEqual(["a", "c"]);
  });

  test("treats diamonds (rejoins) as distinct paths, deduped by terminal sequence", () => {
    // A → B, A → C, B → D, C → D
    const tasks = {
      a: task("a", ["b", "c"]),
      b: task("b", ["d"]),
      c: task("c", ["d"]),
      d: task("d"),
    };
    const paths = buildGraphPaths("a", tasks);
    // The signature-dedupe key is the full task-id sequence, so A→B→D and
    // A→C→D are distinct paths and BOTH are emitted. (Truly identical
    // sequences are deduped — see the cycle test below for that path.)
    const seqs = paths.map((p) => p.tasks.map((t) => t.id));
    expect(seqs).toContainEqual(["a", "b", "d"]);
    expect(seqs).toContainEqual(["a", "c", "d"]);
  });

  test("breaks cycles at the rejoin (no infinite loop)", () => {
    // a → b → c → a (cycle). Traversal re-enters a, which is already on
    // the current path, so we emit the current path and stop descending.
    // The emitted path includes the repeated `a` at the end (the task we
    // *just* re-entered) so callers can see the back-edge.
    const tasks = {
      a: task("a", ["b"]),
      b: task("b", ["c"]),
      c: task("c", ["a"]),
    };
    const paths = buildGraphPaths("a", tasks);
    expect(paths).toHaveLength(1);
    expect(paths[0]!.tasks.map((t) => t.id)).toEqual(["a", "b", "c", "a"]);
  });

  test("dedupes truly identical paths (two-step cycle)", () => {
    // a → b → a. From a, only one path is reachable: a→b→a. Without
    // dedup the recursion would emit it twice (once per next-edge), but
    // the signature-key check collapses duplicates.
    const tasks = {
      a: task("a", ["b"]),
      b: task("b", ["a"]),
    };
    const paths = buildGraphPaths("a", tasks);
    expect(paths).toHaveLength(1);
    expect(paths[0]!.tasks.map((t) => t.id)).toEqual(["a", "b", "a"]);
  });

  test("ignores an unknown start id", () => {
    const tasks = { a: task("a") };
    expect(buildGraphPaths("missing", tasks)).toEqual([]);
  });

  test("treats a missing next target as a leaf (no throw)", () => {
    // a → ghost (not in tasks). The traversal should still produce a path
    // for the reachable prefix.
    const tasks = { a: task("a", ["ghost"]) };
    const paths = buildGraphPaths("a", tasks);
    expect(paths).toHaveLength(1);
    expect(paths[0]!.tasks.map((t) => t.id)).toEqual(["a"]);
  });

  test("handles a single-node graph (start = end, no next)", () => {
    const tasks = { a: task("a") };
    const paths = buildGraphPaths("a", tasks);
    expect(paths).toHaveLength(1);
    expect(paths[0]!.tasks.map((t) => t.id)).toEqual(["a"]);
  });
});

describe("parseTestFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "provar-loader-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const setup = (yaml: string): string => {
    const filePath = path.join(tmpDir, "demo.test.yml");
    fs.writeFileSync(filePath, yaml);
    return filePath;
  };

  const validYaml = (extras: Record<string, unknown> = {}) => `
name: demo
graph:
  info: graph info
  start: task_aaaaa
  nodes:
    task_aaaaa:
      title: A
      info: do a
      next: task_bbbbb
    task_bbbbb:
      title: B
      info: do b
${extras.block ?? ""}
`;

  test("parses a basic two-node graph with one resolved path", () => {
    const filePath = setup(validYaml());
    const file = parseTestFile(fs.readFileSync(filePath, "utf-8"), filePath);
    expect(file.name).toBe("demo");
    expect(file.start).toBe("task_aaaaa");
    expect(file.info).toBe("graph info");
    expect(Object.keys(file.tasks)).toEqual(["task_aaaaa", "task_bbbbb"]);
    expect(file.paths).toHaveLength(1);
    expect(file.paths[0]!.tasks.map((t) => t.id)).toEqual([
      "task_aaaaa",
      "task_bbbbb",
    ]);
  });

  test("coerces a single-string `next` into an array", () => {
    const yaml = `
name: solo
graph:
  info: ""
  start: task_aaaaa
  nodes:
    task_aaaaa:
      title: A
      info: ""
      next: task_bbbbb
    task_bbbbb:
      title: B
      info: ""
`;
    const filePath = setup(yaml);
    const file = parseTestFile(fs.readFileSync(filePath, "utf-8"), filePath);
    expect(file.tasks["task_aaaaa"]!.next).toEqual(["task_bbbbb"]);
  });

  test("defaults `next` to [] when missing", () => {
    const yaml = `
name: solo
graph:
  info: ""
  start: task_aaaaa
  nodes:
    task_aaaaa:
      title: A
      info: ""
`;
    const filePath = setup(yaml);
    const file = parseTestFile(fs.readFileSync(filePath, "utf-8"), filePath);
    expect(file.tasks["task_aaaaa"]!.next).toEqual([]);
  });

  test("treats `config.visualCompare: true` as boolean true", () => {
    const yaml = `
name: cfg
graph:
  info: ""
  start: task_aaaaa
  nodes:
    task_aaaaa:
      title: A
      info: ""
      config:
        visualCompare: true
`;
    const filePath = setup(yaml);
    const file = parseTestFile(fs.readFileSync(filePath, "utf-8"), filePath);
    expect(file.tasks["task_aaaaa"]!.config?.visualCompare).toBe(true);
  });

  test("treats non-true `config.visualCompare` as false", () => {
    const yaml = `
name: cfg
graph:
  info: ""
  start: task_aaaaa
  nodes:
    task_aaaaa:
      title: A
      info: ""
      config:
        visualCompare: false
`;
    const filePath = setup(yaml);
    const file = parseTestFile(fs.readFileSync(filePath, "utf-8"), filePath);
    expect(file.tasks["task_aaaaa"]!.config?.visualCompare).toBe(false);
  });

  test("reports code.valid=true only when the .test.ts hash matches the YAML hash", () => {
    const filePath = setup(validYaml());
    const tsPath = filePath.replace(".test.yml", ".test.ts");
    const yamlContent = fs.readFileSync(filePath, "utf-8");
    const crypto = require("crypto") as typeof import("crypto");
    const correctHash = crypto
      .createHash("sha256")
      .update(yamlContent)
      .digest("hex");

    // Hash matches → valid
    fs.writeFileSync(
      tsPath,
      `// hash: ${correctHash}\nexport const tasks = {};`,
    );
    let file = parseTestFile(yamlContent, filePath);
    expect(file.code).toEqual({ valid: true });

    // Hash does not match → invalid
    fs.writeFileSync(tsPath, `// hash: deadbeef\nexport const tasks = {};`);
    file = parseTestFile(yamlContent, filePath);
    expect(file.code).toEqual({ valid: false });

    // .test.ts does not exist → code: null
    fs.unlinkSync(tsPath);
    file = parseTestFile(yamlContent, filePath);
    expect(file.code).toBeNull();
  });

  test("preserves task object identity between tasks map and path entries", () => {
    // This is the BUG-4 contract — paths[*].tasks[*] must be === to tasks[id].
    const filePath = setup(validYaml());
    const file = parseTestFile(fs.readFileSync(filePath, "utf-8"), filePath);
    for (const path_ of file.paths) {
      for (const t of path_.tasks) {
        expect(file.tasks[t.id]).toBe(t);
      }
    }
  });

  test("throws on empty / non-object YAML", () => {
    const filePath = setup("");
    expect(() =>
      parseTestFile(fs.readFileSync(filePath, "utf-8"), filePath),
    ).toThrow(/Invalid test graph format/);
  });
});
