import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./AppLauncherView.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./AppLauncherView.css", import.meta.url), "utf8");

test("从应用中心打开任务时回到任务清单", () => {
  assert.match(source, /if \(id === "taskWorkbench"\) localStorage\.removeItem\("rich\.workbench\.selected"\);/);
});

test("应用中心支持可持久化的文件夹布局", () => {
  assert.match(source, /type LauncherFolder/);
  assert.match(source, /function createFolder/);
  assert.match(source, /function moveIntoFolder/);
  assert.match(source, /function removeFromFolder/);
});

test("应用中心以无表头的大图标桌面呈现", () => {
  assert.doesNotMatch(source, /恢复默认排序/);
  assert.match(source, /app-launcher__desktop/);
  assert.match(source, /app-launcher-folder/);
  assert.match(css, /\.app-launcher__desktop/);
  assert.match(css, /\.app-launcher-icon/);
  assert.match(css, /\.app-launcher-folder/);
});

test("右键应用或分组可修改名称并选择图标", () => {
  assert.match(source, /onContextMenu/);
  assert.match(source, /function LauncherContextMenu/);
  assert.match(source, /const APPEARANCE_KEY/);
  assert.match(source, /ICON_NAMES\.map/);
  assert.doesNotMatch(source, /<small>\{item\.desc\}<\/small>/);
  assert.match(css, /\.app-launcher-context/);
});
