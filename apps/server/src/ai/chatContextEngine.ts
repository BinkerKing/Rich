import type { AIAdapter } from "./adapter.js";
import type { ChatConversationsRepo, ChatMessageRecord } from "../repos/ChatConversationsRepo.js";

type MessageContent = string | Array<{ type: string; text?: string }>;
export type ContextMessage = { role: string; content: MessageContent };

export const CHAT_CONTEXT_CONFIG = {
  recentMessages: 18,
  summaryTriggerMessages: 28,
  summaryKeepTail: 12,
  maxSummarySourceChars: 18_000,
} as const;

function contentToText(content: MessageContent): string {
  if (typeof content === "string") return content;
  return content.map(part => part.type === "text" ? (part.text ?? "") : "[非文本内容]").join("\n");
}

function recordToContextMessage(message: ChatMessageRecord): ContextMessage {
  return { role: message.role, content: message.content };
}

function formatTranscript(messages: ChatMessageRecord[]): string {
  return messages
    .map(message => {
      const role = message.role === "user" ? "用户" : message.role === "assistant" ? "Rich" : "系统";
      return `【${role} ${message.createdAt}】\n${message.content}`;
    })
    .join("\n\n");
}

export async function buildChatContextMessages(
  repo: ChatConversationsRepo | null,
  conversationId: string,
  incoming: ContextMessage[],
): Promise<ContextMessage[]> {
  if (!repo) return incoming;

  const [summary, recent] = await Promise.all([
    repo.getSummary(conversationId),
    repo.listMessages(conversationId, CHAT_CONTEXT_CONFIG.recentMessages),
  ]);
  const incomingText = incoming.map(message => `${message.role}:${contentToText(message.content)}`).join("\n");
  const dedupedRecent = recent
    .filter(message => !incomingText.includes(`${message.role}:${message.content}`))
    .map(recordToContextMessage);
  const context: ContextMessage[] = summary?.summary.trim()
    ? [{
        role: "system",
        content: [
          "以下是本会话此前内容的压缩摘要，用于保持长期上下文。不要把它当成用户刚刚说的话；只作为背景参考。",
          summary.summary.trim(),
        ].join("\n\n"),
      }]
    : [];
  return [...context, ...dedupedRecent, ...incoming];
}

export async function refreshChatSummaryIfNeeded(
  repo: ChatConversationsRepo | null,
  adapter: AIAdapter | null,
  conversationId: string,
): Promise<void> {
  if (!repo || !adapter || !(await adapter.available())) return;

  const total = await repo.countMessages(conversationId);
  const current = await repo.getSummary(conversationId);
  if (total < CHAT_CONTEXT_CONFIG.summaryTriggerMessages) return;
  if (current && total - current.messageCount < CHAT_CONTEXT_CONFIG.summaryKeepTail) return;

  const messages = await repo.listMessages(conversationId, Math.min(total, 120));
  const source = messages.slice(0, Math.max(0, messages.length - CHAT_CONTEXT_CONFIG.summaryKeepTail));
  if (source.length === 0) return;
  const lastSourceMessage = source[source.length - 1];
  const transcript = formatTranscript(source).slice(-CHAT_CONTEXT_CONFIG.maxSummarySourceChars);
  const previous = current?.summary?.trim()
    ? `已有摘要：\n${current.summary.trim()}\n\n`
    : "";
  const prompt = [
    "你是 Rich 的会话上下文压缩器。请把历史对话压缩成后续模型可用的上下文摘要。",
    "要求：保留用户偏好、明确任务、关键结论、待办、文件路径、项目名、约束、未解决问题。删除寒暄和重复内容。不要编造。",
    "输出中文，使用短段落和项目符号，总长度控制在 1200 字以内。",
    "",
    previous,
    "新增历史对话：",
    transcript,
  ].join("\n");

  let summary = "";
  for await (const event of adapter.stream({
    scenario: "analysis",
    prompt,
    systemPrompt: "你只负责压缩和更新会话摘要，不回答用户问题。",
  })) {
    if (event.type === "delta") summary += event.text;
    if (event.type === "error") return;
  }

  if (!summary.trim()) return;
  await repo.upsertSummary({
    conversationId,
    summary: summary.trim(),
    messageCount: total,
    lastMessageId: lastSourceMessage?.id,
    updatedAt: new Date().toISOString(),
  });
}
