import type { AIAdapter } from "./adapter.js";
import { extractJson } from "./extractJson.js";

export type StructuredEvent<T> =
  | { type: "delta"; text: string }
  | { type: "done"; result: T; sessionId?: string }
  | { type: "error"; message: string };

export interface RunArgs<T> {
  prompt: string;
  sessionId?: string;
  signal?: AbortSignal;
  validate: (parsed: unknown) => T;
}

export async function* runStructuredAI<T>(
  adapter: AIAdapter,
  args: RunArgs<T>,
): AsyncIterable<StructuredEvent<T>> {
  let buf = "";
  for await (const ev of adapter.stream({ prompt: args.prompt, sessionId: args.sessionId, signal: args.signal })) {
    if (ev.type === "delta") {
      buf += ev.text;
      yield { type: "delta", text: ev.text };
    } else if (ev.type === "error") {
      yield { type: "error", message: ev.message };
      return;
    } else if (ev.type === "done") {
      try {
        const parsed = extractJson(ev.fullText || buf);
        const result = args.validate(parsed);
        yield { type: "done", result, sessionId: ev.sessionId };
        return;
      } catch (e) {
        yield { type: "error", message: e instanceof Error ? e.message : String(e) };
        return;
      }
    }
  }
}
