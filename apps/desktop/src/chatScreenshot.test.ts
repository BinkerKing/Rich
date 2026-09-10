import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const preload = readFileSync(new URL("./preload.ts", import.meta.url), "utf8");
const overlay = readFileSync(new URL("../../web/src/views/ChatOverlay.tsx", import.meta.url), "utf8");
const chatCss = readFileSync(new URL("../../web/src/views/ChatOverlay.css", import.meta.url), "utf8");

test("定位截图从 Rich 主窗口捕获 PNG，并仅接受受信任的 Rich 窗口请求", () => {
  assert.match(main, /ipcMain\.handle\("rich-chat:capture-current-view"/);
  assert.match(main, /event\.sender !== chatWindow\?\.webContents && event\.sender !== mainWindow\?\.webContents/);
  assert.match(main, /mainWindow\.webContents\.capturePage\(\)/);
  assert.match(main, /toDataURL\(\)/);
});

test("定位截图通过受限 preload 桥接并作为聊天图片附件加入", () => {
  assert.match(preload, /captureCurrentView: \(\) => ipcRenderer\.invoke\("rich-chat:capture-current-view"\)/);
  assert.match(overlay, /captureCurrentView/);
  assert.match(overlay, /composer\.attach\(file\)/);
  assert.match(overlay, />定位截图</);
});

test("对话正文使用更大的纯白高亮文字", () => {
  assert.match(chatCss, /\.chat-msg-content\s*\{[\s\S]*?color:\s*#ffffff;[\s\S]*?font-size:\s*17px;[\s\S]*?font-weight:\s*600;[\s\S]*?text-shadow:/);
  assert.match(chatCss, /\.chat-msg--user \.chat-msg-content\s*\{\s*color:\s*#ffffff;/);
  assert.match(chatCss, /\.chat-msg-content strong\s*\{\s*color:\s*#ffffff;/);
});

test("快捷对话框的用户消息靠右显示为气泡，助手消息保持无气泡", () => {
  assert.match(chatCss, /\.chat-msg--user\s*\{[\s\S]*?align-self:\s*flex-end;[\s\S]*?margin-left:\s*auto;[\s\S]*?background:/);
  assert.match(chatCss, /\.chat-msg--user \.chat-msg-body\s*\{[\s\S]*?padding:[\s\S]*?border-radius:/);
  assert.match(chatCss, /\.chat-msg--assistant\s*\{[\s\S]*?background:\s*transparent;/);
  assert.match(chatCss, /\.chat-msg--assistant \.chat-msg-content\s*\{[\s\S]*?color:\s*#ffffff;[\s\S]*?font-size:\s*18px;[\s\S]*?font-weight:\s*650;/);
});

test("Codex 服务连接失败时聊天框显示闪烁红色边框", () => {
  assert.match(overlay, /const \[serviceUnavailable, setServiceUnavailable\] = useState\(false\)/);
  assert.match(overlay, /setServiceUnavailable\(true\)/);
  assert.match(overlay, /className=\{`chat-shell\$\{serviceUnavailable \? " is-service-unavailable" : ""\}`\}/);
  assert.match(chatCss, /\.chat-shell\.is-service-unavailable\s*\{[\s\S]*?border-color:\s*#ff3b30;[\s\S]*?animation: chat-service-unavailable/);
  assert.match(chatCss, /@keyframes chat-service-unavailable/);
});
