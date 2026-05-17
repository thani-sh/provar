import { spawn, type Subprocess } from "bun";
import { getAbsPath, WORKSPACE_DIR } from "../utils";
import { readFile, writeFile } from "fs/promises";
import * as acp from "@agentclientprotocol/sdk";

export class ACPClient implements acp.Client {
  private process: Subprocess | null = null;
  private connection: acp.ClientSideConnection | null = null;
  private currentSessionId: string | null = null;
  private messageBuffer = "";

  constructor(
    private command: string[],
    private options: {
      name: string;
      version: string;
    },
  ) {}

  async start() {
    console.log(`[ACPClient] Starting process: ${this.command.join(" ")}`);
    this.process = spawn(this.command, {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    // Handle stderr for debugging
    this.readStderr();

    const outputAdapter = {
      getWriter: () => {
        return {
          write: async (chunk: Uint8Array) => {
            if (this.process?.stdin) {
              this.process.stdin.write(chunk);
              this.process.stdin.flush();
            }
          },
          releaseLock: () => {},
        };
      },
    };

    const stream = acp.ndJsonStream(
      outputAdapter as unknown as WritableStream,
      this.process.stdout as unknown as ReadableStream,
    );

    this.connection = new acp.ClientSideConnection((_agent) => this, stream);

    await this.connection.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientInfo: {
        name: this.options.name,
        version: this.options.version,
      },
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: true,
        },
      },
    });
  }

  // acp.Client implementation
  async readTextFile(
    params: acp.ReadTextFileRequest,
  ): Promise<acp.ReadTextFileResponse> {
    console.log(`[ACPClient] fs/read: ${params.path}`);
    const content = await readFile(getAbsPath(params.path), "utf-8");
    return { content };
  }

  async writeTextFile(
    params: acp.WriteTextFileRequest,
  ): Promise<acp.WriteTextFileResponse> {
    console.log(`[ACPClient] fs/write: ${params.path}`);
    await writeFile(getAbsPath(params.path), params.content, "utf-8");
    return {};
  }

  async requestPermission(
    params: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    console.log(
      `[ACPClient] request_permission for tool: ${params.toolCall?.title || params.toolCall?.toolCallId}`,
    );

    // Find an 'allow' option
    console.log("params.options", params.options);
    const allowOption =
      params.options.find(
        (o) => o.kind === "allow_always" || o.kind === "allow_once",
      ) || params.options[0];

    return {
      outcome: {
        outcome: "selected",
        optionId: allowOption.optionId,
      },
    } as acp.RequestPermissionResponse;
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    if (params.sessionId === this.currentSessionId) {
      const update = params.update as any;
      // ACP uses 'agent_message_chunk' for streaming text
      if (
        update.sessionUpdate === "agent_message_chunk" &&
        update.content?.text
      ) {
        this.messageBuffer += update.content.text;
      }
      // Handle some agents that might use 'update' field differently
      else if (update.type === "agent_message_chunk" && update.text) {
        this.messageBuffer += update.text;
      }
    }
  }

  async createSession(): Promise<string> {
    if (!this.connection) throw new Error("Not started");
    const result = await this.connection.newSession({
      cwd: WORKSPACE_DIR,
      mcpServers: [],
    });
    this.currentSessionId = result.sessionId;
    return result.sessionId;
  }

  async loadSession(sessionId: string): Promise<void> {
    if (!this.connection) throw new Error("Not started");
    await this.connection.loadSession({ sessionId });
    this.currentSessionId = sessionId;
  }

  async prompt(text: string): Promise<{ message: string; sessionId: string }> {
    if (!this.connection || !this.currentSessionId)
      throw new Error("No active session");

    this.messageBuffer = "";

    await this.connection.prompt({
      sessionId: this.currentSessionId,
      prompt: [
        {
          type: "text",
          text: text,
        },
      ],
    });

    return {
      message: this.messageBuffer,
      sessionId: this.currentSessionId,
    };
  }

  private async readStderr() {
    if (!this.process?.stderr) return;
    const reader = this.process.stderr.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        if (text.trim()) {
          console.error(`[ACPClient Debug] ${text.trim()}`);
        }
      }
    } catch (e) {
      console.error("[ACPClient] Error reading stderr:", e);
    }
  }

  async stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connection = null;
    this.currentSessionId = null;
  }
}
