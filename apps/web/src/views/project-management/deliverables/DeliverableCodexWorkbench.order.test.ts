import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("pins the binding cards before the conversation timeline", async () => {
  const source = await readFile(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
  assert.match(source, /function orderBoundConversationMessages\(messages: Message\[\]\): Message\[\]/);
  assert.match(source, /const latestBinding = messages\.findLast/);
  assert.match(source, /const latestContext = messages\.findLast/);
  assert.match(source, /orderBoundConversationMessages\(\(messages\[active\.id\] \?\? \[\]\)\.filter/);
  assert.match(source, /"DeepMindMap 使用说明"/);
  assert.match(source, /"DeepMindMap 完整上下文"/);
});
