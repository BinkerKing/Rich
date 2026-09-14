import { api, type AiManagedTask } from "../api/client.js";
import { bugCodexAttachments, buildBugCodexContext } from "./aiTaskCodexContext.js";

export async function startAutomaticBugFix(task: AiManagedTask): Promise<AiManagedTask> {
  const response = await fetch("/api/deliverable-codex/__general__/__general__/conversations", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: `BUG · ${task.title.slice(0, 56)}` }),
  });
  if (!response.ok) throw new Error(`创建 Rich·Codex 对话失败 (${response.status})`);
  const { conversation } = await response.json() as { conversation: { id: string } };
  const claimed = await api.claimAiManagedTask(task.id, "Rich·Codex", conversation.id);
  const attachments = bugCodexAttachments(task);
  void fetch(`/api/deliverable-codex/conversations/${encodeURIComponent(conversation.id)}/stream`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: buildBugCodexContext(task), attachments, userMessageId: crypto.randomUUID(), clientRequestId: crypto.randomUUID() }),
  }).then(async stream => {
    if (!stream.ok || !stream.body) throw new Error(`启动 Rich·Codex 失败 (${stream.status})`);
    const reader = stream.body.getReader();
    while (!(await reader.read()).done) { /* keep the background stream alive */ }
  }).catch(() => undefined);
  return claimed;
}
