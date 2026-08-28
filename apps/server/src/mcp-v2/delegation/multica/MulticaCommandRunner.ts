import { spawn } from "node:child_process";
import type { MulticaCliConfig } from "./config.js";

interface RunOptions {
  stdin?: string;
  includeWorkspace?: boolean;
}

interface WorkspaceRecord {
  id: string;
}

export class MulticaCommandRunner {
  private workspacePromise?: Promise<string>;

  constructor(private readonly config: MulticaCliConfig) {}

  async runJson<T = unknown>(args: string[], options: RunOptions = {}): Promise<T> {
    const output = await this.runText(args, options);
    try {
      return JSON.parse(output) as T;
    } catch {
      throw new Error(`Multica CLI ${commandLabel(args)} did not return valid JSON.`);
    }
  }

  async runText(args: string[], options: RunOptions = {}): Promise<string> {
    const includeWorkspace = options.includeWorkspace !== false;
    const workspaceId = includeWorkspace ? await this.workspaceId() : undefined;
    const globalArgs = [
      ...(this.config.profile ? ["--profile", this.config.profile] : []),
      ...(workspaceId ? ["--workspace-id", workspaceId] : []),
    ];
    return this.spawn([...globalArgs, ...args], options.stdin);
  }

  private async workspaceId(): Promise<string> {
    if (this.config.workspaceId) return this.config.workspaceId;
    this.workspacePromise ??= this.discoverWorkspace();
    return this.workspacePromise;
  }

  private async discoverWorkspace(): Promise<string> {
    const workspaces = await this.runJson<WorkspaceRecord[]>(["workspace", "list", "--output", "json"], {
      includeWorkspace: false,
    });
    if (!Array.isArray(workspaces) || workspaces.length !== 1 || typeof workspaces[0]?.id !== "string") {
      throw new Error("Multica workspace is ambiguous. Set RICH_MULTICA_WORKSPACE_ID explicitly.");
    }
    return workspaces[0].id;
  }

  private spawn(args: string[], stdin: string | undefined): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.config.executable, args, {
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const stdout: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let settled = false;

      const finish = (error?: Error, output?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(output ?? "");
      };
      const exceedOutput = () => {
        child.kill("SIGKILL");
        finish(new Error(`Multica CLI ${commandLabel(args)} exceeded the output limit.`));
      };

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes + stderrBytes > this.config.maxOutputBytes) return exceedOutput();
        stdout.push(chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderrBytes += chunk.length;
        if (stdoutBytes + stderrBytes > this.config.maxOutputBytes) exceedOutput();
      });
      child.on("error", error => finish(new Error(`Multica CLI ${commandLabel(args)} could not start: ${error.message}`)));
      child.on("close", code => {
        if (settled) return;
        if (code !== 0) return finish(new Error(`Multica CLI ${commandLabel(args)} failed with exit code ${code ?? "unknown"}.`));
        finish(undefined, Buffer.concat(stdout).toString("utf8"));
      });

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        finish(new Error(`Multica CLI ${commandLabel(args)} timed out after ${this.config.timeoutMs}ms.`));
      }, this.config.timeoutMs);
      timer.unref();

      if (stdin !== undefined) child.stdin.end(stdin, "utf8");
      else child.stdin.end();
    });
  }
}

function commandLabel(args: string[]): string {
  const command = args.filter(arg => !arg.startsWith("--")).slice(-3, -1).join(" ");
  return command || "command";
}
