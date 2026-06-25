import * as fs from "fs";
import ts from "typescript";

/**
 * getNodeGeneratedCode returns the source text of the body of the compiled
 * execute function for a given task id, extracted from the .test.ts file
 * that the compiler produces next to the .test.yml on disk.
 *
 * The compiler writes a deterministic, structural artifact:
 *
 *   // hash: <yamlHash>
 *   import type { TestAPI } from "@libs/engine";
 *
 *   export const tasks = {
 *     ["task_abc12"]: async (api: TestAPI) => {
 *       ...body...
 *     },
 *     ...
 *   };
 *
 *   export const paths = [ ... ];
 *
 * We parse the file with the TypeScript compiler API and walk the `tasks`
 * object literal to locate the property whose key matches the requested id.
 * This is more reliable than regex because it tolerates whitespace, comments,
 * and any future reformatting of the surrounding code.
 *
 * The returned text is the function body only — the arrow wrapper
 * (`async (api: TestAPI) => { ... }`) is stripped, common leading indentation
 * is removed, and leading/trailing blank lines are trimmed — so the caller
 * can drop it straight into a code view without further processing.
 *
 * @param tsPath absolute path to the compiled .test.ts file
 * @param nodeId the task id to extract (e.g. "task_abc12")
 * @returns the function-body source text, or null if the id is not present
 */
export function getNodeGeneratedCode(
  tsPath: string,
  nodeId: string,
): string | null {
  if (!fs.existsSync(tsPath)) return null;

  const source = fs.readFileSync(tsPath, "utf-8");
  const sourceFile = ts.createSourceFile(
    tsPath,
    source,
    ts.ScriptTarget.ESNext,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

  // Find `export const tasks = { ... };` and walk its properties.
  for (const stmt of sourceFile.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (
        !ts.isIdentifier(decl.name) ||
        decl.name.text !== "tasks" ||
        !decl.initializer ||
        !ts.isObjectLiteralExpression(decl.initializer)
      ) {
        continue;
      }
      for (const prop of decl.initializer.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        if (!isStringKeyMatching(prop.name, nodeId)) continue;
        // The value is always an arrow function with a block body (the
        // compiler always emits `{ ... }`, never an expression body). If
        // that ever changes, return the full value text as a fallback.
        const value = prop.initializer;
        if (
          !ts.isArrowFunction(value) ||
          !ts.isBlock(value.body)
        ) {
          return source.substring(value.getStart(sourceFile), value.getEnd());
        }
        return extractBlockBody(source, value.body);
      }
    }
  }
  return null;
}

/**
 * extractBlockBody slices the source text between a block's opening `{` and
 * closing `}`, dedents by the common leading whitespace, and trims leading
 * and trailing blank lines.
 */
function extractBlockBody(source: string, block: ts.Block): string {
  const open = block.getStart(); // points at the opening `{`
  const close = block.getEnd() - 1; // points at the closing `}`
  // Skip the `{` itself and the `}` itself; everything between is body.
  const raw = source.substring(open + 1, close);
  const lines = raw.split("\n");

  // Drop the first line (anything between `{` and the first newline is just
  // whitespace from the original `{\n`) and the last line (mirrors the same
  // on the closing brace). Then dedent by the smallest non-empty leading
  // whitespace.
  if (lines.length > 0 && lines[0]!.trim() === "") {
    lines.shift();
  }
  if (lines.length > 0 && lines[lines.length - 1]!.trim() === "") {
    lines.pop();
  }

  const indents = lines
    .filter((l) => l.trim().length > 0)
    .map((l) => (l.match(/^(\s*)/) ?? ["", ""])[0]!.length);
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;

  const dedented = lines.map((l) => l.slice(minIndent)).join("\n");
  return dedented;
}

/**
 * isStringKeyMatching returns true when the property's key resolves to the
 * expected id string. The compiler emits keys as computed property names
 * wrapping a string literal (e.g. `["task_abc12"]: ...`), but the API is
 * permissive: a bare string-literal key (`"task_abc12": ...`) or an
 * identifier (`task_abc12: ...`) all match the same id.
 */
function isStringKeyMatching(key: ts.PropertyName, expected: string): boolean {
  if (ts.isStringLiteralLike(key) && key.text === expected) {
    return true;
  }
  if (ts.isIdentifier(key) && key.text === expected) {
    return true;
  }
  if (
    ts.isComputedPropertyName(key) &&
    ts.isStringLiteralLike(key.expression) &&
    key.expression.text === expected
  ) {
    return true;
  }
  return false;
}
