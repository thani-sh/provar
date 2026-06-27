import { z } from "zod";
import { Command } from "./command";
import { getAbsPath } from "./utils";
import { schemaForFile } from "@libs/domain/zod";
import { loadProject } from "@libs/engine";

export type ReadFileInput = {
  path: string;
};
export type ReadFileOutput = {
  content: z.infer<typeof schemaForFile>;
};

function mapLoadedGraphToGraph(loaded: any): any {
  const nodes: Record<string, any> = {};
  for (const [id, task] of Object.entries(loaded.tasks || {})) {
    const t = task as any;
    nodes[id] = {
      title: t.title,
      info: t.info,
      next: t.next,
      config: t.config,
      graph: t.graph ? mapLoadedGraphToGraph(t.graph) : undefined,
    };
  }
  return {
    info: loaded.info || "",
    start: loaded.start,
    nodes,
  };
}

export class ReadFileCommand extends Command<ReadFileInput, ReadFileOutput> {
  readonly name = "readFile";
  readonly title = "Read Test File";
  readonly description = "Reads and validates a Provar test YAML file.";
  readonly inputSchema = z.object({
    path: z.string(),
  });
  readonly outputSchema = z.object({
    content: schemaForFile,
  });

  async execute(input: ReadFileInput): Promise<ReadFileOutput> {
    const fullPath = getAbsPath(this.context.projectDir, input.path);
    const project = await loadProject(fullPath);
    const loadedFile = project.files.find((f) => f.path === fullPath);
    if (!loadedFile) {
      throw new Error(`File not found in project: ${fullPath}`);
    }

    const mapped = {
      name: loadedFile.name,
      graph: mapLoadedGraphToGraph(loadedFile),
      code: loadedFile.code ?? null,
    };

    const validated = schemaForFile.parse(mapped);
    return { content: validated };
  }
}
