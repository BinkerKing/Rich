import { Hono } from "hono";
import { z } from "zod";
import { streamSSE } from "hono/streaming";
import type { Element, PathKind, RichnessLevel } from "@ke/domain";
import type { AIAdapter } from "../ai/adapter.js";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { RelationsRepo } from "../repos/RelationsRepo.js";
import type { PathsRepo } from "../repos/PathsRepo.js";
import type { SignalsRepo } from "../repos/SignalsRepo.js";
import type { QARepo } from "../repos/QARepo.js";
import type { AnnotationsRepo } from "../repos/AnnotationsRepo.js";
import { buildAskPrompt } from "../ai/prompts/ask.js";
import { pickAdapter } from "../ai/pickAdapter.js";
import { recordSignal } from "../ai/signalRecorder.js";
import { RICHNESS_SPECS } from "../ai/prompts/generateTree.js";
import { adoptImagesInContent } from "../lib/imageAssets.js";
import { migrateLegacyContentToSections } from "../lib/legacyContentMigration.js";
import { imageQueue } from "../ai/imageQueue.js";
import {
  generateTreeFor,
  refineElement,
  refineSection,
  expandElement,
  extendElement,
  generatePathsFor,
  reviewManual,
  analyzeMark,
  extractKeywords,
  analyzeAttachment,
  attachUnder,
  generateDailyNews,
  runGreatMeBrain,
  runDecomposePlan,
  runAnalyzeProgress,
  runDraftReview,
  type DailyNewsItem,
} from "../ai/operations.js";
import { shortlistByKeywords } from "../lib/elementShortlist.js";
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
  qa: QARepo;
  annotations: AnnotationsRepo;
  /** Directory containing AI manual markdown files (knowledge.md, codex.md, …). */
  aiDir: string;
  logger?: Logger;
}

async function knowledgeManualFragment(aiDir: string): Promise<string> {
  const m = await loadManual(aiDir, "knowledge");
  return m ? manualToPromptFragment(m) : "";
}

/** Only resume a saved session if the same adapter produced it. */
function resumableSessionFor(element: Element, adapterName: string): string | undefined {
  if (element.metadata.aiSessionId && element.metadata.aiModel === adapterName) {
    return element.metadata.aiSessionId;
  }
  return undefined;
}

/**
 * User-only types. AI cannot create these — they must be set manually. Any
 * `practice` or `project` emitted by AI gets coerced to `concept` at the
 * server boundary, so the rule holds even if a prompt slips through.
 */
const USER_ONLY_TYPES = new Set(["practice", "project"]);
function coerceType<T extends string>(t: T): T {
  return (USER_ONLY_TYPES.has(t) ? "concept" : t) as T;
}

/**
 * AI sometimes copies example timestamps verbatim (e.g. "2026-05-17T00:00:00.000Z").
 * Always stamp newly-generated elements with the actual server time, preserving
 * any user-supplied richness and other metadata fields.
 *
 * Also coerces user-only types (practice / project) to concept — those types
 * are reserved for manual creation.
 */
function stampNewElement(el: Element, adapterName: string): Element {
  const now = new Date().toISOString();
  return {
    ...el,
    type: coerceType(el.type),
    metadata: {
      ...el.metadata,
      createdAt: now,
      updatedAt: now,
      generatedBy: "ai",
      aiModel: adapterName,
    },
  };
}

/** Lowercase-kebab a string for use as the suffix of a news element id.
 *  Strips most non-alnum; preserves CJK. Falls back to a short timestamp if
 *  nothing useful remains (e.g. an emoji-only title). */
