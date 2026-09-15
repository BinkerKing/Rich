import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));

async function findNodeTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findNodeTests(path);
    if (!/\.test\.[cm]?[jt]sx?$/.test(entry.name)) return [];
    const source = await readFile(path, "utf8");
    return /from ["']node:test["']/.test(source) ? [path] : [];
  }));
  return nested.flat();
}

const tests = await findNodeTests(sourceRoot);
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...tests], { stdio: "inherit" });
process.exit(result.status ?? 1);
