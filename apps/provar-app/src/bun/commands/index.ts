export * from "./Command";
export * from "./GetConfigCommand";
export * from "./SaveConfigCommand";
export * from "./ReadFileCommand";
export * from "./WriteFileCommand";
export * from "./CreateFileCommand";
export * from "./CreateDirectoryCommand";
export * from "./DeletePathCommand";
export * from "./ListFilesCommand";

import type { CommandContext } from "./Command";
import { GetConfigCommand } from "./GetConfigCommand";
import { SaveConfigCommand } from "./SaveConfigCommand";
import { ReadFileCommand } from "./ReadFileCommand";
import { WriteFileCommand } from "./WriteFileCommand";
import { CreateFileCommand } from "./CreateFileCommand";
import { CreateDirectoryCommand } from "./CreateDirectoryCommand";
import { DeletePathCommand } from "./DeletePathCommand";
import { ListFilesCommand } from "./ListFilesCommand";

export function createCommands(context: CommandContext) {
  return {
    getConfig: new GetConfigCommand(context),
    saveConfig: new SaveConfigCommand(context),
    readFile: new ReadFileCommand(context),
    writeFile: new WriteFileCommand(context),
    createFile: new CreateFileCommand(context),
    createDirectory: new CreateDirectoryCommand(context),
    deletePath: new DeletePathCommand(context),
    listFiles: new ListFilesCommand(context),
  };
}
export type Commands = ReturnType<typeof createCommands>;
