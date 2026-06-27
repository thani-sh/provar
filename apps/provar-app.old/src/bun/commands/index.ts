export * from "./command";
export * from "./get-config-command";
export * from "./save-config-command";
export * from "./read-file-command";
export * from "./write-file-command";
export * from "./create-file-command";
export * from "./create-directory-command";
export * from "./delete-path-command";
export * from "./list-files-command";

import type { CommandContext } from "./command";
import { GetConfigCommand } from "./get-config-command";
import { SaveConfigCommand } from "./save-config-command";
import { ReadFileCommand } from "./read-file-command";
import { WriteFileCommand } from "./write-file-command";
import { CreateFileCommand } from "./create-file-command";
import { CreateDirectoryCommand } from "./create-directory-command";
import { DeletePathCommand } from "./delete-path-command";
import { ListFilesCommand } from "./list-files-command";

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
