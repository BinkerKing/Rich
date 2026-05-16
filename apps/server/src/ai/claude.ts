import { query } from "@anthropic-ai/claude-agent-sdk";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AIAdapter, GenerateArgs, StreamEvent } from "./adapter.js";

const execFileP = promisify(execFile);

export class ClaudeAdapter implements AIAdapter {
  readonly name = "claude-code" as const;
  private availabilityCache: boolean | undefined;

  async available(): Promise<boolean> {
    if (this.availabilityCache !== undefined) return this.availabilityCache;
    try {
      await execFileP("claude", ["--version"]);
      this.availabilityCache = true;
    } catch {
      this.availabilityCache = false;
    }
    return this.availabilityCache;
  }

  async *stream(args: GenerateArgs): AsyncIterable<StreamEvent> {
    let fullText = "";
    let sessionId: string | undefined;
    let assistantMsgError: string | undefined;
    const ac = new AbortController();
    const onAbort = () => ac.abort();
    args.signal?.addEventListener("abort", onAbort);
    try {
      for await (const msg of query({
        prompt: args.prompt,
        options: { resume: args.sessionId, abortController: ac },
      })) {
        if (msg.type === "assistant") {
          if (msg.error) assistantMsgError = msg.error;
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
          // SDKResultError: errors[] carries the actual messages. Surface them.
          const errorList = Array.isArray(msg.errors) && msg.errors.length > 0
            ? msg.errors.join(" | ")
            : (assistantMsgError ?? "no details");
          yield {
            type: "error",
            message: `Claude ${msg.subtype} (turns=${msg.num_turns}, stop_reason=${msg.stop_reason ?? "?"}): ${errorList}`,
          };
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
