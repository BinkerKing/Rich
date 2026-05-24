import { EventEmitter } from "node:events";

/**
 * Tiny in-process pub-sub used to notify connected UIs when server-side
 * state changes — typically because Hermes (or any MCP client) wrote
 * via an MCP tool, or because a route handler mutated SQLite.
 *
 * Consumers: `routes/events.ts` opens an SSE channel and forwards every
 * publish to all connected browser tabs.
 *
 * Producers: any code that mutates persisted state calls
 * `eventBus.publish("<kind>", payload?)`. The payload is purely
 * informational — the client doesn't need to act on it; the kind alone
 * tells it which data slice to refresh.
 *
 * Kept dead-simple (single EventEmitter, no buffering, fire-and-forget)
 * because the consumers always re-hydrate on any event anyway.
 */
export type EventKind =
  | "element.changed"
  | "relation.changed"
  | "qa.changed"
  | "annotation.changed"
  | "path.changed"
  | "signal.changed"
  | "improvement.changed"
  | "corpus.changed"
  | "tool_invocation.changed"
  | "mascot.changed"
  | "greatme.changed";

interface RichEvent {
  kind: EventKind;
  ts: string;
  source: "route" | "mcp" | "queue";
  detail?: Record<string, unknown>;
}

export class RichEventBus extends EventEmitter {
  publish(kind: EventKind, opts: { source?: RichEvent["source"]; detail?: Record<string, unknown> } = {}) {
    const event: RichEvent = {
      kind,
      ts: new Date().toISOString(),
      source: opts.source ?? "route",
      detail: opts.detail,
    };
    // Don't await listeners — they're fire-and-forget SSE writers.
    this.emit("event", event);
  }
}

// One singleton — listeners (SSE handler) and producers (routes / MCP)
// both reach for this same instance.
export const eventBus = new RichEventBus();
// Default to a reasonably high listener limit. With multiple browser
// tabs open + MCP clients, the default 10 is too low.
eventBus.setMaxListeners(50);

export type { RichEvent };
