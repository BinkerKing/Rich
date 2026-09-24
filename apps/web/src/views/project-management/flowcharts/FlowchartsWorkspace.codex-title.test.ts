import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./FlowchartsWorkspace.tsx", import.meta.url), "utf8");

test("creates bound flowchart Codex sessions with a flowchart title prefix", () => {
  assert.match(source, /ensureFlowchartCodexSession\(projectId, item\.id, `\[流程图\] \$\{item\.title\} · Codex`\)/);
});
