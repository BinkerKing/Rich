import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Resolves to monorepo data/ directory regardless of cwd.
export function dataDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../../../data");
}
