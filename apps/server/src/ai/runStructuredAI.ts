import type { AIAdapter } from "./adapter.js";
import { extractJson } from "./extractJson.js";
import { startOpRecord } from "./aiOpLog.js";

export type StructuredEvent<T> =
  | { type: "delta"; text: string }
  | { type: "done"; result: T; sessionId?: string }
  | { type: "error"; message: string };

export interface RunArgs<T> {
  prompt: string;
  sessionId?: string;
  signal?: AbortSignal;
  validate: (parsed: unknown) => T;
  /** Op kind label for the admin log (e.g. "refine" / "section-feedback").
   *  When provided, the prompt + output + status are appended to the
   *  ai-ops.jsonl log so the admin UI can show them. */
  opLog?: { op: string; model: string; elementId?: string; scope?: Record<string, unknown> };
}

export async function* runStructuredAI<T>(
  adapter: AIAdapter,
  args: RunArgs<T>,
): AsyncIterable<StructuredEvent<T>> {
  let buf = "";
  const handle = args.opLog
    ? await startOpRecord({ ...args.opLog, prompt: args.prompt })
    : null;
  for await (const ev of adapter.stream({ prompt: args.prompt, sessionId: args.sessionId, signal: args.signal })) {
    if (ev.type === "delta") {
      buf += ev.text;
      yield { type: "delta", text: ev.text };
    } else if (ev.type === "error") {
      if (handle) await handle.recordError(ev.message);
      yield { type: "error", message: ev.message };
      return;
    } else if (ev.type === "done") {
      try {
        const parsed = extractJson(ev.fullText || buf);
        const result = args.validate(parsed);
        if (handle) await handle.recordDone(ev.fullText || buf, ev.sessionId);
        yield { type: "done", result, sessionId: ev.sessionId };
        return;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (handle) await handle.recordError(message);
        yield { type: "error", message };
        return;
      }
    }
  }
}
