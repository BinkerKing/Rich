import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./AiTaskCapture.tsx", import.meta.url), "utf8");

test("快捷任务悬浮框在应用启动后默认显示任务清单", () => {
  assert.match(source, /const \[listMode, setListMode\] = useState\(true\);/);
});

test("点击任务只展开当前标题，切换任务后原任务恢复单行", () => {
  assert.match(source, /const \[expandedTaskId, setExpandedTaskId\] = useState<string>\(\);/);
  assert.match(source, /onClick=\{\(\) => setExpandedTaskId\(current => current === task\.id \? undefined : task\.id\)\}/);
  assert.match(source, /whiteSpace: expanded \? "normal" : "nowrap"/);
  assert.match(source, /overflowWrap: expanded \? "anywhere" : undefined/);
});
