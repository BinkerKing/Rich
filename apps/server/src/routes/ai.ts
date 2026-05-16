import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Element, PathKind, RichnessLevel } from "@ke/domain";
import type { AIAdapter } from "../ai/adapter.js";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { RelationsRepo } from "../repos/RelationsRepo.js";
import type { PathsRepo } from "../repos/PathsRepo.js";
import type { SignalsRepo } from "../repos/SignalsRepo.js";
import { pickAdapter } from "../ai/pickAdapter.js";
import { recordSignal } from "../ai/signalRecorder.js";
import {
  generateTreeFor,
  refineElement,
  expandElement,
  extendElement,
  generatePathsFor,
  reviewManual,
} from "../ai/operations.js";
import { KeyedLock } from "../lib/KeyedLock.js";
import type { Logger } from "../lib/logger.js";
import { noopLogger } from "../lib/logger.js";
import { streamElementOp } from "./streamElementOp.js";
import { loadManual, manualToPromptFragment, appendLearnedRules } from "../ai/manuals.js";

export interface AiRoutesDeps {
  adapters: AIAdapter[];
  elements: ElementsRepo;
  relations: RelationsRepo;
  paths: PathsRepo;
  signals: SignalsRepo;
  /** Directory containing AI manual markdown files (knowledge.md, codex.md, …). */
  aiDir: string;
  logger?: Logger;
}

async function knowledgeManualFragment(aiDir: string): Promise<string> {
  const m = await loadManual(aiDir, "knowledge");
  return m ? manualToPromptFragment(m) : "";
}

function elementMetadataWithSession(
  element: Element,
  sessionId: string | undefined,
  modelName: string,
  patch: Partial<Element["metadata"]> = {},
): Element {
  return {
    ...element,
    metadata: {
      ...element.metadata,
      aiSessionId: sessionId ?? element.metadata.aiSessionId,
      aiModel: modelName,
      updatedAt: new Date().toISOString(),
      ...patch,
    },
  };
}

