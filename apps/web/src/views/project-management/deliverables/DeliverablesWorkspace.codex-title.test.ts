import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DeliverablesWorkspace.tsx", import.meta.url), "utf8");

test("creates bound deliverable Codex sessions with a deliverable title prefix", () => {
  assert.match(source, /ensureDeliverableCodexSession\(projectId, item\.id, `\[交付物\] \$\{item\.title\} · Codex`\)/);
});
