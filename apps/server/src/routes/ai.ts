import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Element, PathKind, RichnessLevel } from "@ke/domain";
import type { AIAdapter } from "../ai/adapter.js";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { RelationsRepo } from "../repos/RelationsRepo.js";
import type { PathsRepo } from "../repos/PathsRepo.js";
import { pickAdapter } from "../ai/pickAdapter.js";
import {
  generateTreeFor,
  refineElement,
  expandElement,
  extendElement,
  generatePathsFor,
} from "../ai/operations.js";
import { KeyedLock } from "../lib/KeyedLock.js";
import { streamElementOp } from "./streamElementOp.js";

export interface AiRoutesDeps {
  adapters: AIAdapter[];
  elements: ElementsRepo;
  relations: RelationsRepo;
  paths: PathsRepo;
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

  // ----- generate-tree: not element-bound, has its own SSE shape -----
  r.post("/generate-tree", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const topic = String(body.topic ?? "").trim();
    const model = body.model as "claude-code" | "codex" | undefined;
    const richness = (body.richness ?? 2) as RichnessLevel;
    if (!topic) return c.json({ error: "topic required" }, 400);
    const adapter = pickAdapter(deps.adapters, model);
    const signal = c.req.raw.signal;
    return streamSSE(c, async (stream) => {
      for await (const ev of generateTreeFor(adapter, { topic, richness, signal })) {
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
    return streamElementOp({
      c, lock, element,
      operation: refineElement(adapter, {
        element, targetRichness,
        sessionId: element.metadata.aiSessionId,
        signal,
      }),
      onDone: async (result, sessionId) => {
        await deps.elements.put(elementMetadataWithSession(
          { ...element, content: result.content },
          sessionId, adapter.name,
          { richness: targetRichness },
        ));
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
    return streamElementOp({
      c, lock, element: parent,
      operation: expandElement(adapter, {
        parent, existingChildren, count,
        sessionId: parent.metadata.aiSessionId,
        signal,
      }),
      onDone: async (result, sessionId) => {
        for (const el of result.elements) await deps.elements.put(el);
        await deps.relations.append(result.relations);
        await deps.elements.put(elementMetadataWithSession(parent, sessionId, adapter.name));
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
    return streamElementOp({
      c, lock, element,
      operation: extendElement(adapter, {
        element, direction, count,
        sessionId: element.metadata.aiSessionId,
        signal,
      }),
      onDone: async (result, sessionId) => {
        for (const el of result.elements) await deps.elements.put(el);
        await deps.relations.append(result.relations);
        await deps.elements.put(elementMetadataWithSession(element, sessionId, adapter.name));
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
    return streamElementOp({
      c, lock, element: center,
      operation: generatePathsFor(adapter, {
        center, availableElements, kinds,
        sessionId: center.metadata.aiSessionId,
        signal,
      }),
      onDone: async (result, sessionId) => {
        const existing = await deps.paths.byCenter(elementId);
        await deps.paths.putForCenter(elementId, [...existing, ...result.paths]);
        await deps.elements.put(elementMetadataWithSession(center, sessionId, adapter.name));
      },
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
