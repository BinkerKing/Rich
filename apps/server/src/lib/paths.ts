import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../../..");
}

/** Resolves to the data directory.
 *  When running inside the Electron desktop wrapper this is the user-data
 *  path (e.g. ~/Library/Application Support/Rich/data), set via
 *  the KE_DATA_DIR env var. Otherwise falls back to the monorepo's data/. */
export function dataDir(): string {
  if (process.env.KE_DATA_DIR) return resolve(process.env.KE_DATA_DIR);
  return resolve(repoRoot(), "data");
}

/** Resolves to ai/ (AI role manuals). When KE_AI_DIR is set (e.g. by the
 *  desktop wrapper pointing at the bundled resources), use that. */
export function aiDir(): string {
  if (process.env.KE_AI_DIR) return resolve(process.env.KE_AI_DIR);
  return resolve(repoRoot(), "ai");
}