export function aiRoutes(deps: AiRoutesDeps): Hono {
  const r = new Hono();
  const lock = new KeyedLock();
  const log = deps.logger ?? noopLogger;

  let reqCounter = 0;
  const newReqId = () => `r${Date.now().toString(36)}-${(++reqCounter).toString(36)}`;

  // ----- list available models (adapters) -----
  r.get("/models", async (c) => {
    const list = await Promise.all(deps.adapters.map(async (a) => ({
      name: a.name,
      available: await a.available(),
    })));
    return c.json(list);
  });

  // ----- generate-tree: not element-bound, has its own SSE shape -----
  r.post("/generate-tree", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const topic = String(body.topic ?? "").trim();
    const model = body.model as "claude-code" | "codex" | undefined;
    const richness = (body.richness ?? 2) as RichnessLevel;
    if (!topic) return c.json({ error: "topic required" }, 400);
    const adapter = pickAdapter(deps.adapters, model);
    const signal = c.req.raw.signal;
    const reqId = newReqId();
    const t0 = Date.now();
    log.info("ai.op.start", { reqId, op: "/api/ai/generate-tree", topic, adapter: adapter.name });
    const manual = await knowledgeManualFragment(deps.aiDir);
    return streamSSE(c, async (stream) => {
      let deltas = 0;
      let bytes = 0;
      for await (const ev of generateTreeFor(adapter, { topic, richness, signal, manual })) {
        if (ev.type === "delta") { deltas++; bytes += ev.text.length; }
        if (ev.type === "error") {
          log.error("ai.op.error", { reqId, durationMs: Date.now() - t0, deltas, bytes, message: ev.message });
          await recordSignal(deps.signals, {
            ts: new Date().toISOString(), type: "op.failed", manual: "knowledge",
            op: "generate-tree", adapter: adapter.name,
            data: { topic, durationMs: Date.now() - t0, message: ev.message },
          });
        }
        await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
        if (ev.type === "done") {
          for (const el of ev.result.elements) await deps.elements.put(el);
          await deps.relations.append(ev.result.relations);
          const grouped = new Map<string, typeof ev.result.paths>();
          for (const p of ev.result.paths) {
            const list = grouped.get(p.centerElementId) ?? [];
            list.push(p);
            grouped.set(p.centerElementId, list);
          }
          for (const [centerId, list] of grouped) {
            await deps.paths.putForCenter(centerId, list);
          }
          log.info("ai.op.done", { reqId, durationMs: Date.now() - t0, deltas, bytes, elements: ev.result.elements.length });
          await recordSignal(deps.signals, {
            ts: new Date().toISOString(), type: "op.completed", manual: "knowledge",
            op: "generate-tree", adapter: adapter.name, elementId: ev.result.rootId,
            data: { topic, durationMs: Date.now() - t0, deltas, bytes, elementCount: ev.result.elements.length },
          });
        }
      }
    });
  });

  // ----- refine -----
  r.post("/refine", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const elementId = String(body.elementId ?? "");
    const targetRichness = (body.targetRichness ?? 3) as RichnessLevel;
    const model = body.model as "claude-code" | "codex" | undefined;
    const element = await deps.elements.get(elementId);
    if (!element) return c.json({ error: "element not found" }, 404);
    const adapter = pickAdapter(deps.adapters, model);
    const signal = c.req.raw.signal;
    const reqId = newReqId();
    const logCtx = { reqId, op: c.req.path, elementId, adapter: adapter.name };
    log.info("ai.op.start", logCtx);
    return streamElementOp({
      logger: log, logCtx,
      c, lock, element,
      operation: refineElement(adapter, {
        element, targetRichness,
        sessionId: element.metadata.aiSessionId,
        signal,
        manual: await knowledgeManualFragment(deps.aiDir),
      }),
      onDone: async (result, sessionId) => {
        const t0 = Date.now();
        await deps.elements.put(elementMetadataWithSession(
          { ...element, content: result.content },
          sessionId, adapter.name,
          { richness: targetRichness },
        ));
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.completed", manual: "knowledge",
          op: "refine", adapter: adapter.name, elementId,
          data: { targetRichness, persistMs: Date.now() - t0 },
        });
      },
      onError: async (message) => {
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.failed", manual: "knowledge",
          op: "refine", adapter: adapter.name, elementId, data: { message },
        });
      },
    });
  });

  // ----- expand (向下生成子元) -----
  r.post("/expand", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const elementId = String(body.elementId ?? "");
    const count = body.count as number | undefined;
    const model = body.model as "claude-code" | "codex" | undefined;
    const parent = await deps.elements.get(elementId);
    if (!parent) return c.json({ error: "element not found" }, 404);
    const existingChildren = await loadChildren(deps, elementId);
    const adapter = pickAdapter(deps.adapters, model);
    const signal = c.req.raw.signal;
    const reqId = newReqId();
    const logCtx = { reqId, op: c.req.path, elementId, adapter: adapter.name };
    log.info("ai.op.start", logCtx);
    return streamElementOp({
      logger: log, logCtx,
      c, lock, element: parent,
      operation: expandElement(adapter, {
        parent, existingChildren, count,
        sessionId: parent.metadata.aiSessionId,
        signal,
        manual: await knowledgeManualFragment(deps.aiDir),
      }),
      onDone: async (result, sessionId) => {
        for (const el of result.elements) await deps.elements.put(el);
        await deps.relations.append(result.relations);
        await deps.elements.put(elementMetadataWithSession(parent, sessionId, adapter.name));
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.completed", manual: "knowledge",
          op: "expand", adapter: adapter.name, elementId,
          data: { newChildren: result.elements.length },
        });
      },
      onError: async (message) => {
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.failed", manual: "knowledge",
          op: "expand", adapter: adapter.name, elementId, data: { message },
        });
      },
    });
  });

  // ----- extend (横向关联) -----
  r.post("/extend", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const elementId = String(body.elementId ?? "");
    const direction = String(body.direction ?? "").trim();
    const count = body.count as number | undefined;
    const model = body.model as "claude-code" | "codex" | undefined;
    if (!direction) return c.json({ error: "direction required" }, 400);
    const element = await deps.elements.get(elementId);
    if (!element) return c.json({ error: "element not found" }, 404);
    const adapter = pickAdapter(deps.adapters, model);
    const signal = c.req.raw.signal;
    const reqId = newReqId();
    const logCtx = { reqId, op: c.req.path, elementId, adapter: adapter.name };
    log.info("ai.op.start", logCtx);
    return streamElementOp({
      logger: log, logCtx,
      c, lock, element,
      operation: extendElement(adapter, {
        element, direction, count,
        sessionId: element.metadata.aiSessionId,
        signal,
        manual: await knowledgeManualFragment(deps.aiDir),
      }),
      onDone: async (result, sessionId) => {
        for (const el of result.elements) await deps.elements.put(el);
        await deps.relations.append(result.relations);
        await deps.elements.put(elementMetadataWithSession(element, sessionId, adapter.name));
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.completed", manual: "knowledge",
          op: "extend", adapter: adapter.name, elementId,
          data: { direction, newElements: result.elements.length },
        });
      },
      onError: async (message) => {
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.failed", manual: "knowledge",
          op: "extend", adapter: adapter.name, elementId, data: { direction, message },
        });
      },
    });
  });

  // ----- path (生成推荐路径) -----
  r.post("/path", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const elementId = String(body.elementId ?? "");
    const kinds = (Array.isArray(body.kinds) && body.kinds.length > 0
      ? body.kinds
      : ["quick", "academic", "practice"]) as PathKind[];
    const model = body.model as "claude-code" | "codex" | undefined;
    const center = await deps.elements.get(elementId);
    if (!center) return c.json({ error: "element not found" }, 404);
    const availableElements = await loadSubtreeElements(deps, elementId, 2);
    const adapter = pickAdapter(deps.adapters, model);
    const signal = c.req.raw.signal;
    const reqId = newReqId();
    const logCtx = { reqId, op: c.req.path, elementId, adapter: adapter.name };
    log.info("ai.op.start", logCtx);
    return streamElementOp({
      logger: log, logCtx,
      c, lock, element: center,
      operation: generatePathsFor(adapter, {
        center, availableElements, kinds,
        sessionId: center.metadata.aiSessionId,
        signal,
        manual: await knowledgeManualFragment(deps.aiDir),
      }),
      onDone: async (result, sessionId) => {
        await deps.paths.appendForCenter(elementId, result.paths);
        await deps.elements.put(elementMetadataWithSession(center, sessionId, adapter.name));
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.completed", manual: "knowledge",
          op: "path", adapter: adapter.name, elementId,
          data: { kinds, newPaths: result.paths.length },
        });
      },
      onError: async (message) => {
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.failed", manual: "knowledge",
          op: "path", adapter: adapter.name, elementId, data: { kinds, message },
        });
      },
    });
  });

  // ----- review (复盘 AI 把信号沉淀进说明书 Learned Rules) -----
  r.post("/review", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const manualName = String(body.manual ?? "knowledge");
    const model = body.model as "claude-code" | "codex" | undefined;
    const sinceArg = typeof body.since === "string" ? body.since : undefined;
    const dryRun = body.dryRun === true;
    const since = sinceArg ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7d
    const manual = await loadManual(deps.aiDir, manualName);
    if (!manual) return c.json({ error: `manual "${manualName}" not found` }, 404);
    const signals = await deps.signals.list({ manual: manualName, since });
    if (signals.length === 0) {
      return c.json({ added: 0, skipped: 0, rules: [], signalsReviewed: 0, note: "no signals in window" });
    }
    const adapter = pickAdapter(deps.adapters, model);
    const reqId = newReqId();
    const t0 = Date.now();
    log.info("ai.review.start", { reqId, manual: manualName, signalCount: signals.length, since });

    let accumulated = "";
    let errorMsg: string | undefined;
    let proposedRules: { text: string; rationale?: string; date: string }[] = [];
    for await (const ev of reviewManual(adapter, { manualName, manual, signals, signal: c.req.raw.signal })) {
      if (ev.type === "delta") accumulated += ev.text;
      if (ev.type === "error") errorMsg = ev.message;
      if (ev.type === "done") proposedRules = ev.result.rules;
    }
    if (errorMsg) {
      log.error("ai.review.error", { reqId, durationMs: Date.now() - t0, message: errorMsg });
      return c.json({ error: errorMsg, accumulated: accumulated.slice(0, 1000) }, 500);
    }

    let added = 0;
    let skipped = 0;
    if (!dryRun && proposedRules.length > 0) {
      const res = await appendLearnedRules(deps.aiDir, manualName, proposedRules);
      added = res.added;
      skipped = res.skipped;
    }
    log.info("ai.review.done", { reqId, durationMs: Date.now() - t0, proposed: proposedRules.length, added, skipped, dryRun });

    return c.json({
      manual: manualName,
      signalsReviewed: signals.length,
      since,
      proposedRules,
      added: dryRun ? 0 : added,
      skipped: dryRun ? 0 : skipped,
      dryRun,
    });
  });

  return r;
}

// ----- subtree readers (kept close to the routes that use them) -----

async function loadChildren(deps: AiRoutesDeps, parentId: string): Promise<Element[]> {
  const childIds = (await deps.relations.byFrom(parentId))
    .filter((r) => r.kind === "child")
    .map((r) => r.to);
  const out: Element[] = [];
  for (const id of childIds) {
    const el = await deps.elements.get(id);
    if (el) out.push(el);
  }
  return out;
}

async function loadSubtreeElements(deps: AiRoutesDeps, rootId: string, depth: number): Promise<Element[]> {
  if (depth <= 0) return [];
  const direct = (await deps.relations.byFrom(rootId))
    .filter((r) => r.kind === "child")
    .map((r) => r.to);
  const result: Element[] = [];
  for (const id of direct) {
    const el = await deps.elements.get(id);
    if (el) result.push(el);
    if (depth > 1) {
      result.push(...(await loadSubtreeElements(deps, id, depth - 1)));
    }
  }
  return result;
}
