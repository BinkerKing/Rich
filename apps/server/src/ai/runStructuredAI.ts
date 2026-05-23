import type { AIAdapter } from "./adapter.js";
import { extractJson } from "./extractJson.js";
import { startOpRecord } from "./aiOpLog.js";
import { randomUUID } from "node:crypto";

/**
 * Server-side defaults filler.
 *
 * Rich's schemas require `metadata.{createdAt,updatedAt,generatedBy,richness}`
 * on every Element and `id,createdAt` on every Relation. These are
 * bookkeeping fields the server owns; the AI shouldn't be asked to
 * fabricate them (Codex direct happened to hallucinate plausible
 * values; Hermes/Codex via the OpenAI-compat API is stricter and
 * omits anything not explicitly requested in the prompt).
 *
 * Before zod validation runs, walk the parsed JSON and fill in any
 * missing server fields. Idempotent — if AI did include them, we keep
 * the existing values. */
function normaliseServerFields(parsed: unknown, adapter: string): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const now = new Date().toISOString();
  // Recursive walk handles nested response shapes (e.g. {elements, relations}
  // OR {root, elements, relations, paths}).
  const stack: unknown[] = [parsed];
  while (stack.length > 0) {
    const node = stack.shift();
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = node as Record<string, any>;
    // Element shape: has id + type + title + content. Fill metadata if missing.
    if (obj.id && typeof obj.type === "string" && typeof obj.title === "string" &&
        ("content" in obj || "metadata" in obj)) {
      if (!obj.metadata || typeof obj.metadata !== "object") {
        obj.metadata = { createdAt: now, updatedAt: now, generatedBy: "ai", aiModel: adapter, richness: 2 };
      } else {
        if (!obj.metadata.createdAt) obj.metadata.createdAt = now;
        if (!obj.metadata.updatedAt) obj.metadata.updatedAt = now;
        if (!obj.metadata.generatedBy) obj.metadata.generatedBy = "ai";
        if (!obj.metadata.aiModel) obj.metadata.aiModel = adapter;
        if (typeof obj.metadata.richness !== "number") obj.metadata.richness = 2;
      }
    }
    // Relation shape: has from + to + kind. Fill id + createdAt.
    if (obj.from && obj.to && obj.kind) {
      if (!obj.id) obj.id = `rel-${randomUUID().slice(0, 8)}`;
      if (!obj.createdAt) obj.createdAt = now;
    }
    // Path shape: has steps + kind + label. Fill id + centerElementId + createdAt + generatedBy.
    if (Array.isArray(obj.steps) && typeof obj.kind === "string" && typeof obj.label === "string") {
      if (!obj.id) obj.id = `path-${randomUUID().slice(0, 8)}`;
      if (!obj.createdAt) obj.createdAt = now;
      if (!obj.generatedBy) obj.generatedBy = "ai";
    }
    // Walk children
    for (const v of Object.values(obj)) stack.push(v);
  }
  return parsed;
}

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
        // Fill server-side bookkeeping fields the AI shouldn't have to know
        // about. Idempotent: keeps any fields the AI did produce.
        const normalised = normaliseServerFields(parsed, adapter.name);
        const result = args.validate(normalised);
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
