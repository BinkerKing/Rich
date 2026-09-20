import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";

const source = readFileSync(new URL("./deliverables.ts", import.meta.url), "utf8").replace(/\s+/g, " ");

test("旧交付物迁移会将相对目录规范为项目根目录下的绝对路径", () => {
  assert.match(source, /deliverablesMigrationVersion/);
  assert.match(source, /const projectRoot = typeof projectContent\.localFolder === "string" && isAbsolute\(projectContent\.localFolder\) \? resolve\(projectContent\.localFolder\) : null;/);
  assert.match(source, /const folderPath = typeof legacyContent\.folderPath === "string" \? resolve\(projectRoot, legacyContent\.folderPath\) : projectRoot;/);
  assert.match(source, /if \(item\.content\.folderPath !== folderPath\) \{ await repo\.update\(item\.id, \{ content: \{ \.\.\.item\.content, folderPath \} \}\);/);
  assert.match(source, /deliverablesMigrationVersion: 1/);
});

test("重新绑定目录只绑定已有目录，不创建或复制目录内容", () => {
  assert.match(source, /route\.post\("\/:id\/rebind-folder"/);
  assert.match(source, /await stat\(folderPath\)\.catch\(\(\) => null\)/);
  assert.match(source, /if \(!item \|\| !folderPath \|\| !info\?\.isDirectory\(\)\) return c\.json\(\{ error: "交付物目录不存在或不是文件夹" \}, 404\);/);
  assert.doesNotMatch(source, /currentFolder !== folderPath/);
});
