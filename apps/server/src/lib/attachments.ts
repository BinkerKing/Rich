import { join } from "node:path";
import { dataDir } from "./paths.js";

export function attachmentsRoot(): string {
  return join(dataDir(), "attachments");
}

/** Sanitize a filename for safe filesystem storage. Strips path separators,
 *  null bytes, leading dots; clamps to 200 chars. */
export function safeFilename(raw: string): string {
  const trimmed = raw.trim();
  const noPath = trimmed.replace(/[/\\]/g, "_").replace(/\0/g, "");
  const noLeadingDots = noPath.replace(/^\.+/, "");
  const clipped = noLeadingDots.slice(0, 200);
  return clipped || `file-${Date.now().toString(36)}`;
}

/** Slug an element id for use as a directory name. Strips most chars that
 *  could escape the attachments root, but preserves dots since element ids
 *  use them as separators (e.g. `ai-news.2026-05-20`). */
export function safeElementSlug(id: string): string {
  return id.replace(/[^a-zA-Z0-9._\-一-鿿]/g, "_").slice(0, 120);
}
