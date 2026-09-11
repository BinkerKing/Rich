import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");

test("主窗口将普通尺寸、位置和最大化状态保存到用户数据目录", () => {
  assert.match(main, /function mainWindowStatePath\(\): string \{\s*return join\(userDataDir\(\), "window-state\.json"\);/s);
  assert.match(main, /const bounds = edgeDockState && !win\.isVisible\(\) \? edgeDockState\.bounds : win\.getNormalBounds\(\);/);
  assert.match(main, /const state: MainWindowState = \{ bounds, maximized: win\.isMaximized\(\) \}/);
  assert.match(main, /win\.on\("move", scheduleSave\);/);
  assert.match(main, /win\.on\("resize", scheduleSave\);/);
});

test("启动时恢复窗口状态，并将断开的显示器坐标校正到当前工作区域", () => {
  assert.match(main, /const display = screen\.getDisplayMatching\(bounds\);/);
  assert.match(main, /const savedState = restoreMainWindowState\(\);/);
  assert.match(main, /\.\.\.\(savedState \? \{ x: savedState\.bounds\.x, y: savedState\.bounds\.y \} : \{\}\)/);
  assert.match(main, /if \(savedState\?\.maximized\) win\.maximize\(\);/);
});
