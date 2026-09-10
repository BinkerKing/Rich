import { Hono } from "hono";
import type { FlowchartsRepo } from "../repos/FlowchartsRepo.js";

export function flowchartsRoutes(repo: FlowchartsRepo): Hono {
  const route = new Hono();
  const graph = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  route.get("/", async c => c.json(await repo.list()));
  route.get("/:id", async c => { const item = await repo.get(c.req.param("id")); return item ? c.json(item) : c.json({ error: "flowchart not found" }, 404); });
  route.post("/", async c => {
    const body = await c.req.json().catch(() => ({})) as { title?: unknown; graph?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : ""; const value = graph(body.graph);
    return title && value ? c.json(await repo.create({ title, graph: value }), 201) : c.json({ error: "title and graph are required" }, 400);
  });
  route.patch("/:id", async c => {
    const body = await c.req.json().catch(() => ({})) as { title?: unknown; graph?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : undefined; const value = body.graph === undefined ? undefined : graph(body.graph);
    if (body.title !== undefined && !title || body.graph !== undefined && !value) return c.json({ error: "invalid flowchart patch" }, 400);
    const item = await repo.update(c.req.param("id"), { ...(title !== undefined ? { title } : {}), ...(value ? { graph: value } : {}) });
    return item ? c.json(item) : c.json({ error: "flowchart not found" }, 404);
  });
  route.delete("/:id", async c => (await repo.remove(c.req.param("id"))) ? c.body(null, 204) : c.json({ error: "flowchart not found" }, 404));
  return route;
}
