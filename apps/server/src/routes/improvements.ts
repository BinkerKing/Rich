import { Hono } from "hono";
import { z } from "zod";
import type {
  ImprovementsStore, ImprovementStatus, ImprovementPriority,
} from "../repos/ImprovementsRepo.js";
import { eventBus } from "../lib/eventBus.js";

/**
 * HTTP API for the system-improvement task board.
 *
 * GET  /api/improvements             — list (filter by status)
 * GET  /api/improvements/:id         — single record
 * POST /api/improvements             — create (typically from UI; Hermes uses MCP)
 * PATCH /api/improvements/:id        — update fields / status (with verification audit)
 * DELETE /api/improvements/:id       — remove
 *
 * All mutations publish an `improvement.changed` event on the bus so any
 * connected UI re-hydrates within ~500ms.
 */

const ImprovementStatusEnum = z.enum(["pending", "ready_to_develop", "ready_to_verify", "verified", "rejected"]);
const ImprovementPriorityEnum = z.enum(["low", "medium", "high"]);
const DevTaskSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(220),
  detail: z.string().max(4000).optional(),
  status: z.enum(["todo", "doing", "done", "blocked"]).optional(),
  priority: ImprovementPriorityEnum.optional(),
});

const CreateSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(4000).optional(),
  reason: z.string().max(2000).optional(),
  prdContent: z.string().max(30000).optional(),
  tasks: z.array(DevTaskSchema).max(100).optional(),
  priority: ImprovementPriorityEnum.optional(),
  category: z.string().max(60).optional(),
  createdBy: z.enum(["hermes", "user"]).optional(),
  relatedFiles: z.array(z.string().max(400)).max(20).optional(),
});

const UpdateSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(4000).optional(),
  reason: z.string().max(2000).optional(),
  prdContent: z.string().max(30000).optional(),
  tasks: z.array(DevTaskSchema).max(100).nullable().optional(),
  status: ImprovementStatusEnum.optional(),
  priority: ImprovementPriorityEnum.nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  relatedFiles: z.array(z.string().max(400)).max(20).nullable().optional(),
  verificationNotes: z.string().max(2000).optional(),
});

export function improvementsRoutes(repo: ImprovementsStore): Hono {
  const r = new Hono();

  r.get("/", async (c) => {
    const statusQ = c.req.query("status");
    const limitQ = c.req.query("limit");
    const status = statusQ && (["pending", "ready_to_develop", "ready_to_verify", "verified", "rejected"] as const).includes(statusQ as ImprovementStatus)
      ? statusQ as ImprovementStatus : undefined;
    const limit = limitQ ? Math.min(500, Math.max(1, Number(limitQ))) : 200;
    const items = await repo.list({ status, limit });
    const counts = await repo.countByStatus();
    return c.json({ items, counts });
  });

  r.get("/:id", async (c) => {
    const item = await repo.get(c.req.param("id"));
    if (!item) return c.json({ error: "not found" }, 404);
    return c.json(item);
  });

  r.post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "schema validation failed", issues: parsed.error.issues }, 400);
    }
    const created = await repo.create(parsed.data);
    eventBus.publish("improvement.changed", { source: "route", detail: { op: "create", id: created.id } });
    return c.json(created, 201);
  });

  r.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "schema validation failed", issues: parsed.error.issues }, 400);
    }
    const updated = await repo.update(id, parsed.data);
    if (!updated) return c.json({ error: "not found" }, 404);
    eventBus.publish("improvement.changed", { source: "route", detail: { op: "update", id } });
    return c.json(updated);
  });

  r.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const ok = await repo.remove(id);
    if (!ok) return c.json({ error: "not found" }, 404);
    eventBus.publish("improvement.changed", { source: "route", detail: { op: "delete", id } });
    return c.json({ ok: true });
  });

  /**
   * 认领：原子标记 assigned_agent_id。其他 agent 同时打这个接口会收到 409。
   *
   *   POST /api/improvements/:id/claim
   *   body: { agentId: "mac-mini.local-hermes" }
   *
   *   200 { task }  → 抢到（或同一 agent 重入幂等）
   *   409 { error, conflict: { currentAgentId, assignedAt } } → 别人已占
   *   404 { error: "not found" }
   */
  r.post("/:id/claim", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => null) as { agentId?: unknown } | null;
    const agentId = typeof body?.agentId === "string" ? body.agentId.trim() : "";
    if (!agentId) return c.json({ error: "agentId required" }, 400);
    if (agentId.length > 120) return c.json({ error: "agentId too long" }, 400);
    const existing = await repo.get(id);
    if (!existing) return c.json({ error: "not found" }, 404);
    const result = await repo.claim(id, agentId);
    if (result.ok) {
      eventBus.publish("improvement.changed", { source: "route", detail: { op: "claim", id, agentId } });
      return c.json({ task: result.task });
    }
    return c.json({
      error: "already claimed",
      conflict: result.conflict,
    }, 409);
  });

  /**
   * 释放：清空 assigned_agent_id。
   *
   *   POST /api/improvements/:id/release
   *   body: { agentId: "mac-mini.local-hermes" }   ← 校验归属：只能释放自己持有的
   *   body: { force: true }                          ← 强制释放（admin UI 用，用于 agent 卡死时手动 unstick）
   */
  r.post("/:id/release", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({})) as { agentId?: unknown; force?: unknown };
    const force = body.force === true;
    const agentId = typeof body.agentId === "string" ? body.agentId.trim() : "";
    if (!force && !agentId) return c.json({ error: "agentId required (or force=true)" }, 400);
    const existing = await repo.get(id);
    if (!existing) return c.json({ error: "not found" }, 404);
    const released = await repo.release(id, force ? null : agentId);
    eventBus.publish("improvement.changed", { source: "route", detail: { op: "release", id } });
    return c.json({ task: released });
  });

  return r;
}

// Re-export helpers consumed by the route's caller (mostly type aliases).
export type { ImprovementStatus, ImprovementPriority };
