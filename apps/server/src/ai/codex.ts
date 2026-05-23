import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AIAdapter, GenerateArgs, StreamEvent } from "./adapter.js";
import { childRegistry } from "../lib/childRegistry.js";

const execFileP = promisify(execFile);

const DEFAULT_CODEX_BIN = "/Applications/Codex.app/Contents/Resources/codex";

async function fileIsExecutable(p: string): Promise<boolean> {
  try {
    await access(p, fsConstants.X_OK);
    return true;
  } catch { return false; }
}

/**
 * Resolve the codex binary. Priority:
 *   1. $KE_CODEX_BIN env override
 *   2. $PATH lookup (`which codex`)
 *   3. /Applications/Codex.app/Contents/Resources/codex (macOS desktop install)
 * Returns null if none found.
 */
async function resolveCodexBin(): Promise<string | null> {
  const envBin = process.env.KE_CODEX_BIN;
  if (envBin && await fileIsExecutable(envBin)) return envBin;
  try {
    const { stdout } = await execFileP("/usr/bin/which", ["codex"]);
    const path = stdout.trim();
    if (path && await fileIsExecutable(path)) return path;
  } catch { /* fall through */ }
  if (await fileIsExecutable(DEFAULT_CODEX_BIN)) return DEFAULT_CODEX_BIN;
  return null;
}

export class CodexAdapter implements AIAdapter {
  readonly name = "codex" as const;
  private resolved: string | null | undefined; // tri-state: undefined=not yet checked

  private async bin(): Promise<string | null> {
    if (this.resolved === undefined) this.resolved = await resolveCodexBin();
    return this.resolved;
  }

  async available(): Promise<boolean> {
    return (await this.bin()) !== null;
  }

  async *stream(args: GenerateArgs): AsyncIterable<StreamEvent> {
    const binary = await this.bin();
    if (!binary) {
      yield { type: "error", message: "codex CLI not found (set KE_CODEX_BIN or install codex on PATH)" };
      return;
    }

    // --skip-git-repo-check: codex's default "trusted directory" guard fires
    // when the cwd isn't inside a git repo (or an explicitly trusted folder).
    // The packaged Rich.app runs with cwd = "/" so the guard blocks every
    // invocation with "Not inside a trusted directory and --skip-git-repo-check
    // was not specified". We're using codex strictly as an LLM API here — no
    // file edits — so skipping the check is safe.
    const childArgs = args.sessionId
      ? ["exec", "--skip-git-repo-check", "--json", "resume", args.sessionId, "-"]
      : ["exec", "--skip-git-repo-check", "--json", "-"];

    const child = spawn(binary, childArgs, { stdio: ["pipe", "pipe", "pipe"] });
    const unregister = childRegistry.register(child);

    const onAbort = () => { try { child.kill("SIGTERM"); } catch { /* already exited */ } };
    args.signal?.addEventListener("abort", onAbort);

    child.stdin.end(args.prompt);

    let fullText = "";
    let sessionId: string | undefined;
    let buf = "";
    const stderrChunks: Buffer[] = [];

    child.stderr.on("data", (c: Buffer) => { stderrChunks.push(c); });

    try {
      for await (const chunk of child.stdout) {
        buf += chunk.toString("utf8");
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let obj: { type?: string; thread_id?: string; item?: { type?: string; text?: string } };
          try { obj = JSON.parse(line); } catch { continue; }
          if (obj.type === "thread.started" && obj.thread_id) {
            sessionId = obj.thread_id;
          } else if (obj.type === "item.completed" && obj.item?.type === "agent_message" && typeof obj.item.text === "string") {
            fullText += obj.item.text;
            yield { type: "delta", text: obj.item.text };
          }
        }
      }

      const code = await new Promise<number>((res) => child.on("exit", (c) => res(c ?? 0)));
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        // Surface the tail of stderr (more relevant than head, as errors come late),
        // but log the full stderr to help post-mortem debugging.
        const tail = stderr.length > 2000 ? "…" + stderr.slice(-2000) : stderr;
        yield { type: "error", message: `codex exited ${code}: ${tail}` };
        return;
      }
      yield { type: "done", fullText, sessionId };
    } finally {
      args.signal?.removeEventListener("abort", onAbort);
      unregister();
    }
  }
}
