import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import yaml from "js-yaml";
import { ConfigSchema, TestGraphSchema } from "@libs/domain";
import type { Config, TestGraph } from "@libs/domain";

export interface WorkspaceTest {
  filePath: string;
  relativePath: string;
  getDefinition: () => TestGraph;
  getHash: () => string;
}

export interface Workspace {
  provarPath: string;
  config: Config;
  tests: WorkspaceTest[];
}

// Deeply resolve nested ${ENV.VAR_NAME} placeholders
function resolveEnvVars(val: any): any {
  if (typeof val === "string") {
    const envMatch = val.match(/^\$\{ENV\.(.+)\}$/);
    if (envMatch && envMatch[1]) {
      return process.env[envMatch[1]] || "";
    }
    return val;
  } else if (Array.isArray(val)) {
    return val.map(resolveEnvVars);
  } else if (val && typeof val === "object") {
    const resolved: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      resolved[k] = resolveEnvVars(v);
    }
    return resolved;
  }
  return val;
}

export function parseConfig(configYamlString: string): Config {
  const doc = yaml.load(configYamlString);
  const resolved = resolveEnvVars(doc);
  return ConfigSchema.parse(resolved);
}

export function parseTestGraph(testYamlString: string): TestGraph {
  const doc = yaml.load(testYamlString);
  return TestGraphSchema.parse(doc);
}

export async function loadWorkspace(workspacePath: string): Promise<Workspace> {
  let current = path.resolve(workspacePath);
  const rootDir = path.parse(current).root;
  let provarPath = "";

  // Crawl up to locate .provar directory
  while (current && current !== rootDir) {
    const candidate = path.join(current, ".provar");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      provarPath = candidate;
      break;
    }
    current = path.dirname(current);
  }

  if (!provarPath) {
    throw new Error(
      `Could not find a '.provar' workspace directory at or above: ${workspacePath}`,
    );
  }

  // Load config.yml
  let config: Config = { provider: { name: "default" }, variables: {} };
  const configPath = path.join(provarPath, "config.yml");
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, "utf-8");
    config = parseConfig(content);
  }

  // Scan tests (Lazy Loaded)
  const testsPath = path.join(provarPath, "tests");
  const testFiles: WorkspaceTest[] = [];

  function scan(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".test.yml")) {
        const relativePath = path.relative(testsPath, fullPath);
        testFiles.push({
          filePath: fullPath,
          relativePath,
          getDefinition: () => {
            const content = fs.readFileSync(fullPath, "utf-8");
            return parseTestGraph(content);
          },
          getHash: () => {
            const content = fs.readFileSync(fullPath, "utf-8");
            return crypto.createHash("sha256").update(content).digest("hex");
          },
        });
      }
    }
  }

  scan(testsPath);

  return {
    provarPath,
    config,
    tests: testFiles,
  };
}
