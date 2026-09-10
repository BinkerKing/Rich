import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./TaskWorkbench.tsx", import.meta.url), "utf8");

test("Esc 从任务详情返回任务清单，并且不抢占输入框或弹窗", () => {
  assert.match(source, /if \(!selectedId\) return;/);
  assert.match(source, /event\.key !== "Escape"/);
  assert.match(source, /input, textarea, \[contenteditable='true'\]/);
  assert.match(source, /setSelectedId\(null\)/);
});

test("步骤确认项作为独立标签，而非目标与结论的内容", () => {
  assert.match(source, /\["summary", "checkpoints", "artifacts", "activity"/);
  assert.match(source, /value === "checkpoints" \? "步骤确认项"/);
  assert.match(source, /tab === "checkpoints" && step && <StepCheckpoints/);
});
