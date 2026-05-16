import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../../..");
}

// Resolves to monorepo data/ directory regardless of cwd.
export function dataDir(): string {
  return resolve(repoRoot(), "data");
}

/** Resolves to monorepo ai/ directory (AI role manuals). */
export function aiDir(): string {
  return resolve(repoRoot(), "ai");
}
