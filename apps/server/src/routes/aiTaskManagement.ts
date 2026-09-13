import { Hono } from "hono";
import { z } from "zod";
import type { AiTaskManagementService } from "../ai-task-management/service.js";
import { aiTaskScenes } from "../repos/AiTaskManagementRepo.js";
import { eventBus } from "../lib/eventBus.js";

const resource = z.object({ id: z.string().min(1), label: z.string().min(1), path: z.string().optional(), mime: z.string().optional() });
const createSchema = z.object({ sceneId: z.enum(aiTaskScenes), title: z.string().trim().min(1).max(280), input: z.object({ text: z.string().max(30000), images: z.array(resource).max(10).default([]), materials: z.array(resource).max(50).default([]) }), payload: z.record(z.string(), z.unknown()).default({}), contextSummary: z.string().max(4000).optional(), sourceConversationId: z.string().optional(), projectId: z.string().optional(), deliverableId: z.string().optional() });

export function aiTaskManagementRoutes(tasks: AiTaskManagementService): Hono {
  const r = new Hono();
  r.get("/", async c => c.json({ tasks: await tasks.list() }));
  r.post("/drafts", async c => { const parsed = createSchema.safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: "schema validation failed", issues: parsed.error.issues }, 400); const task = await tasks.saveDraft(parsed.data); eventBus.publish("ai_task.changed", { source: "route", detail: { taskId: task.id, op: "draft" } }); return c.json(task, 201); });
  r.post("/", async c => { const parsed = createSchema.safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: "schema validation failed", issues: parsed.error.issues }, 400); const task = await tasks.create(parsed.data); eventBus.publish("ai_task.changed", { source: "route", detail: { taskId: task.id, op: "create" } }); return c.json(task, 201); });
  r.put("/:id/draft", async c => { const parsed = createSchema.safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: "schema validation failed", issues: parsed.error.issues }, 400); const task = await tasks.saveDraft(parsed.data, c.req.param("id")); eventBus.publish("ai_task.changed", { source: "route", detail: { taskId: task.id, op: "draft" } }); return c.json(task); });
  r.put("/:id/publish", async c => { const parsed = createSchema.safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: "schema validation failed", issues: parsed.error.issues }, 400); const task = await tasks.publishDraft(c.req.param("id"), parsed.data); eventBus.publish("ai_task.changed", { source: "route", detail: { taskId: task.id, op: "publish" } }); return c.json(task); });
  r.get("/:id", async c => c.json(await tasks.getPacket(c.req.param("id"))));
  r.post("/:id/claim", async c => { const agentId = String((await c.req.json().catch(() => ({})) as { agentId?: unknown }).agentId ?? "").trim(); if (!agentId) return c.json({ error: "agentId required" }, 400); const result = await tasks.claim(c.req.param("id"), agentId); if (!result.ok) return c.json({ error: "already claimed", conflict: result.conflict }, 409); eventBus.publish("ai_task.changed", { source: "route", detail: { taskId: result.task.id, op: "claim" } }); return c.json(result); });
  r.post("/:id/result", async c => { const body = await c.req.json().catch(() => null); const parsed = z.object({ agentId: z.string().min(1), title: z.string().trim().min(1).max(280).optional(), analysis: z.string().min(1).max(4000), result: z.string().min(1).max(4000), carryForward: z.string().min(1).max(2000), pending: z.string().max(2000).optional(), statusAfter: z.enum(["needs_review", "blocked"]) }).safeParse(body); if (!parsed.success) return c.json({ error: "schema validation failed", issues: parsed.error.issues }, 400); const node = await tasks.reportResult(c.req.param("id"), parsed.data.agentId, parsed.data); eventBus.publish("ai_task.changed", { source: "route", detail: { taskId: node.taskId, op: "result" } }); return c.json(node, 201); });
  r.post("/:id/continue", async c => { const task = await tasks.continue(c.req.param("id")); eventBus.publish("ai_task.changed", { source: "route", detail: { taskId: task.id, op: "continue" } }); return c.json(task, 201); });
  r.post("/:id/resolve", async c => { const task = await tasks.resolve(c.req.param("id")); eventBus.publish("ai_task.changed", { source: "route", detail: { taskId: task.id, op: "resolve" } }); return c.json(task); });
  r.delete("/:id", async c => { const id = c.req.param("id"); await tasks.remove(id); eventBus.publish("ai_task.changed", { source: "route", detail: { taskId: id, op: "delete" } }); return c.body(null, 204); });
  return r;
}
