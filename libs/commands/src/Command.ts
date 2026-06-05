import { z } from "zod";

export interface CommandContext {
  workspaceDir: string;
}

export abstract class Command<
  Input extends Record<string, any> = any,
  Output = any,
> {
  abstract readonly name: string;
  abstract readonly title: string;
  abstract readonly description: string;
  abstract readonly inputSchema: z.ZodType<Input, any, any>;
  abstract readonly outputSchema: z.ZodType<Output, any, any>;

  constructor(protected readonly context: CommandContext) {}

  abstract execute(input: Input): Promise<Output>;
}
