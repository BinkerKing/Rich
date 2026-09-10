import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");

test("定位按钮把当前交付物作为发送上下文前置", () => {
  assert.doesNotMatch(source, /className="deliverable-codex-workbench__scope"/);
  assert.match(source, /aria-label="附加当前位置"/);
  assert.match(source, /当前窗口定位：交付物 \/ \$\{deliverableTitle\}/);
  assert.match(source, /locationContext \? `\$\{locationContext\}\\n\\n\$\{draft\}` : draft/);
});
