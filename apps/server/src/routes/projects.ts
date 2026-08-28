/**
 * 项目管理 · 文件夹操作 REST
 *
 *   POST /api/projects/:id/folder/scan      → 扫描目录树（只读）
 *   POST /api/projects/:id/folder/mkdirs    → 批量 mkdir -p（创建建议结构用）
 *
 * 设计选择：
 *   - id 即 project 元的 id；读 element.content.localFolder 拿绝对路径
 *   - mkdir 接收的是相对 localFolder 的路径列表；后端 join + path.resolve 之后必须仍在 localFolder 内部，
 *     防止 ../../etc/passwd 这种逃逸
 *   - 初始化时仅创建标准《项目管理手册》；同名文件绝不覆盖
 */
import { Hono } from "hono";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { ProjectManagementRepo, ProjectModuleItem } from "../repos/ProjectManagementRepo.js";
import { scanFolder } from "../lib/folderScanner.js";

type FolderEntryContent = {
  recordType: "folder-entry";
  relativePath: string;
  absolutePath: string;
  kind: "dir" | "file";
  size: number;
  ext?: string;
  mtime?: string;
  present: boolean;
  scannedAt: string;
  remark?: string;
  ignored?: boolean;
};

const AI_PROJECT_MANAGEMENT_FOLDER = "AI项目管理";
const AI_PROJECT_MANAGEMENT_MANUAL = `${AI_PROJECT_MANAGEMENT_FOLDER}/项目管理手册.md`;
const AI_PROJECT_MANAGEMENT_MANUAL_CONTENT = `# 项目管理手册

> 本文档由 Rich 在初始化项目目录时创建，用作 AI 接手和协作管理本项目的统一入口。

## 1. 项目接手

- 先在 Rich 的“项目说明、数据字典、数据自动化、作业流程、环境配置、部署步骤”等模块了解现状。
- 遍历项目目录后，根据文件和目录的 AI 注释、备注、重要标记补全项目上下文。
- 新增或调整重要资料后，应在对应文件/目录补充说明，避免信息只存在于对话中。

## 2. 目录约定

- 00-启动：合同、SOW 和方案。
- 01-管理：计划、日报、周报、会议和问题。
- 02-分析：需求、产品和接口。
- 03-Mapping：映射、字典、分析和归档。
- 04-部署：环境、脚本和配置。
- 05-版本：发布包与源码。
- 06-测试：用例、数据和报告。
- 07-交付：手册和验收材料。
- 08-材料：客户材料与监管发文。

## 3. AI 协作规则

- 先读取本手册、项目说明和目标文件的 AI 注释，再提出变更建议。
- 不覆盖已有文件；新建文档应放入对应业务目录，并注明用途和更新时间。
- 涉及真实文件移动、删除、发布或外部系统操作时，先明确影响范围并取得确认。
- 不在文档中记录密码、密钥、令牌或其他敏感信息；使用环境变量或凭据引用。

## 4. 定时任务说明

- 定时任务应写明：任务名称、触发频率、输入来源、输出位置、失败处理和负责人。
- 任务的运行结果、异常说明和后续动作应沉淀在项目管理目录或对应业务目录。
- 新增、暂停或修改任务后，同步更新本节或在同目录新增专项说明。

## 5. 持续维护

- 项目状态、关键节点和风险变化后，及时更新项目说明与相关文档。
- 每次交接前检查本手册、目录备注、重要标记和自动化任务说明是否完整。
`;

function isFolderEntry(item: ProjectModuleItem): item is ProjectModuleItem & { content: FolderEntryContent } {
  return item.content.recordType === "folder-entry" && typeof item.content.relativePath === "string";
}

