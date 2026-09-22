import { useStore } from "../state/store.js";
import { notifyDeliverableDataChanged } from "../views/project-management/deliverables/DeliverablesModel.js";

/**
 * Subscribe to the backend's SSE channel at /api/events so the UI re-hydrates
 * when something server-side mutates state — typically because Hermes (or any
 * MCP client) wrote via Rich's MCP tools.
 *
 * Wire format (from apps/server/src/routes/events.ts):
 *   event: ready  — channel established
 *   event: ping   — heartbeat (ignored)
 *   event: change — { kind: "element.changed" | "relation.changed" | ... }
 *
 * On a `change` event we schedule a single debounced hydrate. We don't try
 * to slice the refresh by kind because hydrate() is cheap and the consumers
 * always re-derive from the full store anyway. Debouncing absorbs bursts
 * (e.g. expand writes N children + N relations → N+1 events → 1 hydrate).
 */
export function connectServerEvents(): () => void {
  let es: EventSource | null = null;
  let retryTimer: number | null = null;
  let debounceTimer: number | null = null;
  let stopped = false;

  const scheduleHydrate = () => {
    if (debounceTimer != null) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      void useStore.getState().hydrate();
    }, 500);
  };

  const open = () => {
    if (stopped) return;
    es = new EventSource("/api/events");
    es.addEventListener("change", event => {
      const change = JSON.parse((event as MessageEvent).data) as { kind?: string; detail?: { projectId?: unknown; deliverableId?: unknown } };
      if (change.kind === "deliverable.changed") {
        const { projectId, deliverableId } = change.detail ?? {};
        if (typeof projectId === "string" && typeof deliverableId === "string") notifyDeliverableDataChanged(projectId, deliverableId);
      }
      if (change.kind !== "workbench.changed") scheduleHydrate();
    });
    // Reconnect with backoff on error; EventSource auto-reconnects on most
    // network errors but we re-open the connection ourselves to be safe.
    es.addEventListener("error", () => {
      if (stopped) return;
      es?.close();
      es = null;
      if (retryTimer != null) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        open();
      }, 3_000);
    });
  };

  open();

  return () => {
    stopped = true;
    if (retryTimer != null) window.clearTimeout(retryTimer);
    if (debounceTimer != null) window.clearTimeout(debounceTimer);
    es?.close();
    es = null;
  };
}
