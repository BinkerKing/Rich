import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modules = readFileSync(new URL("./ProjectManagementModules.tsx", import.meta.url), "utf8");

test("通用富文本编辑器使用 Tiptap，并保留 HTML 回调和图片上传接口", () => {
  assert.match(modules, /from "@tiptap\/react"/);
  assert.match(modules, /StarterKit/);
  assert.match(modules, /TextStyle/);
  assert.match(modules, /Color/);
  assert.match(modules, /Highlight/);
  assert.match(modules, /editor\.getHTML\(\)/);
  assert.match(modules, /api\.uploadAttachments/);
});
