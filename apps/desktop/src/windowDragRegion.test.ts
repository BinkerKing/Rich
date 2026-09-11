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

test("Rich 窗口靠近屏幕左右边缘时会吸附，并在失焦后收为不抢焦点的发光边线", () => {
  assert.match(main, /const EDGE_DOCK_SNAP_DISTANCE = 24/);
  assert.match(main, /side === "left" \? workArea\.x : workArea\.x \+ workArea\.width - bounds\.width/);
  assert.match(main, /focusable: false,[\s\S]{0,400}?glow\.setIgnoreMouseEvents\(true\)/);
  assert.match(main, /mainWin\.on\("blur", \(\) => setTimeout\(\(\) => collapseEdgeDockWindow\(mainWin\), 80\)\)/);
});

test("悬停边线只展开 Rich，不会抢走当前应用的焦点", () => {
  assert.match(main, /if \(pointIsInsideBounds\(cursor, edgeDockGlowBounds\(edgeDockState\)\)\) expandEdgeDockWindow\(mainWin\)/);
  assert.match(main, /win\.showInactive\(\);/);
});