export function projectsRoutes(elements: ElementsRepo, projectManagement: ProjectManagementRepo): Hono {
  const r = new Hono();

  /** 从 project 元拿 localFolder。返回 null 表示该元不存在或没配。 */
  async function getProjectFolder(projectId: string): Promise<{ folder: string | null; error?: string }> {
    const el = await elements.get(projectId);
    if (!el) return { folder: null, error: "project not found" };
    if (el.type !== "project") return { folder: null, error: "not a project element" };
    const folder = (el.content as { localFolder?: string } | null | undefined)?.localFolder;
    if (!folder) return { folder: null, error: "project has no localFolder configured" };
    return { folder };
  }

  async function getFolderEntries(projectId: string): Promise<Array<ProjectModuleItem & { content: FolderEntryContent }>> {
    return (await projectManagement.listAllModuleItems(projectId, "folder")).filter(isFolderEntry);
  }

  function entrySubtree(entries: Array<ProjectModuleItem & { content: FolderEntryContent }>, relativePath: string) {
    const prefix = relativePath ? `${relativePath}/` : "";
    return entries.filter(item => item.content.relativePath === relativePath || item.content.relativePath.startsWith(prefix));
  }

  function ensureInsideRoot(root: string, target: string): boolean {
    const rootAbs = resolve(root);
    const targetAbs = resolve(target);
    return targetAbs !== rootAbs && targetAbs.startsWith(`${rootAbs}/`);
  }

  // POST /api/projects/:id/folder/scan
  r.post("/:id/folder/scan", async c => {
    const id = c.req.param("id");
    const { folder, error } = await getProjectFolder(id);
    if (!folder) return c.json({ error }, 400);
    const projectFolder = folder;
    const body = await c.req.json().catch(() => ({})) as { maxDepth?: number };
    const maxDepth = Math.max(1, Math.min(1000, body.maxDepth ?? 1000));
    try {
      const existing = (await projectManagement.listAllModuleItems(id, "folder")).filter(isFolderEntry);
      const ignoredPaths = new Set(existing.filter(item => item.content.ignored).map(item => item.content.relativePath));
      const result = await scanFolder(projectFolder, { maxDepth, ignoreDirectoryPaths: ignoredPaths });
      const existingByPath = new Map(existing.map(item => [item.content.relativePath, item]));
      const itemIdByPath = new Map<string, string>();
      const scannedPaths = new Set<string>();
      let created = 0;
      let updated = 0;
      let removed = 0;

      async function saveNode(node: typeof result.root, parentPath: string | null, sortOrder: number): Promise<void> {
        const relativePath = node.path;
        scannedPaths.add(relativePath);
        const parentId = parentPath === null ? null : itemIdByPath.get(parentPath) ?? null;
        const nextContent: FolderEntryContent = {
          recordType: "folder-entry",
          relativePath,
          absolutePath: relativePath ? join(projectFolder, relativePath) : projectFolder,
          kind: node.kind,
          size: node.size,
          ext: node.ext,
          mtime: node.mtime,
          present: true,
          scannedAt: result.scannedAt,
        };
        const current = existingByPath.get(relativePath);
        if (current) {
          const content = { ...current.content, ...nextContent };
          const item = await projectManagement.updateModuleItem(id, current.id, {
            parentId,
            title: node.name || projectFolder.split("/").filter(Boolean).pop() || projectFolder,
            subtitle: node.kind === "dir" ? "目录" : node.ext || "文件",
            sortOrder,
            content,
          });
          if (!item) throw new Error(`folder entry not found: ${current.id}`);
          itemIdByPath.set(relativePath, item.id);
          updated++;
        } else {
          const item = await projectManagement.createModuleItem(id, {
            moduleKey: "folder",
            parentId,
            title: node.name || projectFolder.split("/").filter(Boolean).pop() || projectFolder,
            subtitle: node.kind === "dir" ? "目录" : node.ext || "文件",
            sortOrder,
            content: nextContent,
          });
          itemIdByPath.set(relativePath, item.id);
          created++;
        }
        for (const [index, child] of (node.children ?? []).entries()) {
          await saveNode(child, relativePath, index);
        }
      }

      await saveNode(result.root, null, 0);
      for (const item of existing) {
        if (scannedPaths.has(item.content.relativePath)) continue;
        await projectManagement.deleteModuleItem(id, item.id);
        removed++;
      }
      return c.json({ ...result, records: { created, updated, removed, total: scannedPaths.size } });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  // POST /api/projects/:id/folder/mkdirs
  // body: { paths: string[] }  ← 相对 localFolder 的路径列表
  r.post("/:id/folder/mkdirs", async c => {
    const id = c.req.param("id");
    const { folder, error } = await getProjectFolder(id);
    if (!folder) return c.json({ error }, 400);
    const body = await c.req.json().catch(() => ({})) as { paths?: string[] };
    if (!Array.isArray(body.paths) || body.paths.length === 0) {
      return c.json({ error: "paths must be a non-empty array" }, 400);
    }
    const folderAbs = resolve(folder);
    const created: string[] = [];
    const skipped: Array<{ path: string; reason: string }> = [];
    for (const rel of body.paths) {
      if (typeof rel !== "string" || !rel.trim()) {
        skipped.push({ path: String(rel), reason: "empty path" });
        continue;
      }
      const target = resolve(join(folderAbs, rel));
      // 防止 ../ 逃逸：target 必须以 folderAbs 开头
      if (!target.startsWith(folderAbs + "/") && target !== folderAbs) {
        skipped.push({ path: rel, reason: "path escapes project folder" });
        continue;
      }
      try {
        await mkdir(target, { recursive: true });
        created.push(rel);
      } catch (e) {
        skipped.push({ path: rel, reason: (e as Error).message });
      }
    }
    let manual: { path: string; created: boolean } | undefined;
    if (body.paths.some(path => typeof path === "string" && (path === AI_PROJECT_MANAGEMENT_FOLDER || path.startsWith(`${AI_PROJECT_MANAGEMENT_FOLDER}/`)))) {
      const manualPath = resolve(join(folderAbs, AI_PROJECT_MANAGEMENT_MANUAL));
      try {
        await mkdir(resolve(join(folderAbs, AI_PROJECT_MANAGEMENT_FOLDER)), { recursive: true });
        await writeFile(manualPath, AI_PROJECT_MANAGEMENT_MANUAL_CONTENT, { encoding: "utf8", flag: "wx" });
        manual = { path: AI_PROJECT_MANAGEMENT_MANUAL, created: true };
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "EEXIST") manual = { path: AI_PROJECT_MANAGEMENT_MANUAL, created: false };
        else skipped.push({ path: AI_PROJECT_MANAGEMENT_MANUAL, reason: (e as Error).message });
      }
    }
    return c.json({ created, skipped, count: created.length, manual });
  });

  // POST /api/projects/:id/folder/ignore  body: { itemId, ignored }
  r.post("/:id/folder/ignore", async c => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({})) as { itemId?: string; ignored?: boolean };
    if (!body.itemId || typeof body.ignored !== "boolean") return c.json({ error: "itemId and ignored required" }, 400);
    const entries = await getFolderEntries(id);
    const entry = entries.find(item => item.id === body.itemId);
    if (!entry || entry.content.kind !== "dir" || !entry.content.relativePath) return c.json({ error: "directory entry required" }, 400);
    await projectManagement.updateModuleItem(id, entry.id, { content: { ...entry.content, ignored: body.ignored } });
    if (body.ignored) {
      for (const child of entrySubtree(entries, entry.content.relativePath)) {
        if (child.id !== entry.id) await projectManagement.deleteModuleItem(id, child.id);
      }
    }
    return c.json({ ok: true });
  });

  // POST /api/projects/:id/folder/move  body: { itemId, targetDirectoryId }
  r.post("/:id/folder/move", async c => {
    const id = c.req.param("id");
    const { folder, error } = await getProjectFolder(id);
    if (!folder) return c.json({ error }, 400);
    const body = await c.req.json().catch(() => ({})) as { itemId?: string; targetDirectoryId?: string };
    if (!body.itemId || !body.targetDirectoryId) return c.json({ error: "itemId and targetDirectoryId required" }, 400);
    const entries = await getFolderEntries(id);
    const source = entries.find(item => item.id === body.itemId);
    const target = entries.find(item => item.id === body.targetDirectoryId);
    if (!source || !target || target.content.kind !== "dir") return c.json({ error: "invalid source or target directory" }, 400);
    if (!source.content.relativePath || target.content.relativePath === source.content.relativePath || target.content.relativePath.startsWith(`${source.content.relativePath}/`)) {
      return c.json({ error: "cannot move a directory into itself" }, 400);
    }
    const destination = join(folder, target.content.relativePath, basename(source.content.relativePath));
    if (!ensureInsideRoot(folder, destination)) return c.json({ error: "path escapes project folder" }, 400);
    try { await stat(destination); return c.json({ error: "destination already exists" }, 409); } catch { /* expected: no conflict */ }
    try {
      await rename(source.content.absolutePath, destination);
      const oldPath = source.content.relativePath;
      const newPath = join(target.content.relativePath, basename(oldPath));
      for (const item of entrySubtree(entries, oldPath)) {
        const suffix = item.content.relativePath.slice(oldPath.length);
        await projectManagement.updateModuleItem(id, item.id, {
          parentId: item.id === source.id ? target.id : undefined,
          content: { ...item.content, relativePath: `${newPath}${suffix}`, absolutePath: join(folder, `${newPath}${suffix}`), present: true },
        });
      }
      return c.json({ ok: true, relativePath: newPath });
    } catch (e) { return c.json({ error: e instanceof Error ? e.message : String(e) }, 500); }
  });

  // POST /api/projects/:id/folder/rename  body: { itemId, name }
  r.post("/:id/folder/rename", async c => {
    const id = c.req.param("id");
    const { folder, error } = await getProjectFolder(id);
    if (!folder) return c.json({ error }, 400);
    const body = await c.req.json().catch(() => ({})) as { itemId?: string; name?: string };
    const name = body.name?.trim() ?? "";
    if (!body.itemId || !name || name === "." || name === ".." || /[\\/]/.test(name)) return c.json({ error: "invalid name" }, 400);
    const entries = await getFolderEntries(id);
    const source = entries.find(item => item.id === body.itemId);
    if (!source || !source.content.relativePath) return c.json({ error: "invalid folder entry" }, 400);
    const oldPath = source.content.relativePath;
    const newPath = join(oldPath.split("/").slice(0, -1).join("/"), name);
    const destination = join(folder, newPath);
    try { await stat(destination); return c.json({ error: "same-level name already exists" }, 409); } catch { /* expected */ }
    try {
      await rename(source.content.absolutePath, destination);
      for (const item of entrySubtree(entries, oldPath)) {
        const suffix = item.content.relativePath.slice(oldPath.length);
        await projectManagement.updateModuleItem(id, item.id, {
          title: item.id === source.id ? name : undefined,
          content: { ...item.content, relativePath: `${newPath}${suffix}`, absolutePath: join(folder, `${newPath}${suffix}`), present: true },
        });
      }
      return c.json({ ok: true, relativePath: newPath });
    } catch (e) { return c.json({ error: e instanceof Error ? e.message : String(e) }, 500); }
  });

  // POST /api/projects/:id/folder/delete  body: { itemId }
  r.post("/:id/folder/delete", async c => {
    const id = c.req.param("id");
    const { folder, error } = await getProjectFolder(id);
    if (!folder) return c.json({ error }, 400);
    const body = await c.req.json().catch(() => ({})) as { itemId?: string };
    const entries = await getFolderEntries(id);
    const source = entries.find(item => item.id === body.itemId);
    if (!source || !source.content.relativePath || !ensureInsideRoot(folder, source.content.absolutePath)) return c.json({ error: "invalid folder entry" }, 400);
    try {
      await rm(source.content.absolutePath, { recursive: source.content.kind === "dir", force: false });
      for (const item of entrySubtree(entries, source.content.relativePath)) {
        await projectManagement.updateModuleItem(id, item.id, { content: { ...item.content, present: false } });
      }
      return c.json({ ok: true });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
      for (const item of entrySubtree(entries, source.content.relativePath)) await projectManagement.deleteModuleItem(id, item.id);
      return c.json({ ok: true, alreadyMissing: true });
    }
  });

  // POST /api/projects/:id/folder/open  body: { itemId }
  r.post("/:id/folder/open", async c => {
    const id = c.req.param("id");
    const { folder, error } = await getProjectFolder(id);
    if (!folder) return c.json({ error }, 400);
    const body = await c.req.json().catch(() => ({})) as { itemId?: string };
    const entry = (await getFolderEntries(id)).find(item => item.id === body.itemId);
    if (!entry || entry.content.kind !== "file" || !ensureInsideRoot(folder, entry.content.absolutePath)) return c.json({ error: "invalid file entry" }, 400);
    const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", entry.content.absolutePath] : [entry.content.absolutePath];
    try {
      const child = spawn(command, args, { detached: true, stdio: "ignore" });
      child.unref();
      return c.json({ ok: true });
    } catch (e) { return c.json({ error: e instanceof Error ? e.message : String(e) }, 500); }
  });

  // POST /api/projects/:id/folder/reveal  body: { itemId }
  r.post("/:id/folder/reveal", async c => {
    const id = c.req.param("id");
    const { folder, error } = await getProjectFolder(id);
    if (!folder) return c.json({ error }, 400);
    const body = await c.req.json().catch(() => ({})) as { itemId?: string };
    const entry = (await getFolderEntries(id)).find(item => item.id === body.itemId);
    if (!entry || !ensureInsideRoot(folder, entry.content.absolutePath)) return c.json({ error: "invalid folder entry" }, 400);
    const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
    const args = process.platform === "darwin"
      ? (entry.content.kind === "file" ? ["-R", entry.content.absolutePath] : [entry.content.absolutePath])
      : [entry.content.absolutePath];
    try {
      const child = spawn(command, args, { detached: true, stdio: "ignore" });
      child.unref();
      return c.json({ ok: true });
    } catch (e) { return c.json({ error: e instanceof Error ? e.message : String(e) }, 500); }
  });

  // POST /api/projects/probe-connections
  // body: { connections: [{ id, ip, port }] }
  // 服务器视角：对每条连接的目标 ip:port 做 TCP connect，2s timeout
  // 返回每条的 status: "ok" | "timeout" | "refused" | "unreachable"
  //
  // 注意：探测的是 Rich Server → 目标 的网络可达性，不是 fromServer → toServer。
  // 但在 Rich Server 跟生产网络在同段内时基本等价，足够给"防火墙是否放通"一个参考。
  r.post("/probe-connections", async c => {
    const body = await c.req.json().catch(() => ({})) as {
      connections?: Array<{ id: string; ip: string; port: number }>;
    };
    if (!Array.isArray(body.connections)) {
      return c.json({ error: "connections must be an array" }, 400);
    }
    const results = await Promise.all(body.connections.map(async (item) => {
      if (!item.ip || !item.port) {
        return { id: item.id, status: "unreachable" as const, message: "missing ip/port" };
      }
      return new Promise<{ id: string; status: "ok" | "timeout" | "refused" | "unreachable"; message?: string }>(resolveP => {
        const sock = createConnection({ host: item.ip, port: item.port, timeout: 2000 });
        let done = false;
        const finish = (status: "ok" | "timeout" | "refused" | "unreachable", message?: string) => {
          if (done) return;
          done = true;
          sock.destroy();
          resolveP({ id: item.id, status, message });
        };
        sock.on("connect", () => finish("ok"));
        sock.on("timeout", () => finish("timeout"));
        sock.on("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "ECONNREFUSED") finish("refused", err.message);
          else finish("unreachable", err.message);
        });
      });
    }));
    return c.json({ probedAt: new Date().toISOString(), results });
  });

  return r;
}
