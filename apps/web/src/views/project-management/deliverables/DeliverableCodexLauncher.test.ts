import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const launcher = readFileSync(
  new URL("./DeliverableCodexLauncher.tsx", import.meta.url),
  "utf8",
);
const app = readFileSync(new URL("../../../App.tsx", import.meta.url), "utf8");
const workspace = readFileSync(
  new URL("./DeliverablesWorkspace.tsx", import.meta.url),
  "utf8",
);
const commandPalette = readFileSync(
  new URL("../../../components/CommandPalette.tsx", import.meta.url),
  "utf8",
);

test("内部 Codex 工作台在应用根部挂载，任意 Rich 页面均可响应快捷键", () => {
  assert.match(app, /<DeliverableCodexLauncher\s*\/>/);
  assert.match(launcher, /rich:toggle-deliverable-codex/);
  assert.match(launcher, /<DeliverableCodexWorkbench/);
});

test("快捷键导航会关闭已打开的 Codex 工作台", () => {
  assert.match(launcher, /rich:close-deliverable-codex/);
  assert.match(launcher, /setVisible\(false\)/);
  assert.match(app, /closeDeliverableCodex\(\);/);
});

test("交付物页面更新最近的 Codex 定位上下文", () => {
  assert.match(workspace, /setDeliverableCodexTarget/);
  assert.doesNotMatch(workspace, /window\.addEventListener\("rich:toggle-deliverable-codex"/);
});

test("网页命令面板不再占用 Command-Space", () => {
  assert.doesNotMatch(commandPalette, /e\.key === " " \|\| e\.code === "Space"/);
});

test("转交任务创建对话后把对话编号回传给发起列表", () => {
  assert.match(launcher, /onConversationCreated=\{target\.onConversationCreated\}/);
});

test("转交任务可把截图作为 Codex 首条消息的附件", () => {
  assert.match(launcher, /initialAttachments=\{target\.initialAttachments\}/);
});

test("任务创建成功后，快捷键会恢复到该任务绑定的 Codex 对话", () => {
  assert.match(launcher, /onConversationCreated=\{conversationId =>/);
  assert.match(launcher, /conversationId,/);
  assert.match(launcher, /setDeliverableCodexTarget\(next\)/);
  assert.match(launcher, /setTarget\(next\)/);
});

test("旧的空项目定位不会生成无效的 Codex 创建地址", () => {
  assert.match(launcher, /target\.projectId\.trim\(\)\.length > 0/);
  assert.match(launcher, /window\.localStorage\.removeItem\(targetStorageKey\)/);
  assert.match(launcher, /projectId: "__general__"/);
});
