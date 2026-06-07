import { tool } from "ai";

/**
 * CommandInterface defines a custom executable command schema used by the AI agent as a tool.
 */
export interface CommandInterface {
  name: string;
  description: string;
  inputSchema: unknown;
  execute(input: unknown): Promise<unknown>;
}

/**
 * convertCommandToTool converts a CommandInterface instance into a compatible AI SDK Tool.
 */
export function convertCommandToTool(command: CommandInterface): unknown {
  return tool({
    description: command.description,
    inputSchema: command.inputSchema as any,
    execute: async (input: unknown) => {
      console.log(`[Agent Tool] Executing command: ${command.name}`, input);
      return await command.execute(input);
    },
  });
}

/**
 * convertCommandsToTools wraps a dictionary of CommandInterface instances into AI SDK Tools.
 */
export function convertCommandsToTools(
  commands: Record<string, CommandInterface>,
): Record<string, unknown> {
  const tools: Record<string, unknown> = {};
  for (const [key, command] of Object.entries(commands)) {
    const toolName = command.name || key;
    tools[toolName] = convertCommandToTool(command);
  }
  return tools;
}
