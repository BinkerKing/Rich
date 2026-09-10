import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./DeliverableCodexWorkbench.css", import.meta.url), "utf8");

test("连接丢失时仅把对应会话标为红色闪烁", () => {
  assert.match(source, /const \[lostConversationIds, setLostConversationIds\] = useState<Set<string>>\(\(\) => new Set\(\)\)/);
  assert.match(source, /setLostConversationIds\(current => new Set\(current\)\.add\(target\.id\)\)/);
  assert.match(source, /lostConversationIds\.has\(conversation\.id\) \? " is-connection-lost" : ""/);
  assert.match(css, /\.deliverable-codex-workbench__sidebar nav button\.is-connection-lost/);
  assert.match(css, /@keyframes deliverable-codex-connection-lost/);
});

test("交付物 Codex 的附加菜单可将当前界面截图加入图片附件", () => {
  assert.match(source, /async function attachCurrentViewScreenshot\(\)/);
  assert.match(source, /richWindow\?\.captureCurrentView\?\./);
  assert.match(source, /new File\(\[blob\], `Rich-\$\{Date\.now\(\)\}\.png`/);
  assert.match(source, /composer\.attach\(/);
  assert.match(source, /<span>定位截图/);
});

test("定位截图会暂时隐藏工作台，以捕获后面的 Rich 页面", () => {
  assert.match(source, /const \[capturingCurrentView, setCapturingCurrentView\] = useState\(false\)/);
  assert.match(source, /setCapturingCurrentView\(true\)/);
  assert.match(source, /finally \{ setCapturingCurrentView\(false\); \}/);
  assert.match(source, /\$\{capturingCurrentView \? " is-capturing-current-view" : ""\}/);
  assert.match(css, /\.deliverable-codex-backdrop\.is-capturing-current-view\s*\{\s*display:none;/);
});

test("打开 Codex 对话框时自动聚焦输入框，关闭后不阻塞底层页面", () => {
  assert.match(source, /if \(!visible\) return;\s*composerTextareaRef\.current\?\.focus\(\);/);
  assert.doesNotMatch(source, /setAttribute\("inert"/);
  assert.match(css, /\.deliverable-codex-backdrop\s*\{[\s\S]*?z-index:2147483000;[\s\S]*?pointer-events:auto;/);
});

test("附加菜单跟随输入框宽度并保持更矮的单行紧凑布局", () => {
  assert.match(css, /\.deliverable-codex-workbench__composer-menu\s*\{[\s\S]*?width:calc\(100% - 32px\);[\s\S]*?padding:7px 8px;/);
  assert.match(css, /\.deliverable-codex-workbench__composer-menu button\s*\{[\s\S]*?min-height:34px;[\s\S]*?padding:4px 10px;/);
  assert.match(css, /\.deliverable-codex-workbench__composer-menu span\s*\{[\s\S]*?white-space:nowrap;/);
});

test("发送消息后会清除已附加的窗口定位", () => {
  assert.match(source, /void sendMessage\(active, content, attachments, true\);\s*setLocationAttached\(false\);/);
});

test("用户消息悬停时提供重新发送操作", () => {
  assert.match(source, /const resendMessage = \(content: string, messageAttachments: Message\["attachments"\] = \[\]\) =>/);
  assert.match(source, /void sendMessage\(active, content, attachments, false\)/);
  assert.match(source, /resendMessage\(message\.content, message\.attachments\)/);
  assert.match(source, /className="deliverable-codex-workbench__resend"/);
  assert.match(source, /onClick=\{\(\) => resendMessage\(message\.content, message\.attachments\)\}>↻<\/button>/);
  assert.match(source, /className="deliverable-codex-workbench__message-copy"/);
  assert.match(source, /navigator\.clipboard\.writeText\(content\)/);
  assert.match(source, /<time dateTime=\{message\.createdAt\}>\{formatMessageTime\(message\.createdAt\)\}<\/time>/);
  assert.match(css, /article:hover \.deliverable-codex-workbench__message-meta\s*\{\s*opacity:1;/);
});
