import { Hono } from "hono";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { imagesRoot } from "../lib/imageAssets.js";

const CONTENT_TYPES: Record<string, string> = {
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif":  "image/gif",
};

/**
 * Serve files in data/images/<elementId>/<filename>.
 * Path is constrained to that subtree to prevent traversal.
 */
export function imagesRoutes(): Hono {
  const r = new Hono();
  r.get("/:elementId/:filename", async (c) => {
    const elementId = c.req.param("elementId");
    const filename = c.req.param("filename");
    const root = imagesRoot();
    const dest = resolve(join(root, elementId, filename));
    if (!dest.startsWith(root + "/") && dest !== root) return c.json({ error: "not found" }, 404);
    try {
      const s = await stat(dest);
      if (!s.isFile()) return c.json({ error: "not found" }, 404);
    } catch { return c.json({ error: "not found" }, 404); }
    const data = await readFile(dest);
    const ct = CONTENT_TYPES[extname(dest).toLowerCase()] ?? "application/octet-stream";
    return c.body(new Uint8Array(data), 200, {
      "content-type": ct,
      "cache-control": "public, max-age=3600",
    });
  });
  return r;
}
