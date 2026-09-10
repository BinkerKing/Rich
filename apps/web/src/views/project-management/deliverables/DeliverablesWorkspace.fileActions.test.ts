import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workspace = readFileSync(new URL("./DeliverablesWorkspace.tsx", import.meta.url), "utf8").replace(/\s+/g, " ");
const apiClient = readFileSync(new URL("../../../api/client.ts", import.meta.url), "utf8").replace(/\s+/g, " ");

test("独立交付物的文件打开和访达定位不使用项目接口", () => {
  assert.match(apiClient, /async standaloneDeliverableFileAction\(id: string, action: "open" \| "reveal", path: string\)/);
  assert.match(workspace, /const fileAction = async \(item: Item, action: "open" \| "reveal", path: string\) => \{ if \(standalone \|\| deliverableIds !== undefined\) \{ await api\.standaloneDeliverableFileAction\(item\.id, action, path\); return; \}/);
  assert.match(workspace, /void fileAction\(item, "open", file\.relativePath\)/);
  assert.match(workspace, /void fileAction\(item, "reveal", file\.relativePath\)/);
});
