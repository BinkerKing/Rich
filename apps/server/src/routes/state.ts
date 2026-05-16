import { Hono } from "hono";
import type { StateRepo } from "../repos/StateRepo.js";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { SignalsRepo } from "../repos/SignalsRepo.js";
import { recordSignal } from "../ai/signalRecorder.js";

export function stateRoutes(state: StateRepo, elements: ElementsRepo, signals?: SignalsRepo): Hono {
  const r = new Hono();

  r.get("/center", async (c) => {
    const limit = Number(c.req.query("limit") ?? 10);
    const current = await state.getCenter();
    const recent = await state.recentChanges(limit);
    return c.json({
      current: current.elementId,
      updatedAt: current.updatedAt,
      recent: recent.map(rc => rc.to),
      changes: recent,
    });
  });

  r.post("/center", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const elementId = String(body.elementId ?? "");
    if (!elementId) return c.json({ error: "elementId required" }, 400);
    const el = await elements.get(elementId);
    if (!el) return c.json({ error: "element not found" }, 404);
    const change = await state.setCenter(elementId);
    if (signals) {
      await recordSignal(signals, {
        ts: change.ts,
        type: "user.changed_center",
        manual: "knowledge",
        elementId,
        data: { from: change.from, to: change.to, dwellMs: change.dwellMs },
      });
    }
    return c.json({ current: elementId, change });
  });

  return r;
}
