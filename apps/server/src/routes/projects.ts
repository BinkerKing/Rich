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
 *   - 不做写文件 / mv 文件操作（那些下一批做，要走 dry-run + confirm 流程）
 */
import { Hono } from "hono";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createConnection } from "node:net";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import { scanFolder } from "../lib/folderScanner.js";

export function projectsRoutes(elements: ElementsRepo): Hono {
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

  // POST /api/projects/:id/folder/scan
  r.post("/:id/folder/scan", async c => {
    const id = c.req.param("id");
    const { folder, error } = await getProjectFolder(id);
    if (!folder) return c.json({ error }, 400);
    const body = await c.req.json().catch(() => ({})) as { maxDepth?: number };
    const maxDepth = Math.max(1, Math.min(8, body.maxDepth ?? 4));
    try {
      const result = await scanFolder(folder, { maxDepth });
      return c.json(result);
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
    return c.json({ created, skipped, count: created.length });
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
