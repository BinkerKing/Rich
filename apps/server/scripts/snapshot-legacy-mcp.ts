import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { buildMcpServer, type BuildMcpDeps } from "../src/mcp/server.js";
import { measureCatalog } from "../src/mcp-v2/registry/catalogMetrics.js";

interface LegacyRegisteredTool {
  description?: string;
  inputSchema: Parameters<typeof z.toJSONSchema>[0];
  enabled: boolean;
}

function buildSnapshotDeps(): BuildMcpDeps {
  const unused = {} as never;
  return {
    elements: unused,
    relations: unused,
    paths: unused,
    signals: unused,
    qa: unused,
    annotations: unused,
    adapters: [],
    aiDir: "/tmp",
    improvements: unused,
    corpus: unused,
    toolRuntime: unused,
    greatMe: unused,
    projectManagement: unused,
    projectAutomation: unused,
  };
}

function snapshotLegacyCatalog() {
  const server = buildMcpServer(buildSnapshotDeps());
  // Intentional one-time migration dependency on the SDK's private registry.
  // MCP 2.0 production code and contract tests use RichToolRegistry instead.
  const registered = (server as unknown as {
    _registeredTools: Record<string, LegacyRegisteredTool>;
  })._registeredTools;
  const tools = Object.entries(registered)
    .filter(([, tool]) => tool.enabled)
    .map(([name, tool]) => ({
      name,
      ...(tool.description ? { description: tool.description } : {}),
      inputSchema: z.toJSONSchema(tool.inputSchema, { target: "draft-7", io: "input" }),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  return { ...measureCatalog(tools), tools };
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDir, "../test/fixtures/mcp-v2/legacy-catalog.json");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshotLegacyCatalog(), null, 2)}\n`, "utf8");
console.log(outputPath);
