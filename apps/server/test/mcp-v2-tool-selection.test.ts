import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createDocumentationRegistry, selectMcpV2Tool } from "../src/mcp-v2/catalogDocumentation.js";

interface SelectionCase {
  id: string;
  scenario: string;
  prompt: string;
  expectedTool: string;
  forbiddenTools?: string[];
}

describe("MCP 2.0 deterministic tool selection", () => {
  it("selects the expected tool for all fifty Chinese scenarios", () => {
    const cases = JSON.parse(readFileSync(
      fileURLToPath(new URL("./fixtures/mcp-v2/tool-selection-cases.json", import.meta.url)), "utf8",
    )) as SelectionCase[];
    const catalog = createDocumentationRegistry().listDefinitions();
    const confusion = cases.flatMap(testCase => {
      const actual = selectMcpV2Tool(testCase.prompt, catalog);
      return actual === testCase.expectedTool && !testCase.forbiddenTools?.includes(actual)
        ? []
        : [{ id: testCase.id, expected: testCase.expectedTool, actual, prompt: testCase.prompt }];
    });
    expect(confusion, JSON.stringify(confusion, null, 2)).toEqual([]);
  });
});
