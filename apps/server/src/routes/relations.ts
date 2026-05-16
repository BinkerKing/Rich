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
  return r;
}
