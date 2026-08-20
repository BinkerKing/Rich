import { Hono } from "hono";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { dataDir } from "../lib/paths.js";
import { safeElementSlug, safeFilename } from "../lib/attachments.js";

const CONTENT_TYPES: Record<string, string> = {
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

type DictionaryTestFileMeta = {
  fileName: string;
  storedName: string;
  fileSize: number;
  uploadedAt: string;
};

function testFilesRoot(): string {
  return join(dataDir(), "project-dictionary-test-files");
}

function testFileDir(projectId: string, tableId: string): string {
  return join(testFilesRoot(), safeElementSlug(projectId), safeElementSlug(tableId));
}

function testFileMetaPath(projectId: string, tableId: string): string {
  return join(testFileDir(projectId, tableId), "metadata.json");
}

function ensureInsideRoot(path: string): boolean {
  const root = resolve(testFilesRoot());
  const target = resolve(path);
  return target === root || target.startsWith(`${root}/`);
}

function toPublicMeta(projectId: string, tableId: string, meta: DictionaryTestFileMeta) {
  return {
    fileName: meta.fileName,
    fileSize: meta.fileSize,
    uploadedAt: meta.uploadedAt,
    downloadUrl: `/api/project-dictionary-test-files/${encodeURIComponent(projectId)}/${encodeURIComponent(tableId)}/download`,
  };
}

export function projectDictionaryTestFilesRoutes(): Hono {
  const r = new Hono();

  r.get("/:projectId/:tableId", async (c) => {
    const projectId = safeElementSlug(c.req.param("projectId"));
    const tableId = safeElementSlug(c.req.param("tableId"));
    if (!projectId || !tableId) return c.json({ file: null });
    const metaPath = testFileMetaPath(projectId, tableId);
    if (!ensureInsideRoot(metaPath)) return c.json({ file: null });
    try {
      const meta = JSON.parse(await readFile(metaPath, "utf8")) as DictionaryTestFileMeta;
      return c.json({ file: toPublicMeta(projectId, tableId, meta) });
    } catch {
      return c.json({ file: null });
    }
  });

  r.post("/:projectId/:tableId", async (c) => {
    const projectId = safeElementSlug(c.req.param("projectId"));
    const tableId = safeElementSlug(c.req.param("tableId"));
    if (!projectId || !tableId) return c.json({ error: "invalid projectId or tableId" }, 400);
    const dir = testFileDir(projectId, tableId);
    if (!ensureInsideRoot(dir)) return c.json({ error: "invalid path" }, 400);

    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) return c.json({ error: "no file" }, 400);

    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const storedName = safeFilename(file.name);
    const target = resolve(join(dir, storedName));
    if (!ensureInsideRoot(target)) return c.json({ error: "invalid filename" }, 400);

    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(target, buf);
    const meta: DictionaryTestFileMeta = {
      fileName: file.name,
      storedName,
      fileSize: buf.byteLength,
      uploadedAt: new Date().toISOString(),
    };
    await writeFile(testFileMetaPath(projectId, tableId), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
    return c.json({ file: toPublicMeta(projectId, tableId, meta) });
  });

  r.get("/:projectId/:tableId/download", async (c) => {
    const projectId = safeElementSlug(c.req.param("projectId"));
    const tableId = safeElementSlug(c.req.param("tableId"));
    const metaPath = testFileMetaPath(projectId, tableId);
    if (!ensureInsideRoot(metaPath)) return c.json({ error: "not found" }, 404);
    try {
      const meta = JSON.parse(await readFile(metaPath, "utf8")) as DictionaryTestFileMeta;
      const target = resolve(join(testFileDir(projectId, tableId), safeFilename(meta.storedName)));
      if (!ensureInsideRoot(target)) return c.json({ error: "not found" }, 404);
      const s = await stat(target);
      if (!s.isFile()) return c.json({ error: "not found" }, 404);
      const data = await readFile(target);
      const contentType = CONTENT_TYPES[extname(meta.fileName).toLowerCase()] ?? "application/octet-stream";
      const encodedName = encodeURIComponent(meta.fileName);
      return c.body(new Uint8Array(data), 200, {
        "content-type": contentType,
        "content-disposition": `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
        "cache-control": "private, max-age=60",
      });
    } catch {
      return c.json({ error: "not found" }, 404);
    }
  });

  return r;
}
