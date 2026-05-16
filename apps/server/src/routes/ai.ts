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

export interface AiRoutesDeps {
  adapters: AIAdapter[];
  elements: ElementsRepo;
  relations: RelationsRepo;
  paths: PathsRepo;
}

async function withElement(
  deps: AiRoutesDeps,
  id: string,
): Promise<Element | null> {
  if (!id) return null;
  return deps.elements.get(id);
}

async function saveSessionOnElement(
  deps: AiRoutesDeps,
  element: Element,
  sessionId: string | undefined,
  modelName: string,
): Promise<void> {
  if (!sessionId) return;
  const updated: Element = {
    ...element,
    metadata: {
      ...element.metadata,
      aiSessionId: sessionId,
      aiModel: modelName,
      updatedAt: new Date().toISOString(),
    },
  };
  await deps.elements.put(updated);
}

export function aiRoutes(deps: AiRoutesDeps): Hono {
  const r = new Hono();

  // ----- generate-tree (existing) -----
  r.post("/generate-tree", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const topic = String(body.topic ?? "").trim();
    const model = body.model as "claude-code" | "codex" | undefined;
    const richness = (body.richness ?? 2) as RichnessLevel;
    if (!topic) return c.json({ error: "topic required" }, 400);
    const adapter = pickAdapter(deps.adapters, model);
    return streamSSE(c, async (stream) => {
      for await (const ev of generateTreeFor(adapter, { topic, richness })) {
        await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
        if (ev.type === "done") {
          for (const el of ev.result.elements) await deps.elements.put(el);
          await deps.relations.append(ev.result.relations);
          const pathsByCenter = new Map<string, typeof ev.result.paths>();
          for (const p of ev.result.paths) {
            const list = pathsByCenter.get(p.centerElementId) ?? [];
            list.push(p);
            pathsByCenter.set(p.centerElementId, list);
          }
          for (const [centerId, list] of pathsByCenter) {
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
    const element = await withElement(deps, elementId);
    if (!element) return c.json({ error: "element not found" }, 404);
    const adapter = pickAdapter(deps.adapters, model);
    return streamSSE(c, async (stream) => {
      for await (const ev of refineElement(adapter, {
        element,
        targetRichness,
        sessionId: element.metadata.aiSessionId,
      })) {
        await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
        if (ev.type === "done") {
          const updated: Element = {
            ...element,
            content: ev.result.content,
            metadata: {
              ...element.metadata,
              richness: targetRichness,
              aiSessionId: ev.sessionId ?? element.metadata.aiSessionId,
              aiModel: adapter.name,
              updatedAt: new Date().toISOString(),
            },
          };
          await deps.elements.put(updated);
        }
      }
    });
  });

  // ----- expand (向下生成子元) -----
  r.post("/expand", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const elementId = String(body.elementId ?? "");
    const count = body.count as number | undefined;
    const model = body.model as "claude-code" | "codex" | undefined;
    const parent = await withElement(deps, elementId);
    if (!parent) return c.json({ error: "element not found" }, 404);
    const existingChildIds = (await deps.relations.byFrom(elementId))
      .filter((r) => r.kind === "child")
      .map((r) => r.to);
    const existingChildren: Element[] = [];
    for (const id of existingChildIds) {
      const el = await deps.elements.get(id);
      if (el) existingChildren.push(el);
    }
    const adapter = pickAdapter(deps.adapters, model);
    return streamSSE(c, async (stream) => {
      for await (const ev of expandElement(adapter, {
        parent,
        existingChildren,
        count,
        sessionId: parent.metadata.aiSessionId,
      })) {
        await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
        if (ev.type === "done") {
          for (const el of ev.result.elements) await deps.elements.put(el);
          await deps.relations.append(ev.result.relations);
          await saveSessionOnElement(deps, parent, ev.sessionId, adapter.name);
        }
      }
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
    const element = await withElement(deps, elementId);
    if (!element) return c.json({ error: "element not found" }, 404);
    const adapter = pickAdapter(deps.adapters, model);
    return streamSSE(c, async (stream) => {
      for await (const ev of extendElement(adapter, {
        element,
        direction,
        count,
        sessionId: element.metadata.aiSessionId,
      })) {
        await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
        if (ev.type === "done") {
          for (const el of ev.result.elements) await deps.elements.put(el);
          await deps.relations.append(ev.result.relations);
          await saveSessionOnElement(deps, element, ev.sessionId, adapter.name);
        }
      }
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
    const center = await withElement(deps, elementId);
    if (!center) return c.json({ error: "element not found" }, 404);
    // Provide AI with available element IDs from this center's subtree (children + grandchildren)
    const directChildren = (await deps.relations.byFrom(elementId))
      .filter((r) => r.kind === "child")
      .map((r) => r.to);
    const grandchildren: string[] = [];
    for (const cid of directChildren) {
      const grand = (await deps.relations.byFrom(cid))
        .filter((r) => r.kind === "child")
        .map((r) => r.to);
      grandchildren.push(...grand);
    }
    const availableIds = [...directChildren, ...grandchildren];
    const availableElements: Element[] = [];
    for (const id of availableIds) {
      const el = await deps.elements.get(id);
      if (el) availableElements.push(el);
    }
    const adapter = pickAdapter(deps.adapters, model);
    return streamSSE(c, async (stream) => {
      for await (const ev of generatePathsFor(adapter, {
        center,
        availableElements,
        kinds,
        sessionId: center.metadata.aiSessionId,
      })) {
        await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
        if (ev.type === "done") {
          const existing = await deps.paths.byCenter(elementId);
          const merged = [...existing, ...ev.result.paths];
          await deps.paths.putForCenter(elementId, merged);
          await saveSessionOnElement(deps, center, ev.sessionId, adapter.name);
        }
      }
    });
  });

  return r;
}
