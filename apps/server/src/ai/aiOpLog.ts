import fs from "node:fs/promises";
import path from "node:path";

/**
 * Append-only JSONL log of every AI op invocation. One line per record so we
 * can tail / grep / stream. The admin UI reads the whole file (small for MVP).
 */

export interface AIOpRecord {
  id: string;
  ts: string;
  /** Op kind: "generate" / "refine" / "feedback" / "section-feedback" / "expand" / "extend" / "path" / "review" / "analyze-mark" / "ask" / etc. */
  op: string;
  /** Adapter name: "codex" / "claude-code". */
  model: string;
  /** Rich AI scenario: "chat" / "analysis" / "document" / etc. */
  scenario?: string;
  /** Element this op is scoped to (omitted for generate / review). */
  elementId?: string;
  /** Extra op-specific scope (e.g. sectionId for section-feedback). */
  scope?: Record<string, unknown>;
  /** Full prompt string sent to the AI (can be long). */
  prompt: string;
  /** Final status. */
  status: "running" | "done" | "error";
  /** ms from start to end. Only set when status != "running". */
  durationMs?: number;
  /** Accumulated streamed output text (truncated to 32KB to avoid bloating the file). */
  output?: string;
  /** Error message if status === "error". */
  error?: string;
  /** AI session id (Codex / Claude) so we can correlate back to raw transcripts. */
  sessionId?: string;
}

export type AITraceEventType =
  | "turn.plan"
  | "adapter.selected"
  | "agent.started"
  | "mcp.tool"
  | "fallback"
  | "output"
  | "error";

type Primitive = string | number | boolean | null;

export interface AITraceEvent {
  opId: string;
  ts: string;
  type: AITraceEventType;
  summary: string;
  data?: Record<string, Primitive>;
}

export type AITraceEventInput = Omit<AITraceEvent, "opId" | "ts" | "summary">;

type OperationLogRow = { kind: "operation" } & AIOpRecord;
type TraceLogRow = { kind: "trace" } & AITraceEvent;
type OpLogRow = OperationLogRow | TraceLogRow;

let LOG_PATH = "";

export function configureOpLog(dataDir: string): void {
  LOG_PATH = path.join(dataDir, "ai-ops.jsonl");
}

let nextSeq = Date.now();
function genId(): string {
  nextSeq += 1;
  return `op-${nextSeq.toString(36)}`;
}

const MAX_OUTPUT_LEN = 32 * 1024;
const TRACE_DATA_KEYS = new Set(["tool", "status"]);
const TRACE_SUMMARIES: Record<AITraceEventType, string> = {
  "turn.plan": "Turn plan recorded",
  "adapter.selected": "Adapter selected",
  "agent.started": "Agent started",
  "mcp.tool": "MCP tool event",
  fallback: "Fallback selected",
  output: "Output recorded",
  error: "Error recorded",
};

async function ensureDir(): Promise<void> {
  if (!LOG_PATH) return;
  await fs.mkdir(path.dirname(LOG_PATH), { recursive: true }).catch(() => undefined);
}

async function appendLine(record: OpLogRow): Promise<void> {
  if (!LOG_PATH) return;
  await ensureDir();
  const line = JSON.stringify(record) + "\n";
  try {
    await fs.appendFile(LOG_PATH, line, "utf8");
  } catch (e) {
    // Swallow logging errors — never let observability take down the request.
    console.warn("[aiOpLog] append failed:", e);
  }
}

/**
 * Start recording an op. Returns an in-memory handle the caller updates as
 * the op progresses (delta, done, error). Each method appends a NEW jsonl
 * line so the file is a true event log; the admin UI reduces lines by `id`.
 */
export interface OpHandle {
  id: string;
  startedAt: number;
  recordEvent(input: AITraceEventInput): Promise<void>;
  recordDone(output: string, sessionId?: string): Promise<void>;
  recordError(message: string): Promise<void>;
}

export async function startOpRecord(input: {
  op: string;
  model: string;
  scenario?: string;
  elementId?: string;
  scope?: Record<string, unknown>;
  prompt: string;
}): Promise<OpHandle> {
  const id = genId();
  const startedAt = Date.now();
  const base: AIOpRecord = {
    id,
    ts: new Date(startedAt).toISOString(),
    op: input.op,
    model: input.model,
    scenario: input.scenario,
    elementId: input.elementId,
    scope: input.scope,
    prompt: input.prompt,
    status: "running",
  };
  await appendLine({ kind: "operation", ...base });
  return {
    id,
    startedAt,
    async recordEvent(input) {
      await appendLine({
        kind: "trace",
        opId: id,
        ts: new Date().toISOString(),
        type: input.type,
        summary: TRACE_SUMMARIES[input.type],
        data: filterTraceData(input.data),
      });
    },
    async recordDone(output: string, sessionId?: string) {
      const trimmed = output.length > MAX_OUTPUT_LEN
        ? output.slice(0, MAX_OUTPUT_LEN) + "\n…[truncated]"
        : output;
      await appendLine({
        kind: "operation",
        ...base,
        status: "done",
        durationMs: Date.now() - startedAt,
        output: trimmed,
        sessionId,
      });
    },
    async recordError(message: string) {
      await appendLine({
        kind: "operation",
        ...base,
        status: "error",
        durationMs: Date.now() - startedAt,
        error: message,
      });
    },
  };
}

