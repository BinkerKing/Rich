import type { AiManagedTask } from "../api/client.js";

export type CodexInitialAttachment = { id: string; mime: string; url: string };

function pageLocation(task: AiManagedTask): string {
  const page = task.payload.page;
  if (Array.isArray(page)) {
    const value = page.filter((item): item is string => typeof item === "string").join(" / ");
    if (value) return value;
  }
  return task.input.text.match(/^页面定位：([^\n]*)/)?.[1] ?? "未记录";
}

function description(task: AiManagedTask): string {
  return task.input.text.replace(/^页面定位：[^\n]*(?:\n\n)?/, "").trim();
}

export function bugCodexAttachments(task: AiManagedTask): CodexInitialAttachment[] {
  return task.input.images.map(image => ({
    id: image.id,
    mime: image.mime ?? "image/png",
    url: image.path ?? `/api/chat/attachments/${encodeURIComponent(image.id)}/data`,
  }));
}

export function buildBugCodexContext(task: AiManagedTask, originalTaskId?: string): string {
  return [
    "# Rich BUG 处理任务",
    "",
    `- 当前任务 ID：${task.id}`,
    ...(originalTaskId ? [`- 原始 Bug 任务 ID：${originalTaskId}`] : []),
    "- 此任务已由界面分配给执行人 `Rich·Codex`，状态已是“处理中”，并已写入本会话 ID；不要另建任务，也不要再次认领。",
    "",
    "## 已提供的 Bug 上下文",
    `### 页面定位\n${pageLocation(task)}`,
    `### 问题描述\n${description(task) || "未填写"}`,
    `### 截图\n${task.input.images.length ? `已作为本条消息附件提供（共 ${task.input.images.length} 张），请直接查看。` : "本任务没有截图附件。"}`,
    "",
    "以上定位、问题描述和截图已完整提供；不要先调用 `rich_ai_task_get` 查询基础信息。仅在需要历史处理记录时再查询。",
    "",
    "## 必须遵守的执行流程",
    "1. 基于以上上下文直接定位并修复问题。",
    "2. 每次完成代码修正后必须提交 Git，提交信息应准确说明修复内容。",
    "3. 默认不要重新部署或发布 Rich App；只有用户明确要求部署时才执行，并在结果中说明。",
    `4. 完成后必须调用 \`rich_ai_task_report_result\` 回写：\`taskId\` 使用 \`${task.id}\`，\`agentId\` 必须为 \`Rich·Codex\`，写明问题分析、处理结果、后续事项，并把 \`statusAfter\` 设为 \`needs_review\`（界面显示为“处理完成”）。`,
    "5. 回写结果必须包含 Git 提交信息，以及是否部署 App（默认“未部署”）。",
    "",
    "现在开始处理该 Bug。",
  ].join("\n");
}
