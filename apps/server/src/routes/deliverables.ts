import { Hono } from "hono";
import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, resolve } from "node:path";
import { spawn } from "node:child_process";
import type { DeliverablesRepo } from "../repos/DeliverablesRepo.js";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { ProjectManagementRepo } from "../repos/ProjectManagementRepo.js";

const content = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const directory = (value: Record<string, unknown>) => typeof value.folderPath === "string" && isAbsolute(value.folderPath) && !value.folderPath.includes("\0") ? resolve(value.folderPath) : null;
const inside = (root: string, target: string) => target.startsWith(`${root}/`);
const openPath = (path: string, reveal = false) => {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
  const child = spawn(command, process.platform === "darwin" && reveal ? ["-R", path] : [path], { detached: true, stdio: "ignore" });
  child.unref();
};

export function deliverablesRoutes(repo: DeliverablesRepo, dependencies?: { elements: ElementsRepo; projectManagement: ProjectManagementRepo }): Hono {
  const route = new Hono();
  route.get("/", async c => c.json(await repo.list()));
  route.post("/migrate-project-items", async c => {
    if (!dependencies) return c.json({ migrated: 0 });
    const existing = await repo.list();
    const existingById = new Map(existing.map(item => [item.id, item]));
    const legacyIds = new Map(existing.flatMap(item => typeof item.content.legacyProjectItemId === "string" ? [[item.content.legacyProjectItemId, item.id] as const] : []));
    let migrated = 0;
    for (const project of (await dependencies.elements.list()).filter(item => item.type === "project")) {
      const projectContent = content(project.content) ?? {};
      const projectRoot = typeof projectContent.localFolder === "string" && isAbsolute(projectContent.localFolder) ? resolve(projectContent.localFolder) : null;
      if (!projectRoot) continue;
      const ids = [...(projectContent.deliverableIds instanceof Array ? projectContent.deliverableIds.filter((id): id is string => typeof id === "string") : [])];
      for (const id of ids) {
        const item = existingById.get(id);
        if (!item) continue;
        const folderPath = typeof item.content.folderPath === "string" ? resolve(projectRoot, item.content.folderPath) : projectRoot;
        if (item.content.folderPath !== folderPath) {
          await repo.update(item.id, { content: { ...item.content, folderPath } });
          existingById.set(item.id, { ...item, content: { ...item.content, folderPath } });
          migrated++;
        }
      }
      if (projectContent.deliverablesMigrationVersion === 1) continue;
      const legacy = await dependencies.projectManagement.listAllModuleItems(project.id, "deliverables");
      for (const item of legacy) {
        let id = legacyIds.get(item.id);
        const legacyContent = content(item.content) ?? {};
        const folderPath = typeof legacyContent.folderPath === "string" ? resolve(projectRoot, legacyContent.folderPath) : projectRoot;
        if (!id) {
          const created = await repo.create({ title: item.title, content: { ...legacyContent, folderPath, legacyProjectItemId: item.id } });
          id = created.id; legacyIds.set(item.id, id); migrated++;
        }
        if (!ids.includes(id)) ids.push(id);
      }
      await dependencies.elements.put({ ...project, content: { ...projectContent, deliverableIds: ids, deliverablesMigrationVersion: 1 } });
    }
    return c.json({ migrated });
  });
  route.get("/:id", async c => { const item = await repo.get(c.req.param("id")); return item ? c.json(item) : c.json({ error: "deliverable not found" }, 404); });
  route.post("/", async c => {
    const body = await c.req.json().catch(() => ({})) as { title?: unknown; content?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : ""; const value = content(body.content);
    return title && value && directory(value) ? c.json(await repo.create({ title, content: value }), 201) : c.json({ error: "title and an absolute folderPath are required" }, 400);
  });
  const folder = async (id: string) => { const item = await repo.get(id); return item ? directory(item.content) : null; };
  route.post("/:id/folder", async c => {
    const path = await folder(c.req.param("id")); if (!path) return c.json({ error: "deliverable folder not found" }, 404);
    await mkdir(path, { recursive: true }); return c.json({ folderPath: path });
  });
  route.post("/:id/rebind-folder", async c => {
    const body = await c.req.json().catch(() => ({})) as { folderPath?: unknown };
    const folderPath = directory({ folderPath: body.folderPath });
    const item = await repo.get(c.req.param("id"));
    const currentFolder = item ? directory(item.content) : null;
    if (!item || !folderPath || !currentFolder) return c.json({ error: "deliverable and absolute folderPath are required" }, 400);
    await mkdir(folderPath, { recursive: true });
    if (currentFolder !== folderPath && (await stat(currentFolder).catch(() => null))?.isDirectory()) {
      for (const entry of await readdir(currentFolder)) await cp(resolve(currentFolder, entry), resolve(folderPath, entry), { recursive: true, force: false, errorOnExist: true });
    }
    return c.json(await repo.update(item.id, { content: { ...item.content, folderPath } }));
  });
  route.get("/:id/files", async c => {
    const path = await folder(c.req.param("id")); if (!path) return c.json({ error: "deliverable folder not found" }, 404);
    const info = await stat(path).catch(() => null); if (!info) return c.json({ files: [] });
    const files = await Promise.all((await readdir(path, { withFileTypes: true })).flatMap(async entry => {
      if (!entry.isFile() && !entry.isDirectory()) return [];
      const absolutePath = resolve(path, entry.name); const metadata = await stat(absolutePath);
      return [{ fileName: entry.name, relativePath: absolutePath, size: entry.isFile() ? metadata.size : 0, modifiedAt: metadata.mtime.toISOString(), isDirectory: entry.isDirectory() }];
    }));
    return c.json({ files: files.flat().sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || b.modifiedAt.localeCompare(a.modifiedAt)) });
  });
  route.post("/:id/files", async c => {
    const path = await folder(c.req.param("id")); const form = await c.req.formData().catch(() => null); const file = form?.get("file");
    if (!path || !(file instanceof File) || !file.name || basename(file.name) !== file.name) return c.json({ error: "folder and file required" }, 400);
    const absolutePath = resolve(path, file.name); if (!inside(path, absolutePath)) return c.json({ error: "file escapes deliverable folder" }, 400);
    try { await mkdir(path, { recursive: true }); await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()), { flag: "wx" }); return c.json({ fileName: file.name, relativePath: absolutePath, size: file.size }, 201); }
    catch (error) { return c.json({ error: error instanceof Error ? error.message : String(error) }, 409); }
  });
  route.delete("/:id/files", async c => {
    const path = await folder(c.req.param("id")); const body = await c.req.json().catch(() => ({})) as { path?: unknown }; const target = typeof body.path === "string" ? resolve(body.path) : "";
    if (!path || !inside(path, target)) return c.json({ error: "file must be inside deliverable folder" }, 400);
    await rm(target); return c.json({ ok: true });
  });
  route.post("/:id/files/:action", async c => {
    const path = await folder(c.req.param("id"));
    const action = c.req.param("action");
    const body = await c.req.json().catch(() => ({})) as { path?: unknown };
    const target = typeof body.path === "string" ? resolve(body.path) : "";
    if (!path || !inside(path, target)) return c.json({ error: "file must be inside deliverable folder" }, 400);
    if (action !== "open" && action !== "reveal") return c.json({ error: "unsupported file action" }, 400);
    if (!(await stat(target).catch(() => null))) return c.json({ error: "file not found" }, 404);
    openPath(target, action === "reveal");
    return c.json({ ok: true });
  });
  route.post("/:id/open", async c => {
    const path = await folder(c.req.param("id")); if (!path) return c.json({ error: "deliverable folder not found" }, 404);
    openPath(path); return c.json({ ok: true });
  });
  route.patch("/:id", async c => {
    const body = await c.req.json().catch(() => ({})) as { title?: unknown; content?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : undefined; const value = body.content === undefined ? undefined : content(body.content);
    if ((body.title !== undefined && !title) || (body.content !== undefined && (!value || !directory(value)))) return c.json({ error: "invalid deliverable patch" }, 400);
    const item = await repo.update(c.req.param("id"), { ...(title !== undefined ? { title } : {}), ...(value ? { content: value } : {}) });
    return item ? c.json(item) : c.json({ error: "deliverable not found" }, 404);
  });
  route.delete("/:id", async c => (await repo.remove(c.req.param("id"))) ? c.body(null, 204) : c.json({ error: "deliverable not found" }, 404));
  return route;
}
