import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { eventBus, type RichEvent } from "../lib/eventBus.js";

/**
 * SSE channel for browsers to subscribe to backend-side data changes.
 *
 * Wire format (one event per line block, standard SSE):
 *   event: change
 *   data: { "kind": "element.changed", "ts": "...", "source": "mcp", ... }
 *
 *   event: ping
 *   data: { "ts": "..." }
 *
 * Heartbeat (`ping`) every 25s keeps proxies / NAT timeouts from cutting
 * the connection. The browser ignores pings.
 *
 * Backpressure: SSE writes are queued by the runtime; if a tab is super
 * slow we don't block other tabs because each connection has its own
 * EventBus listener that closes when the request aborts.
 */
export function eventsRoute(): Hono {
  const r = new Hono();

  r.get("/", (c) => {
    return streamSSE(c, async (stream) => {
      const ABORT = new AbortController();

      // Heartbeat — every 25 seconds.
      const heartbeat = setInterval(() => {
        if (ABORT.signal.aborted) { clearInterval(heartbeat); return; }
        void stream.writeSSE({
          event: "ping",
          data: JSON.stringify({ ts: new Date().toISOString() }),
        }).catch(() => { /* connection closed; bus listener handles cleanup */ });
      }, 25_000);

      const onEvent = (ev: RichEvent) => {
        if (ABORT.signal.aborted) return;
        void stream.writeSSE({
          event: "change",
          data: JSON.stringify(ev),
        }).catch(() => { /* connection closed */ });
      };

      eventBus.on("event", onEvent);

      // Send an initial "connected" event so the client knows the
      // channel is ready (also flushes headers).
      await stream.writeSSE({
        event: "ready",
        data: JSON.stringify({ ts: new Date().toISOString() }),
      });

      // Wait until client disconnects.
      c.req.raw.signal.addEventListener("abort", () => {
        ABORT.abort();
        clearInterval(heartbeat);
        eventBus.off("event", onEvent);
      });
      await new Promise<void>((resolve) => {
        ABORT.signal.addEventListener("abort", () => resolve());
      });
    });
  });

  return r;
}
