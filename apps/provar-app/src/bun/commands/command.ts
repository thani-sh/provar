import { z } from "zod";

/**
 * CommandContext provides context information (like workspace directory) for running editor commands.
 */
export interface CommandContext {
  workspaceDir: string;
}

/**
 * Command defines the base class for all actions exposed to the editor backend.
 */
export abstract class Command<
  Input extends Record<string, unknown> = Record<string, unknown>,
  Output = unknown,
> {
  abstract readonly name: string;
  abstract readonly title: string;
  abstract readonly description: string;
  abstract readonly inputSchema: z.ZodType<Input>;
  abstract readonly outputSchema: z.ZodType<Output>;

  constructor(protected readonly context: CommandContext) {}

  abstract execute(input: Input): Promise<Output>;
}