function slugify(s: string): string {
  const base = s.toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (!base) return `n${Date.now().toString(36).slice(-6)}`;
  return base;
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

  // Public spec for richness tiers — used by InputView to render the standard.
  r.get("/richness-spec", (c) => c.json(RICHNESS_SPECS));

  // ----- great-me: Hermes-backed personal cockpit brain -----
  // This is intentionally a single JSON endpoint instead of SSE: the GreatMe
  // UI needs a compact decision packet (missions, PDCA, axis adjustments)
  // rather than token-by-token prose. By default pickAdapter() selects Hermes,
  // because Hermes is adapters[0] in buildApp().
  // Input schema. `state` is an opaque snapshot of the GreatMe cockpit —
  // its shape is owned by the view; we don't reparse it here, but we do
  // cap its serialised size so a runaway client can't blow up the prompt.
  const GreatMeBodySchema = z.object({
    mode: z.enum(["goal", "mission", "review", "week-simulation"]),
    input: z.string().max(2000).default(""),
    state: z.unknown().optional(),
    model: z.enum(["claude-code", "codex", "hermes"]).optional(),
  });
  const GREAT_ME_STATE_MAX_BYTES = 64 * 1024;
  r.post("/great-me", async (c) => {
    const raw = await c.req.json().catch(() => null);
    if (raw == null) return c.json({ error: "invalid JSON body" }, 400);
    const parsed = GreatMeBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "schema validation failed", issues: parsed.error.issues }, 400);
    }
    const { mode, model } = parsed.data;
    const input = parsed.data.input.trim();
    const state = parsed.data.state ?? {};
    // Size cap on the snapshot so prompt construction stays bounded.
    if (JSON.stringify(state).length > GREAT_ME_STATE_MAX_BYTES) {
      return c.json({ error: `state too large (>${GREAT_ME_STATE_MAX_BYTES} bytes)` }, 413);
    }
    const adapter = pickAdapter(deps.adapters, model);
    const reqId = newReqId();
    const t0 = Date.now();
    log.info("ai.op.start", { reqId, op: "/api/ai/great-me", mode, adapter: adapter.name });

    if (!(await adapter.available())) {
      const message = `${adapter.name} unavailable`;
      await recordSignal(deps.signals, {
        ts: new Date().toISOString(), type: "op.failed", manual: "great-me",
        op: "great-me", adapter: adapter.name, data: { mode, message },
      });
      return c.json({ error: message, adapter: adapter.name }, 503);
    }

    let finalResult: unknown = null;
    let lastError = "";
    for await (const ev of runGreatMeBrain(adapter, {
      mode, input, state, signal: c.req.raw.signal,
    })) {
      if (ev.type === "error") {
        lastError = ev.message;
        break;
      }
      if (ev.type === "done") {
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.completed", manual: "great-me",
          op: "great-me", adapter: adapter.name,
          data: { mode, durationMs: Date.now() - t0, missionCount: ev.result.missions.length },
        });
        finalResult = ev.result;
        break;
      }
    }
    if (finalResult) return c.json({ adapter: adapter.name, result: finalResult });
    const message = lastError || "Hermes brain failed";
    await recordSignal(deps.signals, {
      ts: new Date().toISOString(), type: "op.failed", manual: "great-me",
      op: "great-me", adapter: adapter.name, data: { mode, durationMs: Date.now() - t0, message },
    });
    return c.json({ error: message, adapter: adapter.name }, 500);
  });

  // ----- decompose-plan: AI 把意图拆成 plan/goal/task 树 (Stage 3) -----
  // 用户说"我想 3 个月减 10 斤"，Hermes 返回结构化树（带 tempId 供客户端落库时映射）。
  // AI 自己判断要不要 year/month/week/day 全套层级；scopes 字段如实反映。
  const DecomposePlanBodySchema = z.object({
    intent: z.string().min(2).max(500),
    targetEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    model: z.enum(["claude-code", "codex", "hermes"]).optional(),
  });
  r.post("/decompose-plan", async (c) => {
    const raw = await c.req.json().catch(() => null);
    if (raw == null) return c.json({ error: "invalid JSON body" }, 400);
    const parsed = DecomposePlanBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "schema validation failed", issues: parsed.error.issues }, 400);
    }
    const { intent, targetEnd, model } = parsed.data;
    const today = new Date().toISOString().slice(0, 10);
    const adapter = pickAdapter(deps.adapters, model);
    const reqId = newReqId();
    const t0 = Date.now();
    log.info("ai.op.start", { reqId, op: "/api/ai/decompose-plan", adapter: adapter.name });

    if (!(await adapter.available())) {
      const message = `${adapter.name} unavailable`;
      await recordSignal(deps.signals, {
        ts: new Date().toISOString(), type: "op.failed", manual: "decompose-plan",
        op: "decompose-plan", adapter: adapter.name, data: { intent: intent.slice(0, 120), message },
      });
      return c.json({ error: message, adapter: adapter.name }, 503);
    }

    let finalResult: unknown = null;
    let lastError = "";
    for await (const ev of runDecomposePlan(adapter, {
      intent, today, targetEnd, signal: c.req.raw.signal,
    })) {
      if (ev.type === "error") { lastError = ev.message; break; }
      if (ev.type === "done") {
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.completed", manual: "decompose-plan",
          op: "decompose-plan", adapter: adapter.name,
          data: {
            intent: intent.slice(0, 120),
            durationMs: Date.now() - t0,
            goalCount: ev.result.goals.length,
            taskCount: ev.result.tasks.length,
            scopes: ev.result.plan.scopes,
          },
        });
        finalResult = ev.result;
        break;
      }
    }
    if (finalResult) return c.json({ adapter: adapter.name, result: finalResult });
    const message = lastError || "decompose-plan failed";
    await recordSignal(deps.signals, {
      ts: new Date().toISOString(), type: "op.failed", manual: "decompose-plan",
      op: "decompose-plan", adapter: adapter.name,
      data: { intent: intent.slice(0, 120), durationMs: Date.now() - t0, message },
    });
    return c.json({ error: message, adapter: adapter.name }, 500);
  });

  // ----- analyze-progress: AI 分析任务推进卡点 + 给推进策略 -----
  // 客户端预先计算好健康度指标，传过来；Hermes 基于 state + metrics 输出可执行建议。
  const AnalyzeProgressBodySchema = z.object({
    state: z.unknown(),
    metrics: z.unknown(),
    model: z.enum(["claude-code", "codex", "hermes"]).optional(),
  });
  const ANALYZE_PROGRESS_BODY_MAX = 256 * 1024;
  r.post("/analyze-progress", async (c) => {
    const text = await c.req.text();
    if (text.length > ANALYZE_PROGRESS_BODY_MAX) {
      return c.json({ error: `body too large (>${ANALYZE_PROGRESS_BODY_MAX} bytes)` }, 413);
    }
    let raw: unknown;
    try { raw = JSON.parse(text); }
    catch { return c.json({ error: "invalid JSON" }, 400); }
    const parsed = AnalyzeProgressBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "schema validation failed", issues: parsed.error.issues }, 400);
    }
    const { state, metrics, model } = parsed.data;
    const adapter = pickAdapter(deps.adapters, model);
    const reqId = newReqId();
    const t0 = Date.now();
    log.info("ai.op.start", { reqId, op: "/api/ai/analyze-progress", adapter: adapter.name });

    if (!(await adapter.available())) {
      const message = `${adapter.name} unavailable`;
      await recordSignal(deps.signals, {
        ts: new Date().toISOString(), type: "op.failed", manual: "analyze-progress",
        op: "analyze-progress", adapter: adapter.name, data: { message },
      });
      return c.json({ error: message, adapter: adapter.name }, 503);
    }

    let finalResult: unknown = null;
    let lastError = "";
    for await (const ev of runAnalyzeProgress(adapter, {
      state, metrics, signal: c.req.raw.signal,
    })) {
      if (ev.type === "error") { lastError = ev.message; break; }
      if (ev.type === "done") {
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.completed", manual: "analyze-progress",
          op: "analyze-progress", adapter: adapter.name,
          data: { durationMs: Date.now() - t0, blockerCount: ev.result.blockers.length },
        });
        finalResult = ev.result;
        break;
      }
    }
    if (finalResult) return c.json({ adapter: adapter.name, result: finalResult });
    const message = lastError || "analyze-progress failed";
    await recordSignal(deps.signals, {
      ts: new Date().toISOString(), type: "op.failed", manual: "analyze-progress",
      op: "analyze-progress", adapter: adapter.name,
      data: { durationMs: Date.now() - t0, message },
    });
    return c.json({ error: message, adapter: adapter.name }, 500);
  });

  // ----- draft-review: AI 起草每周复盘（多维度 perspectives） -----
  const DraftReviewBodySchema = z.object({
    weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    weekTasks: z.unknown(),
    weekGoals: z.unknown(),
    activePlans: z.unknown(),
    lastReview: z.unknown().optional(),
    metrics: z.object({
      weekDone: z.number().int(),
      weekTotal: z.number().int(),
      completionRate: z.number().int().min(0).max(100),
      overdueCount: z.number().int(),
      stuckCount: z.number().int(),
    }),
    model: z.enum(["claude-code", "codex", "hermes"]).optional(),
  });
  const DRAFT_REVIEW_BODY_MAX = 256 * 1024;
  r.post("/draft-review", async (c) => {
    const text = await c.req.text();
    if (text.length > DRAFT_REVIEW_BODY_MAX) {
      return c.json({ error: `body too large (>${DRAFT_REVIEW_BODY_MAX} bytes)` }, 413);
    }
    let raw: unknown;
    try { raw = JSON.parse(text); }
    catch { return c.json({ error: "invalid JSON" }, 400); }
    const parsed = DraftReviewBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "schema validation failed", issues: parsed.error.issues }, 400);
    }
    const { weekOf, weekTasks, weekGoals, activePlans, lastReview, metrics, model } = parsed.data;
    const adapter = pickAdapter(deps.adapters, model);
    const reqId = newReqId();
    const t0 = Date.now();
    log.info("ai.op.start", { reqId, op: "/api/ai/draft-review", adapter: adapter.name, weekOf });

    if (!(await adapter.available())) {
      const message = `${adapter.name} unavailable`;
      await recordSignal(deps.signals, {
        ts: new Date().toISOString(), type: "op.failed", manual: "draft-review",
        op: "draft-review", adapter: adapter.name, data: { weekOf, message },
      });
      return c.json({ error: message, adapter: adapter.name }, 503);
    }

    let finalResult: unknown = null;
    let lastError = "";
    for await (const ev of runDraftReview(adapter, {
      weekOf, weekTasks, weekGoals, activePlans, lastReview, metrics,
      signal: c.req.raw.signal,
    })) {
      if (ev.type === "error") { lastError = ev.message; break; }
      if (ev.type === "done") {
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.completed", manual: "draft-review",
          op: "draft-review", adapter: adapter.name,
          data: {
            weekOf,
            durationMs: Date.now() - t0,
            score: ev.result.score,
            perspectiveCount: ev.result.perspectives.length,
          },
        });
        finalResult = ev.result;
        break;
      }
    }
    if (finalResult) return c.json({ adapter: adapter.name, result: finalResult });
    const message = lastError || "draft-review failed";
    await recordSignal(deps.signals, {
      ts: new Date().toISOString(), type: "op.failed", manual: "draft-review",
      op: "draft-review", adapter: adapter.name,
      data: { weekOf, durationMs: Date.now() - t0, message },
    });
    return c.json({ error: message, adapter: adapter.name }, 500);
  });

  // ----- analyze-input: AI 解析引擎 -----
  // Two-pass routing for the home-page input box:
  //   1) AI extracts keywords + suggests type + intent from raw user text.
  //   2) Program searches the element store by keywords → top candidates.
  //   3) AI proposes 1-3 attachment options (new-topic / attach-direct /
  //      attach-with-bridge) over those candidates.
  // Returns synchronously (single JSON), no streaming.
  r.post("/analyze-input", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const model = body.model as "claude-code" | "codex" | undefined;
    if (!text) return c.json({ error: "text required" }, 400);
    const adapter = pickAdapter(deps.adapters, model);
    const signal = c.req.raw.signal;

    // Step 1: AI keyword extraction.
    let kwResult: import("../ai/operations.js").ExtractKeywordsResult | null = null;
    let lastErr: string | null = null;
    for await (const ev of extractKeywords(adapter, { text, signal })) {
      if (ev.type === "error") { lastErr = ev.message; break; }
      if (ev.type === "done") { kwResult = ev.result; break; }
    }
    if (!kwResult) return c.json({ error: lastErr ?? "keyword extraction failed" }, 500);

    // Step 2: program-side shortlist.
    const allElements = await deps.elements.list();
    const allRelations = await deps.relations.list();
    const candidates = shortlistByKeywords(kwResult.keywords, allElements, allRelations, 12);

    // Step 3: AI hierarchy analysis.
    let attach: import("../ai/operations.js").AnalyzeAttachmentResult | null = null;
    lastErr = null;
    for await (const ev of analyzeAttachment(adapter, {
      text,
      keywords: kwResult.keywords,
      intent: kwResult.intent,
      suggestedType: kwResult.type,
      candidates,
      signal,
    })) {
      if (ev.type === "error") { lastErr = ev.message; break; }
      if (ev.type === "done") { attach = ev.result; break; }
    }
    if (!attach) return c.json({ error: lastErr ?? "attachment analysis failed" }, 500);

    return c.json({
      topic: kwResult.topic,
      keywords: kwResult.keywords,
      intent: kwResult.intent,
      type: attach.type,
      candidates,  // so the client can render parent paths next to parentId
      options: attach.options,
    });
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
          for (const el of ev.result.elements) await deps.elements.put(stampNewElement(el, adapter.name));
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
          // Hand off image-placeholder blocks to the background image engine.
          for (const el of ev.result.elements) void imageQueue.scheduleForElement(el.id);
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
    const direction = typeof body.direction === "string" ? body.direction.trim() : undefined;
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
        element, targetRichness, direction,
        sessionId: resumableSessionFor(element, adapter.name),
        signal,
        manual: await knowledgeManualFragment(deps.aiDir),
      }),
      onDone: async (result, sessionId) => {
        const t0 = Date.now();
        // Copy any AI-emitted local image files into our served images dir
        // and rewrite their `src` to /api/images/<elementId>/<file>.
        await adoptImagesInContent(elementId, result.content);
        await deps.elements.put(elementMetadataWithSession(
          { ...element, content: result.content },
          sessionId, adapter.name,
          { richness: targetRichness },
        ));
        void imageQueue.scheduleForElement(elementId);
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

  // ----- feedback: explicit user feedback on an element + targeted refine -----
  // Logs a `user.feedback` signal (so the Reviewer can later learn from it)
  // and then runs a refine with the feedback text as the direction so the
  // element gets fixed immediately. Streams the refine SSE back to caller.
  r.post("/feedback", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const elementId = String(body.elementId ?? "");
    const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
    const model = body.model as "claude-code" | "codex" | undefined;
    if (!feedback) return c.json({ error: "feedback required" }, 400);
    const element = await deps.elements.get(elementId);
    if (!element) return c.json({ error: "element not found" }, 404);
    const adapter = pickAdapter(deps.adapters, model);
    const beforeRichness = element.metadata.richness;
    const targetRichness = Math.max(beforeRichness, 3) as RichnessLevel;
    // Record the feedback signal up front so it's preserved even if refine fails.
    await recordSignal(deps.signals, {
      ts: new Date().toISOString(), type: "user.feedback", manual: "knowledge",
      elementId, adapter: adapter.name,
      data: { feedback, beforeRichness, autoRefined: true },
    });
    const sig = c.req.raw.signal;
    const reqId = newReqId();
    const logCtx = { reqId, op: c.req.path, elementId, adapter: adapter.name };
    log.info("ai.op.start", logCtx);
    const direction = `用户反馈：${feedback}\n请直接针对这条反馈修订 content，让用户感觉问题被理解并被解决。`;
    return streamElementOp({
      logger: log, logCtx,
      c, lock, element,
      operation: refineElement(adapter, {
        element, targetRichness, direction,
        sessionId: resumableSessionFor(element, adapter.name),
        signal: sig,
        manual: await knowledgeManualFragment(deps.aiDir),
      }),
      onDone: async (result, sessionId) => {
        await adoptImagesInContent(elementId, result.content);
        await deps.elements.put(elementMetadataWithSession(
          { ...element, content: result.content },
          sessionId, adapter.name,
          { richness: targetRichness },
        ));
        void imageQueue.scheduleForElement(elementId);
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.completed", manual: "knowledge",
          op: "feedback", adapter: adapter.name, elementId,
          data: { feedback, beforeRichness, targetRichness },
        });
      },
      onError: async (message) => {
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.failed", manual: "knowledge",
          op: "feedback", adapter: adapter.name, elementId,
          data: { feedback, message },
        });
      },
    });
  });

  // ----- section-feedback: scoped reaction to a single section -----
  // Body: { elementId, sectionId, feedback, model? }
  // AI receives only the target section + brief element context, and returns
  // ONLY the updated section JSON. The server then replaces that section by
  // id in the existing element.content.sections — every other section, every
  // other field on the element, is byte-identical to before. The AI has no
  // way to delete or rewrite anything outside the targeted section.
  r.post("/section-feedback", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const elementId = String(body.elementId ?? "");
    const sectionId = String(body.sectionId ?? "");
    const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
    const model = body.model as "claude-code" | "codex" | undefined;
    if (!feedback) return c.json({ error: "feedback required" }, 400);
    if (!sectionId) return c.json({ error: "sectionId required" }, 400);
    let element = await deps.elements.get(elementId);
    if (!element) return c.json({ error: "element not found" }, 404);

    // Find the targeted section in the existing content.sections array.
    // Legacy concept-style content has no sections[] yet — the frontend
    // synthesizes virtual sections from oneSentence / coreExplain / ... To
    // make section-feedback work for those elements WITHOUT destructively
    // rewriting the whole content via refineElement, we materialize the
    // virtual sections in place (deterministically, no AI), persist them,
    // then proceed as if the element had always had sections[].
    let content = (element.content ?? {}) as Record<string, unknown>;
    let sectionsRaw = Array.isArray(content.sections) ? (content.sections as unknown[]) : [];
    let sectionIndex = sectionsRaw.findIndex(s =>
      s && typeof s === "object" && (s as Record<string, unknown>).id === sectionId,
    );
    if (sectionIndex < 0) {
      const migrated = migrateLegacyContentToSections(content) as Record<string, unknown>;
      if (migrated !== content && Array.isArray(migrated.sections)) {
        const migratedEl = { ...element, content: migrated as typeof element.content,
          metadata: { ...element.metadata, updatedAt: new Date().toISOString() } };
        await deps.elements.put(migratedEl);
        element = migratedEl;
        content = migrated;
        sectionsRaw = migrated.sections as unknown[];
        sectionIndex = sectionsRaw.findIndex(s =>
          s && typeof s === "object" && (s as Record<string, unknown>).id === sectionId,
        );
      }
    }
    if (sectionIndex < 0) return c.json({ error: "section not found in this element" }, 404);
    const targetSection = sectionsRaw[sectionIndex] as { id: string; title: string; blocks: unknown[] };

    const adapter = pickAdapter(deps.adapters, model);
    await recordSignal(deps.signals, {
      ts: new Date().toISOString(), type: "user.feedback", manual: "knowledge",
      elementId, adapter: adapter.name,
      data: { feedback, scope: "section", sectionId, autoRefined: true },
    });
    const sig = c.req.raw.signal;
    const reqId = newReqId();
    const logCtx = { reqId, op: c.req.path, elementId, adapter: adapter.name };
    log.info("ai.op.start", { ...logCtx, sectionId });
    return streamElementOp({
      logger: log, logCtx,
      c, lock, element,
      operation: refineSection(adapter, {
        element, section: targetSection, direction: feedback,
        sessionId: resumableSessionFor(element, adapter.name),
        signal: sig,
        manual: await knowledgeManualFragment(deps.aiDir),
      }),
      onDone: async (result, sessionId) => {
        const t0 = Date.now();
        // Guard: the AI must keep the original section id. If it changed
        // anyway, force-restore it so the array stays stably referenced.
        const newSection = { ...result.section, id: sectionId };
        // Adopt any AI-emitted local image paths inside this section's blocks.
        await adoptImagesInContent(elementId, { sections: [newSection] });
        // Splice the new section into the existing content; every other
        // section + every other content field is preserved as-is.
        const nextSections = sectionsRaw.slice();
        nextSections[sectionIndex] = newSection;
        const nextContent = { ...content, sections: nextSections };
        await deps.elements.put(elementMetadataWithSession(
          { ...element, content: nextContent },
          sessionId, adapter.name,
        ));
        void imageQueue.scheduleForElement(elementId);
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.completed", manual: "knowledge",
          op: "section-feedback", adapter: adapter.name, elementId,
          data: { sectionId, feedback, persistMs: Date.now() - t0 },
        });
      },
      onError: async (message) => {
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.failed", manual: "knowledge",
          op: "section-feedback", adapter: adapter.name, elementId,
          data: { sectionId, feedback, message },
        });
      },
    });
  });

  // ----- attach-under: strict attach for the home-page input flow -----
  // Body: { parentId, mode: "leaf"|"chain", leafTitle?, chain?, fullIntent }
  // Creates exactly 1 leaf, or a vertical chain of N elements, under the
  // chosen parent. NO horizontal siblings, NO intermediate classifier, NO
  // auto-grandchildren. Streams elements & relations like /expand.
  r.post("/attach-under", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parentId = String(body.parentId ?? "");
    const mode = body.mode === "chain" ? "chain" as const : "leaf" as const;
    const leafTitle = typeof body.leafTitle === "string" ? body.leafTitle.trim() : undefined;
    const chainRaw = Array.isArray(body.chain) ? body.chain : [];
    const chain = chainRaw.map((s: unknown) => String(s).trim()).filter(Boolean);
    const fullIntent = typeof body.fullIntent === "string" ? body.fullIntent.trim() : "";
    const model = body.model as "claude-code" | "codex" | undefined;
    const richness = typeof body.richness === "number" && body.richness >= 1 && body.richness <= 5
      ? body.richness as RichnessLevel
      : undefined;
    if (!parentId) return c.json({ error: "parentId required" }, 400);
    if (mode === "leaf" && !leafTitle) return c.json({ error: "leafTitle required for leaf mode" }, 400);
    if (mode === "chain" && chain.length === 0) return c.json({ error: "chain required for chain mode" }, 400);
    const parent = await deps.elements.get(parentId);
    if (!parent) return c.json({ error: "parent not found" }, 404);

    const adapter = pickAdapter(deps.adapters, model);
    const sig = c.req.raw.signal;
    const reqId = newReqId();
    const logCtx = { reqId, op: c.req.path, elementId: parentId, adapter: adapter.name };
    log.info("ai.op.start", { ...logCtx, mode, leafTitle, chain });
    return streamElementOp({
      logger: log, logCtx,
      c, lock, element: parent,
      operation: attachUnder(adapter, {
        parent, mode, leafTitle, chain, fullIntent, richness,
        sessionId: resumableSessionFor(parent, adapter.name),
        signal: sig,
        manual: await knowledgeManualFragment(deps.aiDir),
      }),
      onDone: async (result) => {
        for (const el of result.elements) await deps.elements.put(stampNewElement(el, adapter.name));
        await deps.relations.append(result.relations);
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.completed", manual: "knowledge",
          op: "attach-under", adapter: adapter.name, elementId: parentId,
          data: { mode, leafTitle, chain, addedCount: result.elements.length },
        });
      },
      onError: async (message) => {
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.failed", manual: "knowledge",
          op: "attach-under", adapter: adapter.name, elementId: parentId,
          data: { mode, leafTitle, chain, message },
        });
      },
    });
  });

  // ----- expand (向下生成子元) -----
  r.post("/expand", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const elementId = String(body.elementId ?? "");
    const count = body.count as number | undefined;
    const direction = typeof body.direction === "string" ? body.direction.trim() : undefined;
    const maxDepth = typeof body.maxDepth === "number" ? body.maxDepth : (direction ? 2 : 1);
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
        parent, existingChildren, count, direction, maxDepth,
        sessionId: resumableSessionFor(parent, adapter.name),
        signal,
        manual: await knowledgeManualFragment(deps.aiDir),
      }),
      onDone: async (result, sessionId) => {
        for (const el of result.elements) await deps.elements.put(stampNewElement(el, adapter.name));
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
        sessionId: resumableSessionFor(element, adapter.name),
        signal,
        manual: await knowledgeManualFragment(deps.aiDir),
      }),
      onDone: async (result, sessionId) => {
        for (const el of result.elements) await deps.elements.put(stampNewElement(el, adapter.name));
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
        sessionId: resumableSessionFor(center, adapter.name),
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

  // ----- ask: free-form Q&A scoped to a single element -----
  r.post("/ask", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const elementId = String(body.elementId ?? "");
    const question = String(body.question ?? "").trim();
    const model = body.model as "claude-code" | "codex" | undefined;
    // Optional anchor: { type: "section", sectionId } | { type: "annotation", annotationId } | { type: "element" }
    const anchor = body.anchor && typeof body.anchor === "object" ? body.anchor : { type: "element" };
    // Optional extra context that the caller knows (e.g. the section title + body, or the marked text).
    const contextText = typeof body.contextText === "string" ? body.contextText : "";
    if (!question) return c.json({ error: "question required" }, 400);
    const element = await deps.elements.get(elementId);
    if (!element) return c.json({ error: "element not found" }, 404);

    const adapter = pickAdapter(deps.adapters, model);
    const history = await deps.qa.listForElement(elementId);
    const manual = await knowledgeManualFragment(deps.aiDir);
    const scopedQuestion = contextText
      ? `（聚焦上下文：${contextText.slice(0, 800)}）\n${question}`
      : question;
    const prompt = manual + buildAskPrompt({ element, question: scopedQuestion, history });

    const reqId = newReqId();
    const logCtx = { reqId, op: "/api/ai/ask", elementId, adapter: adapter.name };
    log.info("ai.op.start", logCtx);

    return streamSSE(c, async (stream) => {
      let answer = "";
      let sessionId: string | undefined;
      try {
        for await (const ev of adapter.stream({ prompt, signal: c.req.raw.signal })) {
          if (ev.type === "delta") {
            answer += ev.text;
            await stream.writeSSE({ event: "delta", data: JSON.stringify({ type: "delta", text: ev.text }) });
          } else if (ev.type === "error") {
            await stream.writeSSE({ event: "error", data: JSON.stringify({ type: "error", message: ev.message }) });
            await recordSignal(deps.signals, {
              ts: new Date().toISOString(), type: "op.failed", manual: "knowledge",
              op: "ask", adapter: adapter.name, elementId, data: { message: ev.message },
            });
            return;
          } else if (ev.type === "done") {
            sessionId = ev.sessionId;
            const finalAnswer = (ev.fullText && ev.fullText.length > answer.length ? ev.fullText : answer).trim();
            const qa = {
              id: `qa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              elementId,
              question,
              answer: finalAnswer,
              anchor,
              createdAt: new Date().toISOString(),
              aiModel: adapter.name,
              aiSessionId: sessionId,
            };
            await deps.qa.append(qa);
            await stream.writeSSE({ event: "done", data: JSON.stringify({ type: "done", result: { qa } }) });
            await recordSignal(deps.signals, {
              ts: qa.createdAt, type: "op.completed", manual: "knowledge",
              op: "ask", adapter: adapter.name, elementId, data: { answerLen: finalAnswer.length },
            });
            return;
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await stream.writeSSE({ event: "error", data: JSON.stringify({ type: "error", message: msg }) });
      }
    });
  });

  // ----- analyze-mark: deep analysis of a user-highlighted snippet.
  // When annotationId is provided, the result is attached to that annotation
  // (rendered inline under the mark). Otherwise it falls back to appending
  // an extraSection on the element body.
  r.post("/analyze-mark", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const elementId = String(body.elementId ?? "");
    const annotationId = typeof body.annotationId === "string" ? body.annotationId : undefined;
    const markedText = typeof body.markedText === "string" ? body.markedText.trim() : "";
    const contextBefore = typeof body.contextBefore === "string" ? body.contextBefore : undefined;
    const contextAfter = typeof body.contextAfter === "string" ? body.contextAfter : undefined;
    const hint = typeof body.hint === "string" ? body.hint : undefined;
    const model = body.model as "claude-code" | "codex" | undefined;
    if (!elementId || !markedText) return c.json({ error: "elementId + markedText required" }, 400);
    const element = await deps.elements.get(elementId);
    if (!element) return c.json({ error: "element not found" }, 404);
    const adapter = pickAdapter(deps.adapters, model);
    const sig = c.req.raw.signal;
    const reqId = newReqId();
    const logCtx = { reqId, op: c.req.path, elementId, adapter: adapter.name, annotationId };
    log.info("ai.op.start", logCtx);
    return streamElementOp({
      logger: log, logCtx,
      c, lock, element,
      operation: analyzeMark(adapter, {
        element, markedText, contextBefore, contextAfter, hint,
        sessionId: resumableSessionFor(element, adapter.name),
        signal: sig,
        manual: await knowledgeManualFragment(deps.aiDir),
      }),
      onDone: async (result, sessionId) => {
        const now = new Date().toISOString();
        if (annotationId) {
          // Inline path: attach analysis to the annotation; no element mutation.
          await deps.annotations.update(annotationId, {
            analysis: { title: result.title, body: result.body, aiModel: adapter.name, createdAt: now },
          });
        } else {
          // Fallback: append as element extraSection.
          const content = { ...(element.content as Record<string, unknown>) };
          const existing = Array.isArray(content.extraSections) ? [...(content.extraSections as Array<{title:string;id:string}>)] : [];
          const dupIdx = existing.findIndex(s => s.title === result.title);
          const section = {
            id: dupIdx >= 0 ? existing[dupIdx].id : `analyze-${Date.now().toString(36)}`,
            title: result.title,
            body: result.body,
          };
          if (dupIdx >= 0) existing[dupIdx] = section;
          else existing.push(section);
          content.extraSections = existing;
          await deps.elements.put(elementMetadataWithSession(
            { ...element, content },
            sessionId, adapter.name,
          ));
        }
        await recordSignal(deps.signals, {
          ts: now, type: "op.completed", manual: "knowledge",
          op: "analyze-mark", adapter: adapter.name, elementId,
          data: { markedText, annotationId, title: result.title },
        });
      },
      onError: async (message) => {
        await recordSignal(deps.signals, {
          ts: new Date().toISOString(), type: "op.failed", manual: "knowledge",
          op: "analyze-mark", adapter: adapter.name, elementId,
          data: { markedText, annotationId, message },
        });
      },
    });
  });

  // ----- list Q&A for an element -----
  r.get("/qa", async (c) => {
    const elementId = c.req.query("elementId");
    if (!elementId) return c.json({ error: "elementId required" }, 400);
    const list = await deps.qa.listForElement(elementId);
    return c.json(list);
  });

  // ----- delete one Q&A -----
  r.delete("/qa/:id", async (c) => {
    const id = c.req.param("id");
    const ok = await deps.qa.remove(id);
    if (!ok) return c.json({ error: "not found" }, 404);
    return c.body(null, 204);
  });

  // ----- AI 早报 (daily news generation) -----
  // POST /api/ai/news/generate-daily { date?: "YYYY-MM-DD", model? }
  // Streams SSE deltas while codex fetches & writes; on done, materializes
  // a date-roundup parent element + N child news elements under `ai-news`.
  r.post("/news/generate-daily", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const dateRaw = typeof body.date === "string" ? body.date.trim() : "";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
      ? dateRaw
      : new Date().toISOString().slice(0, 10);
    const model = body.model as "claude-code" | "codex" | undefined;
    // Make sure the ai-news parent topic exists; refuse otherwise (someone
    // could have deleted the topic root). Don't auto-create — that's an
    // editorial choice the user should make.
    const parent = await deps.elements.get("ai-news");
    if (!parent) return c.json({ error: "ai-news topic not found; create it first" }, 404);
    const adapter = pickAdapter(deps.adapters, model);
    const signal = c.req.raw.signal;
    const reqId = newReqId();
    const t0 = Date.now();
    log.info("ai.op.start", { reqId, op: "/api/ai/news/generate-daily", date, adapter: adapter.name });

    const dailyRoundupId = `ai-news.${date}`;

    return streamSSE(c, async (stream) => {
      let deltas = 0;
      try {
        for await (const ev of generateDailyNews(adapter, { date, signal })) {
          if (ev.type === "delta") { deltas++; }
          if (ev.type === "error") {
            log.error("ai.op.error", { reqId, durationMs: Date.now() - t0, deltas, message: ev.message });
            await recordSignal(deps.signals, {
              ts: new Date().toISOString(), type: "op.failed", manual: "knowledge",
              op: "generate-daily-news", adapter: adapter.name,
              data: { date, durationMs: Date.now() - t0, message: ev.message },
            });
          }
          await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
          if (ev.type !== "done") continue;

          // Materialize: build daily-roundup parent + child news elements.
          const result = ev.result;
          const now = new Date().toISOString();
          const roundup: Element = {
            id: dailyRoundupId,
            type: "report",
            title: `${date} AI 早报`,
            subtitle: result.editorNote.split(/[\n。]/).find(s => s.trim()) ?? `${date} 当日 AI 进展速览`,
            tags: ["ai-news", `date:${date}`, "daily-roundup"],
            content: {
              sections: [{
                id: "editor-note",
                title: "编辑按语",
                blocks: [{ style: "prose", text: result.editorNote }],
              }],
            },
            metadata: {
              createdAt: now, updatedAt: now,
              generatedBy: "ai", aiModel: adapter.name,
              richness: 2,
            },
          };
          await deps.elements.put(roundup);
          await deps.relations.append([{
            id: `rel.ai-news-child-${dailyRoundupId}`,
            kind: "child", from: "ai-news", to: dailyRoundupId, createdAt: now,
          }]);

          const childRelations: Array<{ id: string; kind: "child"; from: string; to: string; createdAt: string }> = [];
          for (let i = 0; i < result.items.length; i++) {
            const item: DailyNewsItem = result.items[i];
            const slug = slugify(item.title) || `item-${i + 1}`;
            const childId = `${dailyRoundupId}.${slug}`;
            const child: Element = {
              id: childId,
              type: "report",
              title: item.title,
              subtitle: item.subtitle,
              tags: ["ai-news", `category:${item.category}`, `impact:${item.impact}`, `date:${date}`],
              content: { sections: item.sections },
              metadata: {
                createdAt: now, updatedAt: now,
                generatedBy: "ai", aiModel: adapter.name,
                richness: 2,
              },
            };
            await deps.elements.put(child);
            childRelations.push({
              id: `rel.${dailyRoundupId}-child-${childId}`,
              kind: "child", from: dailyRoundupId, to: childId, createdAt: now,
            });
            // Hand off image-placeholders inside the news item to the image engine.
            void imageQueue.scheduleForElement(childId);
          }
          await deps.relations.append(childRelations);

          log.info("ai.op.done", { reqId, durationMs: Date.now() - t0, deltas, items: result.items.length });
          await recordSignal(deps.signals, {
            ts: new Date().toISOString(), type: "op.completed", manual: "knowledge",
            op: "generate-daily-news", adapter: adapter.name, elementId: dailyRoundupId,
            data: { date, durationMs: Date.now() - t0, itemCount: result.items.length },
          });
          await stream.writeSSE({
            event: "materialized",
            data: JSON.stringify({ roundupId: dailyRoundupId, itemCount: result.items.length }),
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log.error("ai.op.error", { reqId, durationMs: Date.now() - t0, message: msg });
        await stream.writeSSE({ event: "error", data: JSON.stringify({ type: "error", message: msg }) });
      }
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
