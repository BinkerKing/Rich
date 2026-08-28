import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createDocumentationRegistry, renderMcpV2Catalog } from "../src/mcp-v2/catalogDocumentation.js";

const target = fileURLToPath(new URL("../../../docs/RICH_MCP_V2_CATALOG.md", import.meta.url));
const generated = renderMcpV2Catalog(createDocumentationRegistry());

if (process.argv.includes("--check")) {
  const current = readFileSync(target, "utf8");
  if (current !== generated) {
    process.stderr.write("RICH_MCP_V2_CATALOG.md is stale. Run pnpm --filter @ke/server mcp:docs.\n");
    process.exitCode = 1;
  }
} else {
  writeFileSync(target, generated);
  process.stdout.write(`Generated ${target}\n`);
}
