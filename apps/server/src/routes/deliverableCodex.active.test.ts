import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("全量活跃会话接口使用仓库的全量查询", () => {
  const source = readFileSync(new URL("./deliverableCodex.ts", import.meta.url), "utf8");
  assert.match(source, /r\.get\("\/conversations", async c => c\.json\(\{ conversations: await deps\.conversations\.listAllActive\(\) \}\)\)/);
});
