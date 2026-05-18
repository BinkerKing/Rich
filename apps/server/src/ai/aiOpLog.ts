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

async function ensureDir(): Promise<void> {
  if (!LOG_PATH) return;
  await fs.mkdir(path.dirname(LOG_PATH), { recursive: true }).catch(() => undefined);
}

async function appendLine(record: AIOpRecord): Promise<void> {
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
  recordDone(output: string, sessionId?: string): Promise<void>;
  recordError(message: string): Promise<void>;
}

export async function startOpRecord(input: {
  op: string;
  model: string;
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
    elementId: input.elementId,
    scope: input.scope,
    prompt: input.prompt,
    status: "running",
  };
  await appendLine(base);
  return {
    id,
    startedAt,
    async recordDone(output: string, sessionId?: string) {
      const trimmed = output.length > MAX_OUTPUT_LEN
        ? output.slice(0, MAX_OUTPUT_LEN) + "\n…[truncated]"
        : output;
      await appendLine({
        ...base,
        status: "done",
        durationMs: Date.now() - startedAt,
        output: trimmed,
        sessionId,
      });
    },
    async recordError(message: string) {
      await appendLine({
        ...base,
        status: "error",
        durationMs: Date.now() - startedAt,
        error: message,
      });
    },
  };
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
        out.push(JSON.parse(line) as AIOpRecord);
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

/** Reduce the event log into one final record per id (latest line wins). */
export function reduceToFinal(records: AIOpRecord[]): AIOpRecord[] {
  const byId = new Map<string, AIOpRecord>();
  for (const r of records) byId.set(r.id, r);
  return Array.from(byId.values()).sort((a, b) => b.ts.localeCompare(a.ts));
}
