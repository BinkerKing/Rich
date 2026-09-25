import { randomUUID } from "node:crypto";
import type { ChatConversationsRepo, ChatMessageRecord } from "../repos/ChatConversationsRepo.js";

export type BoundCodexContext = {
  initialContext: string;
  allowedMcpTools?: string[];
  systemInstruction?: string;
};

export function isBoundContextCard(message: Pick<ChatMessageRecord, "metadata">): boolean {
  const type = (message.metadata as { type?: unknown } | undefined)?.type;
  return type === "binding-context" || type === "binding-context-payload";
}

export function isBoundContextPayloadCard(message: Pick<ChatMessageRecord, "metadata">): boolean {
  return (message.metadata as { type?: unknown } | undefined)?.type === "binding-context-payload";
}

export function createBoundContextCards(conversationId: string, context: BoundCodexContext, createdAt = new Date().toISOString()): [ChatMessageRecord, ChatMessageRecord] {
  const binding = {
    id: randomUUID(),
    conversationId,
    role: "system",
    content: [
      "## 首次绑定说明",
      "", "## 可用 MCP", ...(context.allowedMcpTools ?? []).map(tool => `- ${tool}`),
      "", "## AI 操作规定", context.systemInstruction ?? "仅按用户明确要求操作，并通过 Rich MCP 保存变更。",
    ].join("\n"),
    metadata: { type: "binding-context", allowedMcpTools: context.allowedMcpTools ?? [], rules: context.systemInstruction ?? "" },
    createdAt,
  } as ChatMessageRecord;
  const payload = {
    id: randomUUID(),
    conversationId,
    role: "system",
    content: ["## 整体上下文已交给 Codex", "", context.initialContext].join("\n"),
    metadata: { type: "binding-context-payload" },
    createdAt,
  } as ChatMessageRecord;
  return [binding, payload];
}

export function boundContextRuntimeInstruction(cards: ChatMessageRecord[]): string {
  return cards.map(card => card.content).join("\n\n");
}

export async function ensureBoundContextCards(chats: Pick<ChatConversationsRepo, "appendMessage" | "listMessages">, conversationId: string, context: BoundCodexContext): Promise<{ cards: [ChatMessageRecord, ChatMessageRecord]; messages: ChatMessageRecord[] }> {
  const savedMessages = await chats.listMessages?.(conversationId, 200) ?? [];
  const existingBinding = savedMessages.find(message => (message.metadata as { type?: unknown } | undefined)?.type === "binding-context");
  const existingPayload = savedMessages.find(isBoundContextPayloadCard);
  const [binding, payload] = createBoundContextCards(conversationId, context);
  const cards: [ChatMessageRecord, ChatMessageRecord] = [existingBinding ?? binding, existingPayload ?? payload];
  const missing = cards.filter(card => !savedMessages.some(message => message.id === card.id));
  await Promise.all(missing.map(card => chats.appendMessage?.(card)));
  return { cards, messages: [...savedMessages, ...missing] };
}
