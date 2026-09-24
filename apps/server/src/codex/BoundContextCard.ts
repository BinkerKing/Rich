import { randomUUID } from "node:crypto";
import type { ChatMessageRecord } from "../repos/ChatConversationsRepo.js";

export type BoundCodexContext = {
  initialContext: string;
  allowedMcpTools?: string[];
  systemInstruction?: string;
};

export function isBoundContextCard(message: Pick<ChatMessageRecord, "metadata">): boolean {
  return (message.metadata as { type?: unknown } | undefined)?.type === "binding-context";
}

export function createBoundContextCard(conversationId: string, context: BoundCodexContext, createdAt = new Date().toISOString()): ChatMessageRecord {
  return {
    id: randomUUID(),
    conversationId,
    role: "system",
    content: [
      "## 首次绑定说明",
      "", "## 整体信息", context.initialContext,
      "", "## 可用 MCP", ...(context.allowedMcpTools ?? []).map(tool => `- ${tool}`),
      "", "## AI 操作规定", context.systemInstruction ?? "仅按用户明确要求操作，并通过 Rich MCP 保存变更。",
    ].join("\n"),
    metadata: { type: "binding-context", allowedMcpTools: context.allowedMcpTools ?? [], rules: context.systemInstruction ?? "" },
    createdAt,
  };
}
