import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");

test("CommandOrControl+` 是快捷窗口的全局快捷键", () => {
  assert.match(main, /const accelerator = "CommandOrControl\+`"/);
});

test("CommandOrControl+Shift+Space 全局切换 Rich 主窗口", () => {
  assert.match(main, /const shortcuts = \["CommandOrControl\+Shift\+Space"\]/);
  assert.match(main, /globalShortcut\.register\(accelerator, \(\) => toggleRichMainWindow\(mainWin\)\)/);
  assert.match(main, /mainWin\.on\("focus", unregisterShortcut\)/);
  assert.match(main, /mainWin\.on\("blur", registerShortcut\)/);
});

test("CommandOrControl+Space 仅在 Rich 前台切换内部 Codex", () => {
  assert.match(main, /window\.dispatchEvent\(new Event\("rich:toggle-deliverable-codex"\)\)/);
  assert.match(main, /!input\.shift &&\s+\(input\.meta \|\| input\.control\) &&\s+\(input\.code === "Space" \|\| input\.key === " "\)/);
  assert.match(main, /input\.shift &&\s+\(input\.meta \|\| input\.control\) &&\s+\(input\.code === "Space" \|\| input\.key === " "\)\s*\) \{\s+toggleRichMainWindow\(win\);/);
  assert.match(main, /toggleChatWindow\(\);/);
  assert.match(main, /if \(chatWindow\.isVisible\(\)\) \{\s+hideChatAndApp\(\);/);
  assert.match(main, /if \(!quickChatVisible && mainWin\.isVisible\(\)\) mainWin\.hide\(\);/);
  assert.doesNotMatch(main, /const shortcuts = \["CommandOrControl\+Space"\]/);
});

test("停靠展开但未点击 Rich 时，Cmd/Ctrl+1 到 0 仍可切换 Rich 界面", () => {
  assert.match(main, /function setupEdgeDockNavigationShortcuts\(mainWin: BrowserWindow\)/);
  assert.match(main, /const shortcuts = \["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"\]/);
  assert.match(main, /Boolean\(edgeDockState && mainWin\.isVisible\(\) && !mainWin\.isFocused\(\)\)/);
  assert.match(main, /globalShortcut\.register\(accelerator, \(\) => dispatchViewShortcut\(key\)\)/);
  assert.match(main, /new KeyboardEvent\("keydown", \{ key:/);
});

test("Codex 工作台标题栏双击不会触发 Rich 主窗口最大化", () => {
  assert.match(main, /target\.closest\("\.deliverable-codex-workbench"\)\) return;/);
});
