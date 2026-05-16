import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AIAdapter } from "../ai/adapter.js";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import { generateTree, pickAdapter } from "../ai/orchestrator.js";

export function aiRoutes(adapters: AIAdapter[], repo: ElementsRepo): Hono {
  const r = new Hono();
  r.post("/generate-tree", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const topic = String(body.topic ?? "").trim();
    const model = body.model as "claude-code" | "codex" | undefined;
    const richness = (body.richness ?? 2) as 1 | 2 | 3 | 4 | 5;
    if (!topic) return c.json({ error: "topic required" }, 400);
    const adapter = pickAdapter(adapters, model);
    return streamSSE(c, async (stream) => {
      for await (const ev of generateTree(adapter, { topic, richness })) {
        await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
        if (ev.type === "done") {
          for (const el of ev.result.elements) {
            await repo.put(el);
          }
        }
      }
    });
  });
  return r;
}