function filterTraceData(data: AITraceEvent["data"]): AITraceEvent["data"] {
  if (!data) return undefined;
  const safeData = Object.fromEntries(
    Object.entries(data).filter(([key]) => TRACE_DATA_KEYS.has(key)),
  ) as Record<string, Primitive>;
  return Object.keys(safeData).length > 0 ? safeData : undefined;
}

/** Stream every record in the log file (newest first). For MVP we read the
 *  whole file each query; if/when it grows, swap to a true tail-read. */
export async function readAllOpRecords(): Promise<AIOpRecord[]> {
  if (!LOG_PATH) return [];
  try {
    const txt = await fs.readFile(LOG_PATH, "utf8");
    const lines = txt.split("\n").filter(Boolean);
    const out: AIOpRecord[] = [];
    for (const line of lines) {
      try {
        const row = JSON.parse(line) as unknown;
        if (isOperationLogRow(row)) {
          const { kind: _kind, ...record } = row;
          out.push(record);
        }
      } catch {
        // ignore malformed line
      }
    }
    return out;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

/** Read trace events for an operation in their original append order. */
export async function readOpTrace(opId: string): Promise<AITraceEvent[]> {
  if (!LOG_PATH) return [];
  try {
    const txt = await fs.readFile(LOG_PATH, "utf8");
    const out: AITraceEvent[] = [];
    for (const line of txt.split("\n").filter(Boolean)) {
      try {
        const row = JSON.parse(line) as unknown;
        if (isTraceLogRow(row) && row.opId === opId) {
          const { kind: _kind, ...event } = row;
          out.push(event);
        }
      } catch {
        // ignore malformed line
      }
    }
    return out;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

function isOperationLogRow(row: unknown): row is AIOpRecord & { kind?: "operation" } {
  if (!row || typeof row !== "object") return false;
  const record = row as {
    kind?: unknown;
    id?: unknown;
    ts?: unknown;
    op?: unknown;
    model?: unknown;
    prompt?: unknown;
    status?: unknown;
  };
  return (record.kind === undefined || record.kind === "operation")
    && isNonEmptyString(record.id)
    && isNonEmptyString(record.ts)
    && isNonEmptyString(record.op)
    && isNonEmptyString(record.model)
    && typeof record.prompt === "string"
    && (record.status === "running" || record.status === "done" || record.status === "error");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isTraceLogRow(row: unknown): row is AITraceEvent & { kind: "trace" } {
  if (!row || typeof row !== "object") return false;
  const event = row as {
    kind?: unknown;
    opId?: unknown;
    ts?: unknown;
    type?: unknown;
    summary?: unknown;
  };
  return event.kind === "trace"
    && isNonEmptyString(event.opId)
    && isNonEmptyString(event.ts)
    && isTraceEventType(event.type)
    && typeof event.summary === "string";
}

function isTraceEventType(value: unknown): value is AITraceEventType {
  return typeof value === "string" && Object.hasOwn(TRACE_SUMMARIES, value);
}

/** Reduce the event log into one final record per id (latest line wins). */
export function reduceToFinal(records: AIOpRecord[]): AIOpRecord[] {
  const byId = new Map<string, AIOpRecord>();
  for (const r of records) {
    if (!isReducibleOperation(r)) continue;
    byId.set(r.id, r);
  }
  return Array.from(byId.values()).sort((a, b) => b.ts.localeCompare(a.ts));
}

function isReducibleOperation(record: unknown): record is AIOpRecord {
  if (!record || typeof record !== "object") return false;
  const row = record as { kind?: unknown; id?: unknown; ts?: unknown };
  return row.kind !== "trace" && typeof row.id === "string" && typeof row.ts === "string";
}

/**
 * Self-heal stale "running" records on server startup. If the process was
 * killed mid-op (pkill -9, OOM, crash), the matching `done`/`error` line
 * never got written, leaving the op in perpetual "running" state — which
 * the admin UI then shows as "still running" forever.
 *
 * Threshold: anything older than `staleAfterMs` (default 15 minutes) that
 * is still `running` gets a synthetic `error` line appended.
 *
 * Returns the count of records healed so callers can log it.
 */
export async function healStaleRunningOps(staleAfterMs: number = 15 * 60 * 1000): Promise<number> {
  if (!LOG_PATH) return 0;
  const records = await readAllOpRecords();
  const final = reduceToFinal(records);
  const cutoff = Date.now() - staleAfterMs;
  const stuck = final.filter(r =>
    r.status === "running" && new Date(r.ts).getTime() < cutoff,
  );
  if (stuck.length === 0) return 0;
  for (const r of stuck) {
    await appendLine({
      kind: "operation",
      ...r,
      status: "error",
      durationMs: Date.now() - new Date(r.ts).getTime(),
      error: "进程在执行中被强制中断（pkill / 崩溃 / 重启），状态由启动自愈机制置为失败",
    });
  }
  return stuck.length;
}
