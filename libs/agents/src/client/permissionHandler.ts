import * as acp from "@agentclientprotocol/sdk";
import { isAbsolute, join, relative } from "path";

export interface PermissionHandlerOptions {
  workspaceDir: string;
}

export class PermissionHandler {
  constructor(private options: PermissionHandlerOptions) {}

  async requestPermission(
    params: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    console.log(
      `[ACPClient] request_permission for tool: ${params.toolCall?.title || params.toolCall?.toolCallId}`,
    );

    const toolId = params.toolCall?.toolCallId;
    const rawInput = (params.toolCall as any)?.rawInput;

    // Hardcoded whitelisting for FS tools
    if (
      toolId === "read_file" ||
      toolId === "write_file" ||
      toolId === "list_files" ||
      toolId === "create_directory" ||
      toolId === "delete_path"
    ) {
      // Try to parse input if it's a string
      let input = rawInput;
      if (typeof rawInput === "string") {
        try {
          input = JSON.parse(rawInput);
        } catch (e) {
          // Ignore
        }
      }

      const filePath = input?.path;
      if (filePath) {
        const absPath = isAbsolute(filePath)
          ? filePath
          : join(this.options.workspaceDir, filePath);
        const rel = relative(this.options.workspaceDir, absPath);

        if (rel.startsWith("..") || isAbsolute(rel)) {
          const rejectOption = params.options.find(
            (o) => o.kind === "reject_always" || o.kind === "reject_once",
          );

          if (rejectOption) {
            return {
              outcome: {
                outcome: "selected",
                optionId: rejectOption.optionId,
              },
            } as acp.RequestPermissionResponse;
          } else {
            return {
              outcome: {
                outcome: "cancelled",
              },
            } as acp.RequestPermissionResponse;
          }
        }
      }
    }

    // Find an 'allow' option
    const allowOption =
      params.options.find(
        (o) => o.kind === "allow_always" || o.kind === "allow_once",
      ) || params.options[0];

    return {
      outcome: {
        outcome: "selected",
        optionId: allowOption?.optionId,
      },
    } as acp.RequestPermissionResponse;
  }
}
