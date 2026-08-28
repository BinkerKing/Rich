import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { measureCatalog } from "../src/mcp-v2/registry/catalogMetrics.js";

interface LegacyCatalogFixture {
  toolCount: number;
  schemaBytes: number;
  tools: Array<{
    name: string;
    description?: string;
    inputSchema: unknown;
  }>;
}

interface ToolSelectionCase {
  id: string;
  scenario: "query" | "capture" | "manage" | "plan" | "delegate" | "review";
  prompt: string;
  expectedTool: string;
  forbiddenTools?: string[];
}

function readFixture<T>(name: string): T {
  return JSON.parse(readFileSync(
    fileURLToPath(new URL(`./fixtures/mcp-v2/${name}`, import.meta.url)),
    "utf8",
  )) as T;
}

describe("MCP 2.0 migration baseline", () => {
  it("freezes the legacy MCP catalog and schema footprint", () => {
    const legacy = readFixture<LegacyCatalogFixture>("legacy-catalog.json");
    const measured = measureCatalog(legacy.tools);

    expect(legacy.toolCount).toBeGreaterThan(100);
    expect(legacy.toolCount).toBe(legacy.tools.length);
    expect(legacy.schemaBytes).toBeGreaterThan(0);
    expect(measured).toEqual({
      toolCount: legacy.toolCount,
      schemaBytes: legacy.schemaBytes,
    });
    expect(legacy.tools.map(tool => tool.name)).toEqual(
      [...legacy.tools.map(tool => tool.name)].sort(),
    );
  });

  it("covers all six scenarios with fifty realistic selection cases", () => {
    const cases = readFixture<ToolSelectionCase[]>("tool-selection-cases.json");

    expect(cases).toHaveLength(50);
    expect(new Set(cases.map(item => item.id)).size).toBe(50);
    expect(new Set(cases.map(item => item.scenario))).toEqual(
      new Set(["query", "capture", "manage", "plan", "delegate", "review"]),
    );
    expect(cases.every(item => item.prompt.trim().length >= 8)).toBe(true);
    expect(cases.every(item => item.expectedTool.startsWith("rich_"))).toBe(true);
  });
});
