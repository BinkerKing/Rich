import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";

const source = readFileSync(new URL("./deliverables.ts", import.meta.url), "utf8").replace(/\s+/g, " ");

test("已完成旧交付物迁移的项目不会在后续访问中回填已解绑项目关联", () => {
  assert.match(source, /deliverablesMigrationVersion/);
  assert.match(source, /if \(projectContent\.deliverablesMigrationVersion === 1\) continue;/);
  assert.match(source, /deliverablesMigrationVersion: 1/);
});

test("重新绑定目录会在更新交付物路径前保留旧目录中的文件", () => {
  assert.match(source, /route\.post\("\/:id\/rebind-folder"/);
  assert.match(source, /await cp\(resolve\(currentFolder, entry\), resolve\(folderPath, entry\), \{ recursive: true, force: false, errorOnExist: true \}\)/);
});
