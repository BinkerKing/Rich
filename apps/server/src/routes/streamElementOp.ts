import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { Element } from "@ke/domain";
import type { StructuredEvent } from "../ai/runStructuredAI.js";
import type { KeyedLock } from "../lib/KeyedLock.js";
import type { Logger } from "../lib/logger.js";
import { noopLogger } from "../lib/logger.js";

/**
 * Element-bound SSE operation wrapper.
 *
 * Handles the boilerplate common to refine/expand/extend/path:
 *   - acquire per-element write lock (prevents concurrent corruption)
 *   - pipe StructuredEvent stream to SSE
 *   - call onDone callback when the operation succeeds, before returning
 *
 * The caller is responsible for:
 *   - looking up the element and returning 404 if missing
 *   - building the operation iterable (closed over its own typed args)
 *   - persisting whatever the operation produced
 */
export async function streamElementOp<T>(args: {
  c: Context;
  lock: KeyedLock;
  element: Element;
  operation: AsyncIterable<StructuredEvent<T>>;
  onDone: (result: T, sessionId: string | undefined) => Promise<void>;
  /** Invoked when the operation emitted an error event. */
  onError?: (message: string) => Promise<void>;
  logger?: Logger;
  logCtx?: Record<string, unknown>;
}): Promise<Response> {
  const { c, lock, element, operation, onDone, onError } = args;
  const log = args.logger ?? noopLogger;
  const ctx = args.logCtx ?? {};
  const t0 = Date.now();
  return streamSSE(c, async (stream) => {
    await lock.run(element.id, async () => {
      let deltas = 0;
      let bytes = 0;
      try {
        for await (const ev of operation) {
          await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
          if (ev.type === "delta") { deltas++; bytes += ev.text.length; }
          if (ev.type === "error") {
            log.error("ai.op.error", { ...ctx, durationMs: Date.now() - t0, deltas, bytes, message: ev.message });
            if (onError) await onError(ev.message);
          }
          if (ev.type === "done") {
            await onDone(ev.result, ev.sessionId);
            log.info("ai.op.done", { ...ctx, durationMs: Date.now() - t0, deltas, bytes, sessionId: ev.sessionId });
          }
        }
      } catch (err) {
        log.error("ai.op.crash", { ...ctx, durationMs: Date.now() - t0, deltas, bytes, error: String(err) });
        throw err;
      }
    });
  });
}
