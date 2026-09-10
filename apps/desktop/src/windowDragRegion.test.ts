import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");

test("顶部拖拽层不拦截项目菜单等底层按钮的指针事件", () => {
  assert.match(main, /WebkitAppRegion: "drag",\s*pointerEvents: "none"/s);
});

test("深度工作台用自己的标题栏拖拽，切换按钮不被顶部拖拽层遮挡", () => {
  assert.match(main, /body:has\(\.deep-canvas\) #rich-window-drag-region\s*\{\s*display: none;/s);
  assert.match(main, /\.deep-canvas__header\s*\{\s*-webkit-app-region: drag;/s);
  assert.match(main, /\.deep-canvas__header button,[\s\S]{0,2000}?\.deep-canvas__header select,[\s\S]{0,2000}?\{\s*-webkit-app-region: no-drag;/s);
});

test("全屏流程图用自己的标题栏拖拽，避免遮挡窗口缩放控制", () => {
  assert.match(main, /body:has\(\.pfc--standalone \.pfc-task\.is-expanded\) #rich-window-drag-region\s*\{\s*display: none;/s);
});
