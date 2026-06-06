import { tool } from "ai";


export interface CommandInterface {
  name: string;
  description: string;
  inputSchema: any;
  execute(input: any): Promise<any>;
}

export function convertCommandToTool(command: CommandInterface) {
  return tool({
    description: command.description,
    inputSchema: command.inputSchema,
    execute: async (input: any) => {
      console.log(`[Agent Tool] Executing command: ${command.name}`, input);
      return await command.execute(input);
    },
  });
}

export function convertCommandsToTools(commands: Record<string, CommandInterface>) {
  const tools: Record<string, any> = {};
  for (const [key, command] of Object.entries(commands)) {
    const toolName = command.name || key;
    tools[toolName] = convertCommandToTool(command);
  }
  return tools;
}
