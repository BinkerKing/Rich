import { copyFile, mkdir, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { dataDir } from "./paths.js";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

/** Where served images live: data/images/<elementId>/<sha>.<ext> */
export function imagesRoot(): string {
  return join(dataDir(), "images");
}

function safeSlug(id: string): string {
  // Element ids already use dots and kebab. Just strip path-y chars.
  return id.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Given an arbitrary src string from AI output, decide whether it points to a
 * local file we should copy into our images dir. Returns the public URL the
 * frontend should use, or the original src unchanged if it's already a URL or
 * is unreachable.
 */
export async function adoptImageIfLocal(elementId: string, src: string): Promise<string> {
  if (!src) return src;
  // Already a web URL — leave alone.
  if (/^https?:\/\//i.test(src)) return src;
  // Already pointed at our images route — leave alone.
  if (src.startsWith("/api/images/")) return src;
  // Anything else (absolute filesystem paths, relative paths) is treated as
  // a local file we should adopt.
  let absolute: string;
  try { absolute = resolve(src); } catch { return src; }
  try {
    const s = await stat(absolute);
    if (!s.isFile()) return src;
  } catch { return src; }
  const ext = extname(absolute).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) return src;
  // Hash the source path so the same physical file maps to the same URL on
  // re-runs (idempotent).
  const hash = createHash("sha1").update(absolute).digest("hex").slice(0, 12);
  const destDir = join(imagesRoot(), safeSlug(elementId));
  await mkdir(destDir, { recursive: true });
  const destName = `${hash}${ext}`;
  const dest = join(destDir, destName);
  // Only copy if not already there.
  try {
    await stat(dest);
  } catch {
    try { await copyFile(absolute, dest); }
    catch { return src; }
  }
  return `/api/images/${safeSlug(elementId)}/${destName}`;
}

/** Walk the content's sections and adopt any local image blocks; mutates in place. */
export async function adoptImagesInContent(elementId: string, content: unknown): Promise<void> {
  if (!content || typeof content !== "object") return;
  const c = content as Record<string, unknown>;
  if (!Array.isArray(c.sections)) return;
  for (const section of c.sections) {
    if (!section || typeof section !== "object") continue;
    const blocks = (section as Record<string, unknown>).blocks;
    if (!Array.isArray(blocks)) continue;
    for (const block of blocks) {
      if (!block || typeof block !== "object") continue;
      const b = block as Record<string, unknown>;
      if (b.style === "image" && typeof b.src === "string") {
        b.src = await adoptImageIfLocal(elementId, b.src);
      }
    }
  }
}

void basename;
