import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DeepWorkbenchView.tsx", import.meta.url), "utf8");

test("creates mindmap Codex sessions with a mindmap title prefix", () => {
  assert.match(source, /api\.ensureMindmapCodexSession\(item\.id, `\[思维导图\] \$\{item\.title\} · Codex`\)/);
});
