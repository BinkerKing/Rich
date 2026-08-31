import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("桌面主窗口加载前清理旧的前端资源缓存", () => {
  const source = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
  assert.match(source, /await win\.webContents\.session\.clearCache\(\);/);
});
