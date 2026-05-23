// Rebuild native modules (better-sqlite3) against Electron's bundled Node.
// We call @electron/rebuild's programmatic API instead of its CLI, because
// the CLI's yargs dependency breaks on Node 25 (ReferenceError: require not
// defined in ES module scope).
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { rebuild } = require("@electron/rebuild");

const projectRoot = path.resolve(__dirname, "..");
const electronVersion = require("electron/package.json").version;

rebuild({
  buildPath: projectRoot,
  electronVersion,
  force: true,
  onlyModules: ["better-sqlite3"],
  // pnpm hoists deps into .pnpm; @electron/rebuild needs to find them.
  projectRootPath: path.resolve(projectRoot, "..", ".."),
}).then(() => {
  console.log("native rebuild ok");
  // macOS 26+ enforces code signatures on all Mach-O pages loaded into a
  // process. The freshly compiled .node binary is unsigned, which trips
  // "SIGKILL (Code Signature Invalid)" the moment Electron requires it.
  // Adhoc-sign every native module under the monorepo to keep the loader
  // happy. Idempotent: re-running just replaces the signature.
  if (process.platform === "darwin") {
    const monorepoRoot = path.resolve(projectRoot, "..", "..");
    const found = [];
    walk(path.join(monorepoRoot, "node_modules"), found);
    for (const f of found) {
      try {
        execFileSync("codesign", ["--force", "--sign", "-", f], { stdio: "pipe" });
      } catch (e) {
        console.warn("codesign skipped for", f, e.message);
      }
    }
    console.log(`codesigned ${found.length} .node binaries (adhoc)`);
  }
}).catch((e) => {
  console.error("native rebuild FAILED:", e);
  process.exit(1);
});

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith(".node")) out.push(p);
  }
}
