import { Hono } from "hono";
import type { DeliverablesRepo } from "../repos/DeliverablesRepo.js";

const content = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

export function deliverablesRoutes(repo: DeliverablesRepo): Hono {
  const route = new Hono();
  route.get("/", async c => c.json(await repo.list()));
  route.get("/:id", async c => { const item = await repo.get(c.req.param("id")); return item ? c.json(item) : c.json({ error: "deliverable not found" }, 404); });
  route.post("/", async c => {
    const body = await c.req.json().catch(() => ({})) as { title?: unknown; content?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : ""; const value = content(body.content);
    return title && value ? c.json(await repo.create({ title, content: value }), 201) : c.json({ error: "title and content are required" }, 400);
  });
  route.patch("/:id", async c => {
    const body = await c.req.json().catch(() => ({})) as { title?: unknown; content?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : undefined; const value = body.content === undefined ? undefined : content(body.content);
    if ((body.title !== undefined && !title) || (body.content !== undefined && !value)) return c.json({ error: "invalid deliverable patch" }, 400);
    const item = await repo.update(c.req.param("id"), { ...(title !== undefined ? { title } : {}), ...(value ? { content: value } : {}) });
    return item ? c.json(item) : c.json({ error: "deliverable not found" }, 404);
  });
  route.delete("/:id", async c => (await repo.remove(c.req.param("id"))) ? c.body(null, 204) : c.json({ error: "deliverable not found" }, 404));
  return route;
}
