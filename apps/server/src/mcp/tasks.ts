import { randomUUID } from "node:crypto";

/**
 * In-memory tracker for fire-and-forget MCP tool runs.
 *
 * Layer-2 AI tools (refine / expand / extend / generate-paths) take 30-90
 * seconds. Hermes — and most MCP clients — don't want to block that long
 * on a single tool call. Pattern instead:
 *
 *   1. Tool call → push job, return `{ task_id, status: "queued" }` immediately
 *   2. Background async work runs, updates this map on done / error
 *   3. Hermes polls `rich_get_task({ task_id })` until `status: "done"` /
 *      `"error"`, then continues with the result
 *
 * No persistence — process restart loses pending tasks. That's fine for
 * an MCP server that lives inside the user's Rich.app: if Rich closes,
 * the tasks are abandoned, Hermes can re-issue.
 */
export type TaskStatus = "queued" | "running" | "done" | "error";

export interface TaskRecord {
  id: string;
  kind: string;
  status: TaskStatus;
  startedAt: number;
  finishedAt?: number;
  /** JSON-serialisable payload returned by the underlying op. */
  result?: unknown;
  /** Error message (when status === "error"). */
  error?: string;
  /** Free-form refs the caller can include in the queued response. */
  refs?: Record<string, unknown>;
}

const tasks = new Map<string, TaskRecord>();
const MAX_TASKS = 200; // ring-buffer cap — oldest evicted

/** Push a new task. Returns the immediate `{ task_id, status }` shape that
 *  the queued tool returns to Hermes. The provided runner is invoked
 *  asynchronously; its resolved value lands on `result`, a throw lands on
 *  `error`. */
export function enqueue<T>(
  kind: string,
  runner: () => Promise<T>,
  refs?: Record<string, unknown>,
): { task_id: string; status: TaskStatus; kind: string } {
  const id = `mcp-${randomUUID()}`;
  const rec: TaskRecord = {
    id, kind, status: "queued",
    startedAt: Date.now(),
    refs,
  };
  tasks.set(id, rec);
  evictOldest();
  // Defer to next tick so the caller's "queued" return reaches Hermes
  // before we mutate to "running".
  setImmediate(async () => {
    rec.status = "running";
    try {
      rec.result = (await runner()) as unknown;
      rec.status = "done";
      rec.finishedAt = Date.now();
    } catch (e) {
      rec.error = e instanceof Error ? e.message : String(e);
      rec.status = "error";
      rec.finishedAt = Date.now();
    }
  });
  return { task_id: id, status: "queued", kind };
}

export function get(id: string): TaskRecord | undefined {
  return tasks.get(id);
}

export function list(filter?: { status?: TaskStatus; kind?: string }): TaskRecord[] {
  const out: TaskRecord[] = [];
  for (const t of tasks.values()) {
    if (filter?.status && t.status !== filter.status) continue;
    if (filter?.kind && t.kind !== filter.kind) continue;
    out.push(t);
  }
  // Newest first.
  out.sort((a, b) => b.startedAt - a.startedAt);
  return out;
}

function evictOldest() {
  if (tasks.size <= MAX_TASKS) return;
  const sorted = [...tasks.values()].sort((a, b) => a.startedAt - b.startedAt);
  while (tasks.size > MAX_TASKS && sorted.length > 0) {
    const oldest = sorted.shift()!;
    // Don't evict a still-running task.
    if (oldest.status === "running" || oldest.status === "queued") continue;
    tasks.delete(oldest.id);
  }
}
