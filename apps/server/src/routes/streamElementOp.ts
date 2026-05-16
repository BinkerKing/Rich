import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { Element } from "@ke/domain";
import type { StructuredEvent } from "../ai/runStructuredAI.js";
import type { KeyedLock } from "../lib/KeyedLock.js";

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
}): Promise<Response> {
  const { c, lock, element, operation, onDone } = args;
  return streamSSE(c, async (stream) => {
    await lock.run(element.id, async () => {
      for await (const ev of operation) {
        await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
        if (ev.type === "done") {
          await onDone(ev.result, ev.sessionId);
        }
      }
    });
  });
}
