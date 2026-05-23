import { Hono } from "hono";
import type { ToolRuntime } from "../tools/runtime.js";
import type { InvocationsRepo } from "../repos/InvocationsRepo.js";

/**
 * Toolbox HTTP API.
 *
 * GET  /api/toolbox/tools                  — list registered tools (UI form gen)
 * GET  /api/toolbox/invocations            — invocation log (filterable)
 * POST /api/toolbox/invoke                 — { tool, args } → invocation
 * POST /api/toolbox/invocations/:id/cancel — cancel a scheduled invocation
 */
export function toolboxRoutes(runtime: ToolRuntime, repo: InvocationsRepo): Hono {
  const r = new Hono();

  r.get("/tools", async (c) => {
    try {
      return c.json({ tools: runtime.listTools() });
    } catch (e) {
      // Surface the stack — easier than digging through Electron stderr.
      return c.json({
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      }, 500);
    }
  });

  r.get("/invocations", async (c) => {
    const tool = c.req.query("tool") || undefined;
    const status = c.req.query("status") || undefined;
    const limit = c.req.query("limit") ? Number(c.req.query("limit")) : 100;
    const items = repo.list({
      toolName: tool,
      // status validated inside repo via index; cast is safe because invalid
      // values just return empty results from a typed column.
      status: (status as Parameters<InvocationsRepo["list"]>[0] extends infer T
        ? T extends { status?: infer S } ? S : never : never) || undefined,
      limit,
    });
    const counts = repo.countByStatus();
    return c.json({ items, counts });
  });

  r.post("/invoke", async (c) => {
    const body = await c.req.json().catch(() => null) as
      | { tool?: string; args?: unknown } | null;
    if (!body || typeof body.tool !== "string") {
      return c.json({ error: "tool name required" }, 400);
    }
    try {
      const inv = await runtime.invoke({
        toolName: body.tool,
        args: body.args ?? {},
        createdBy: "user",
      });
      return c.json(inv, 202);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  });

  r.post("/invocations/:id/cancel", async (c) => {
    const id = c.req.param("id");
    const ok = runtime.cancel(id);
    if (!ok) return c.json({ error: "not cancellable (already ran / unknown id)" }, 400);
    return c.json({ ok: true });
  });

  return r;
}
