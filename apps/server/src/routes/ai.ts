import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AIAdapter } from "../ai/adapter.js";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { RelationsRepo } from "../repos/RelationsRepo.js";
import type { PathsRepo } from "../repos/PathsRepo.js";
import { generateTree, pickAdapter } from "../ai/orchestrator.js";

export interface AiRoutesDeps {
  adapters: AIAdapter[];
  elements: ElementsRepo;
  relations: RelationsRepo;
  paths: PathsRepo;
}

export function aiRoutes(deps: AiRoutesDeps): Hono {
  const r = new Hono();
  r.post("/generate-tree", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const topic = String(body.topic ?? "").trim();
    const model = body.model as "claude-code" | "codex" | undefined;
    const richness = (body.richness ?? 2) as 1 | 2 | 3 | 4 | 5;
    if (!topic) return c.json({ error: "topic required" }, 400);
    const adapter = pickAdapter(deps.adapters, model);
    return streamSSE(c, async (stream) => {
      for await (const ev of generateTree(adapter, { topic, richness })) {
        await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
        if (ev.type === "done") {
          for (const el of ev.result.elements) {
            await deps.elements.put(el);
          }
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
  return r;
}
