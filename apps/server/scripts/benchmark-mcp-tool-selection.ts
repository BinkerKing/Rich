import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HermesAdapter } from "../src/ai/hermes.js";
import { createDocumentationRegistry } from "../src/mcp-v2/catalogDocumentation.js";

interface SelectionCase { id: string; prompt: string; expectedTool: string }

if (process.env.RICH_MCP_LIVE_BENCH !== "1") {
  process.stdout.write("Live Hermes benchmark skipped. Set RICH_MCP_LIVE_BENCH=1 to run it.\n");
} else {
  const fixture = fileURLToPath(new URL("../test/fixtures/mcp-v2/tool-selection-cases.json", import.meta.url));
  const cases = JSON.parse(readFileSync(fixture, "utf8")) as SelectionCase[];
  const catalog = createDocumentationRegistry().listDefinitions();
  const hermes = new HermesAdapter();
  if (!await hermes.available()) throw new Error("Hermes is unavailable.");
  const systemPrompt = [
    "你是 Rich MCP 2.0 工具路由器。只输出一个工具名，不要解释。",
    ...catalog.map(tool => `${tool.name}: ${tool.description}`),
  ].join("\n");
  const results = [];
  for (const testCase of cases) {
    let answer = "";
    for await (const event of hermes.stream({ prompt: testCase.prompt, systemPrompt })) {
      if (event.type === "done") answer = event.fullText.trim();
      if (event.type === "error") throw new Error(event.message);
    }
    const selected = catalog.find(tool => answer.includes(tool.name))?.name ?? answer;
    results.push({ ...testCase, selected, passed: selected === testCase.expectedTool });
  }
  const passed = results.filter(result => result.passed).length;
  const accuracy = passed / results.length;
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const reportPath = resolve(root, "data", `mcp-v2-hermes-benchmark-${Date.now()}.json`);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify({ accuracy, passed, total: results.length, results }, null, 2)}\n`);
  process.stdout.write(`Hermes MCP selection accuracy ${(accuracy * 100).toFixed(1)}%; report: ${reportPath}\n`);
  if (accuracy < 0.9) process.exitCode = 1;
}
