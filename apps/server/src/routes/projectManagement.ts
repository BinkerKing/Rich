import { Hono } from "hono";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import {
  PROJECT_MANAGEMENT_MODULES,
  type ProjectManagementModuleKey,
  type ProjectManagementRepo,
} from "../repos/ProjectManagementRepo.js";

const ASSET_MIMES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const workspaceDir = process.env.RICH_WORKSPACE_DIR
  ? resolve(process.env.RICH_WORKSPACE_DIR)
  : resolve(process.env.HOME ?? process.cwd(), "Documents/Ai-WorkSpace");

const scenarioImageRoot = resolve(
  workspaceDir,
  "Tools",
  "数据映射治理平台",
  "public",
  "ops-manual-app",
  "data",
  "images",
);

export function projectManagementRoutes(repo: ProjectManagementRepo): Hono {
  const r = new Hono();

  r.use("/:projectId/dictionary/*", async (c, next) => {
    c.header("cache-control", "no-store");
    await next();
  });

  r.get("/:projectId/summary", async c => {
    const projectId = c.req.param("projectId");
    return c.json(await repo.getSummary(projectId));
  });

  r.get("/:projectId/search", async c => {
    const projectId = c.req.param("projectId");
    const q = c.req.query("q") ?? "";
    const limit = Number(c.req.query("limit") ?? 30);
    return c.json({
      query: q,
      results: await repo.searchAll(projectId, q, Number.isFinite(limit) ? limit : 30),
    });
  });

  r.get("/:projectId/modules/:moduleKey/items", async c => {
    const projectId = c.req.param("projectId");
    const moduleKey = c.req.param("moduleKey") as ProjectManagementModuleKey;
    const parentId = c.req.query("parentId") || undefined;
    if (!PROJECT_MANAGEMENT_MODULES.some(module => module.key === moduleKey)) {
      return c.json({ error: "unknown module" }, 404);
    }
    return c.json(await repo.listModuleItems(projectId, moduleKey, parentId));
  });

  r.get("/:projectId/assets/scenario-images/:filename", async c => {
    const filename = c.req.param("filename");
    const target = resolve(scenarioImageRoot, filename);
    if (!target.startsWith(`${scenarioImageRoot}/`) || !existsSync(target)) return c.notFound();
    const buf = await readFile(target);
    return c.body(new Uint8Array(buf), 200, {
      "content-type": ASSET_MIMES[extname(target).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "private, max-age=3600",
    });
  });

  r.post("/:projectId/modules/:moduleKey/items", async c => {
    const projectId = c.req.param("projectId");
    const moduleKey = c.req.param("moduleKey") as ProjectManagementModuleKey;
    if (!PROJECT_MANAGEMENT_MODULES.some(module => module.key === moduleKey)) {
      return c.json({ error: "unknown module" }, 404);
    }
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return c.json({ error: "title required" }, 400);
    const content = body.content && typeof body.content === "object" && !Array.isArray(body.content)
      ? body.content as Record<string, unknown>
      : {};
    return c.json(await repo.createModuleItem(projectId, {
      moduleKey,
      parentId: typeof body.parentId === "string" ? body.parentId : null,
      title,
      subtitle: typeof body.subtitle === "string" ? body.subtitle : null,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
      content,
    }), 201);
  });

  r.patch("/:projectId/modules/items/:itemId", async c => {
    const projectId = c.req.param("projectId");
    const itemId = c.req.param("itemId");
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const content = body.content && typeof body.content === "object" && !Array.isArray(body.content)
      ? body.content as Record<string, unknown>
      : undefined;
    const item = await repo.updateModuleItem(projectId, itemId, {
      parentId: body.parentId === null || typeof body.parentId === "string" ? body.parentId : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      subtitle: body.subtitle === null || typeof body.subtitle === "string" ? body.subtitle : undefined,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
      content,
    });
    if (!item) return c.json({ error: "item not found" }, 404);
    return c.json(item);
  });

  r.delete("/:projectId/modules/items/:itemId", async c => {
    const projectId = c.req.param("projectId");
    const itemId = c.req.param("itemId");
    const ok = await repo.deleteModuleItem(projectId, itemId);
    if (!ok) return c.json({ error: "item not found" }, 404);
    return c.json({ ok: true });
  });

  r.post("/:projectId/modules/:moduleKey/reorder", async c => {
    const projectId = c.req.param("projectId");
    const moduleKey = c.req.param("moduleKey") as ProjectManagementModuleKey;
    if (!PROJECT_MANAGEMENT_MODULES.some(module => module.key === moduleKey)) {
      return c.json({ error: "unknown module" }, 404);
    }
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const itemIds = Array.isArray(body.itemIds) ? body.itemIds.filter((id): id is string => typeof id === "string") : [];
    await repo.reorderModuleItems(projectId, moduleKey, itemIds);
    return c.json({ ok: true });
  });

  r.get("/:projectId/dictionary/systems", async c => {
    const projectId = c.req.param("projectId");
    return c.json(await repo.listDictionarySystems(projectId));
  });

  r.get("/:projectId/dictionary/tables", async c => {
    const projectId = c.req.param("projectId");
    const systemId = c.req.query("systemId") || undefined;
    return c.json(await repo.listDictionaryTables(projectId, systemId));
  });

  r.get("/:projectId/dictionary/tables/:tableId/fields", async c => {
    const projectId = c.req.param("projectId");
    const tableId = c.req.param("tableId");
    return c.json(await repo.listDictionaryFields(projectId, tableId));
  });

  r.post("/:projectId/dictionary/fields/resolve", async c => {
    const projectId = c.req.param("projectId");
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const refs = Array.isArray(body.refs) ? body.refs.filter((ref): ref is string => typeof ref === "string") : [];
    return c.json({ results: await repo.resolveDictionaryFieldRefs(projectId, refs) });
  });

  r.get("/:projectId/dictionary/fields/search", async c => {
    const projectId = c.req.param("projectId");
    const q = c.req.query("q") ?? "";
    const limit = Number(c.req.query("limit") ?? 30);
    return c.json({
      query: q,
      results: await repo.searchDictionaryFields(projectId, q, Number.isFinite(limit) ? limit : 30),
    });
  });

  r.get("/:projectId/dictionary/fields/:fieldId", async c => {
    const projectId = c.req.param("projectId");
    const fieldId = c.req.param("fieldId");
    const field = await repo.getDictionaryField(projectId, fieldId);
    if (!field) return c.json({ error: "field not found" }, 404);
    return c.json(field);
  });

  return r;
}
