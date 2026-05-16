import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { AIAdapter, GenerateArgs, StreamEvent } from "./adapter.js";

const CODEX_BIN = "/Applications/Codex.app/Contents/Resources/codex";

export class CodexAdapter implements AIAdapter {
  readonly name = "codex" as const;

  async available(): Promise<boolean> {
    return existsSync(CODEX_BIN);
  }

  async *stream(args: GenerateArgs): AsyncIterable<StreamEvent> {
    const childArgs = args.sessionId
      ? ["exec", "--json", "resume", args.sessionId, "-"]
      : ["exec", "--json", "-"];
    const child = spawn(CODEX_BIN, childArgs, { stdio: ["pipe", "pipe", "pipe"] });
    args.signal?.addEventListener("abort", () => child.kill("SIGTERM"));
    child.stdin.end(args.prompt);

    let fullText = "";
    let sessionId: string | undefined;
    let buf = "";
    let stderrBuf = "";

    child.stderr.on("data", (c: Buffer) => { stderrBuf += c.toString("utf8"); });

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
      yield { type: "error", message: `codex exited ${code}: ${stderrBuf.slice(-500)}` };
      return;
    }
    yield { type: "done", fullText, sessionId };
  }
}
