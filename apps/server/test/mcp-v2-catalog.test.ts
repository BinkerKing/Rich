import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createDocumentationRegistry, renderMcpV2Catalog } from "../src/mcp-v2/catalogDocumentation.js";

describe("MCP 2.0 generated catalog", () => {
  it("matches the checked-in Markdown byte for byte", () => {
    const generated = renderMcpV2Catalog(createDocumentationRegistry());
    const checkedIn = readFileSync(fileURLToPath(new URL("../../../docs/RICH_MCP_V2_CATALOG.md", import.meta.url)), "utf8");
    expect(generated).toBe(checkedIn);
  });

  it("stays below the tool and schema budgets", () => {
    const registry = createDocumentationRegistry();
    const legacy = JSON.parse(readFileSync(
      fileURLToPath(new URL("./fixtures/mcp-v2/legacy-catalog.json", import.meta.url)), "utf8",
    )) as { schemaBytes: number };
    expect(registry.measure().toolCount).toBeLessThanOrEqual(41);
    expect(registry.measure().schemaBytes).toBeLessThanOrEqual(legacy.schemaBytes * 0.44);
  });
});
