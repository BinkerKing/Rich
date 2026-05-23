import { Hono } from "hono";
import type { RelationsRepo } from "../repos/RelationsRepo.js";

export function relationsRoutes(repo: RelationsRepo): Hono {
  const r = new Hono();
  r.get("/", async (c) => {
    const from = c.req.query("from");
    const to = c.req.query("to");
    if (from) return c.json(await repo.byFrom(from));
    if (to) return c.json(await repo.byTo(to));
    return c.json(await repo.list());
  });
  // Reorder direct children under a parent. Body: { parentId, childIds[] }.
  // Other relations (cross-parent, non-child kinds) are untouched. Children
  // not in childIds are appended at the end in their original order.
  r.post("/reorder-children", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parentId = typeof body.parentId === "string" ? body.parentId : "";
    const childIds = Array.isArray(body.childIds) ? body.childIds.filter((x: unknown): x is string => typeof x === "string") : null;
    if (!parentId) return c.json({ error: "parentId required" }, 400);
    if (!childIds) return c.json({ error: "childIds must be a string array" }, 400);
    await repo.reorderChildren(parentId, childIds);
    return c.json({ ok: true });
  });
  return r;
}
