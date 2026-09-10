import { Hono } from "hono";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile, rm } from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";
import { WorkbenchService } from "../task-workbench/service.js";
import { WorkbenchCommands } from "../task-workbench/commands.js";
import { RichMcpError } from "../mcp-v2/registry/errors.js";

export function taskWorkbenchRoutes(tasks: WorkbenchService, commands: WorkbenchCommands, storageRoot: string): Hono {
  const r = new Hono();
  r.onError((error, c) => {
    const status = error instanceof z.ZodError ? 400 : error instanceof RichMcpError ? error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400 : 500;
    return c.json({ error: error.message }, status);
  });
  r.get("/", async c => c.json({ tasks: await tasks.list() }));
  r.post("/", async c => c.json({ task: await tasks.create(await c.req.json()) }, 201));
  r.get("/:id", async c => c.json({ task: await tasks.get(c.req.param("id")) }));
  r.get("/:id/history", async c => { await tasks.get(c.req.param("id")); return c.json({ versions: await tasks.repo.history(c.req.param("id")) }); });
  r.get("/:id/requirement-history", async c => { await tasks.get(c.req.param("id")); return c.json({ versions: await tasks.repo.requirementHistory(c.req.param("id")) }); });
  r.post("/:id/write", async c => c.json({ task: await tasks.write(c.req.param("id"), await c.req.json()) }));
  r.get("/:id/conversation", async c => c.json({ conversation: await tasks.binding(await tasks.get(c.req.param("id"))) }));
  r.post("/:id/commands", async c => c.json({ command: await commands.dispatch(c.req.param("id"), await c.req.json()) }, 202));
  r.post("/:id/materials", async c => {
    const task = await tasks.get(c.req.param("id"));
    const form = await c.req.formData(); const file = form.get("file");
    const expectedVersion = Number(form.get("expectedVersion"));
    if (!(file instanceof File) || !file.name || file.size > 50 * 1024 * 1024) return c.json({ error: "请选择 50 MB 以内的材料" }, 400);
    const directory = join(storageRoot, task.id, randomUUID());
    const path = join(directory, basename(file.name).replaceAll("\\", "_") || "material");
    await mkdir(directory, { recursive: true });
    try {
      await writeFile(path, Buffer.from(await file.arrayBuffer()), { flag: "wx" });
      const updated = await tasks.write(task.id, { action: "resource", expectedVersion, input: { kind: "material", format: "file", title: file.name, location: path, summary: `${file.size} bytes` } });
      return c.json({ task: updated }, 201);
    } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
  });
  r.get("/:id/resources/:resourceId/download", async c => {
    const task = await tasks.get(c.req.param("id"));
    const resource = task.resources.find(item => item.id === c.req.param("resourceId"));
    if (!resource || !isAbsolute(resource.location)) return c.json({ error: "没有可下载的本地文件" }, 404);
    const info = await stat(resource.location).catch(() => null);
    if (!info?.isFile() || info.size > 50 * 1024 * 1024) return c.json({ error: "文件不存在、是目录或超过 50 MB；请在 Codex 中查看" }, 400);
    return new Response(new Uint8Array(await readFile(resource.location)), { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(basename(resource.location))}`, "X-Content-Type-Options": "nosniff" } });
  });
  return r;
}
