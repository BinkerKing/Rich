import { Hono } from "hono";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { attachmentsRoot, safeElementSlug, safeFilename } from "../lib/attachments.js";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf":  "application/pdf",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif":  "image/gif",
  ".svg":  "image/svg+xml",
  ".txt":  "text/plain; charset=utf-8",
  ".md":   "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv":  "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".zip":  "application/zip",
};

/**
 * Attachment routes:
 *   POST   /:elementId        — multipart upload(s) → saves under
 *                                data/attachments/<element>/<filename>,
 *                                returns list of saved files with served URLs.
 *   GET    /:elementId/:filename — serve a previously uploaded file.
 *   DELETE /:elementId/:filename — remove a single attachment.
 *
 * The element itself owns the AttachmentsBlock — server only stores the
 * bytes. The block (with the URL list) is persisted via the element's
 * `content.sections` PATCH endpoint.
 */
export function attachmentsRoutes(): Hono {
  const r = new Hono();

  r.post("/:elementId", async (c) => {
    const elementId = safeElementSlug(c.req.param("elementId"));
    if (!elementId) return c.json({ error: "invalid elementId" }, 400);
    const root = attachmentsRoot();
    const destDir = join(root, elementId);
    await mkdir(destDir, { recursive: true });

    const body = await c.req.parseBody({ all: true });
    const raw = body.files ?? body.file;
    const list: File[] = Array.isArray(raw)
      ? raw.filter((x): x is File => x instanceof File)
      : raw instanceof File ? [raw] : [];
    if (list.length === 0) return c.json({ error: "no files" }, 400);

    const saved: Array<{ name: string; src: string; size: number }> = [];
    for (const f of list) {
      const safeName = safeFilename(f.name);
      const target = join(destDir, safeName);
      // Refuse traversal — destination must stay inside the per-element dir.
      if (!resolve(target).startsWith(resolve(destDir) + "/") && resolve(target) !== resolve(destDir)) {
        continue;
      }
      const buf = Buffer.from(await f.arrayBuffer());
      await writeFile(target, buf);
      saved.push({
        name: safeName,
        src: `/api/attachments/${encodeURIComponent(elementId)}/${encodeURIComponent(safeName)}`,
        size: buf.byteLength,
      });
    }
    return c.json({ files: saved });
  });

  r.delete("/:elementId/:filename", async (c) => {
    const elementId = safeElementSlug(c.req.param("elementId"));
    const filename = safeFilename(c.req.param("filename"));
    const root = attachmentsRoot();
    const dest = resolve(join(root, elementId, filename));
    if (!dest.startsWith(resolve(root) + "/") && dest !== resolve(root)) {
      return c.json({ error: "not found" }, 404);
    }
    try { await unlink(dest); }
    catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return c.body(null, 204);
      throw err;
    }
    return c.body(null, 204);
  });

  r.get("/:elementId/:filename", async (c) => {
    const elementId = safeElementSlug(c.req.param("elementId"));
    const filename = safeFilename(c.req.param("filename"));
    const root = attachmentsRoot();
    const dest = resolve(join(root, elementId, filename));
    if (!dest.startsWith(resolve(root) + "/") && dest !== resolve(root)) {
      return c.json({ error: "not found" }, 404);
    }
    try {
      const s = await stat(dest);
      if (!s.isFile()) return c.json({ error: "not found" }, 404);
    } catch { return c.json({ error: "not found" }, 404); }
    const data = await readFile(dest);
    const ct = CONTENT_TYPES[extname(dest).toLowerCase()] ?? "application/octet-stream";
    // Always force download — the attachment UI is "click = download",
    // not "click = preview in browser". Both known and unknown types get the
    // `attachment` disposition. RFC 5987 filename* allows non-ASCII safely.
    const fnEnc = encodeURIComponent(filename);
    return c.body(new Uint8Array(data), 200, {
      "content-type": ct,
      "content-disposition": `attachment; filename="${fnEnc}"; filename*=UTF-8''${fnEnc}`,
      "cache-control": "private, max-age=300",
    });
  });

  return r;
}
