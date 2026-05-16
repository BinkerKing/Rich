import { query } from "@anthropic-ai/claude-agent-sdk";
import { execSync } from "node:child_process";
import type { AIAdapter, GenerateArgs, StreamEvent } from "./adapter.js";

export class ClaudeAdapter implements AIAdapter {
  readonly name = "claude-code" as const;

  async available(): Promise<boolean> {
    try {
      execSync("claude --version", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  async *stream(args: GenerateArgs): AsyncIterable<StreamEvent> {
    let fullText = "";
    let sessionId: string | undefined;
    const ac = new AbortController();
    const onAbort = () => ac.abort();
    args.signal?.addEventListener("abort", onAbort);
    try {
      for await (const msg of query({
        prompt: args.prompt,
        options: { resume: args.sessionId, abortController: ac },
      })) {
        if (msg.type === "assistant") {
          for (const block of msg.message.content) {
            if (block.type === "text" && typeof block.text === "string") {
              fullText += block.text;
              yield { type: "delta", text: block.text };
            }
          }
        } else if (msg.type === "result") {
          sessionId = msg.session_id;
          if (msg.subtype === "success") {
            const finalText = msg.result && msg.result.length > fullText.length ? msg.result : fullText;
            yield { type: "done", fullText: finalText, sessionId };
            return;
          }
          yield { type: "error", message: `Claude result subtype: ${msg.subtype}` };
          return;
        }
      }
      yield { type: "done", fullText, sessionId };
    } catch (err) {
      yield { type: "error", message: err instanceof Error ? err.message : String(err) };
    } finally {
      args.signal?.removeEventListener("abort", onAbort);
    }
  }
}
