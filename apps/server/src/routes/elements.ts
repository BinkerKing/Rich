import { Hono } from "hono";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { SignalsRepo } from "../repos/SignalsRepo.js";
import { recordSignal } from "../ai/signalRecorder.js";

export function elementsRoutes(repo: ElementsRepo, signals?: SignalsRepo): Hono {
  const r = new Hono();
  r.get("/", async (c) => c.json(await repo.list()));
  r.get("/:id", async (c) => {
    const el = await repo.get(c.req.param("id"));
    if (!el) return c.json({ error: "not found" }, 404);
    return c.json(el);
  });
  r.get("/:id/history", async (c) => {
    const id = c.req.param("id");
    const el = await repo.get(id);
    if (!el) return c.json({ error: "not found" }, 404);
    const versions = await repo.listVersions(id);
    return c.json(versions);
  });
  r.post("/:id/revert", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const timestamp = String(body.timestamp ?? "");
    if (!timestamp) return c.json({ error: "timestamp required" }, 400);
    try {
      const restored = await repo.revertTo(id, timestamp);
      if (signals) {
        await recordSignal(signals, {
          ts: new Date().toISOString(),
          type: "user.reverted",
          manual: "knowledge",
          elementId: id,
          data: { fromTimestamp: timestamp },
        });
      }
      return c.json(restored);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith("no such version")) return c.json({ error: msg }, 404);
      throw err;
    }
  });
  return r;
}
