import { Hono } from "hono";
import type { ElementsRepo } from "../repos/ElementsRepo.js";

export function elementsRoutes(repo: ElementsRepo): Hono {
  const r = new Hono();
  r.get("/", async (c) => c.json(await repo.list()));
  r.get("/:id", async (c) => {
    const el = await repo.get(c.req.param("id"));
    if (!el) return c.json({ error: "not found" }, 404);
    return c.json(el);
  });
  return r;
}
