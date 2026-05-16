import { Hono } from "hono";
import type { SignalsRepo } from "../repos/SignalsRepo.js";
import type { Signal } from "@ke/domain";

export function signalsRoutes(repo: SignalsRepo): Hono {
  const r = new Hono();
  r.get("/", async (c) => {
    const manual = c.req.query("manual");
    const type = c.req.query("type") as Signal["type"] | undefined;
    const elementId = c.req.query("elementId");
    const since = c.req.query("since");
    const limit = c.req.query("limit") ? Number(c.req.query("limit")) : undefined;
    return c.json(await repo.list({ manual, type, elementId, since, limit }));
  });
  r.get("/count", async (c) => c.json({ count: await repo.count() }));
  return r;
}
