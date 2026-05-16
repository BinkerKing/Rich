import { Hono } from "hono";
import type { PathsRepo } from "../repos/PathsRepo.js";

export function pathsRoutes(repo: PathsRepo): Hono {
  const r = new Hono();
  r.get("/", async (c) => {
    const center = c.req.query("center");
    if (center) return c.json(await repo.byCenter(center));
    return c.json(await repo.listAllCenters());
  });
  return r;
}
