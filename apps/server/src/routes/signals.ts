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

  // T18 客户端上报埋点（如首字 SLO 延迟）。schema 宽容 —— 仅校验
  // 关键字段；非法 payload 静默忽略不抛错（perf 报错不该阻塞 UI）
  r.post("/", async (c) => {
    try {
      const body = await c.req.json() as Partial<Signal>;
      if (!body.ts || !body.type) return c.json({ error: "ts/type required" }, 400);
      await repo.append(body as Signal);
      return c.json({ ok: true });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  });

  return r;
}
