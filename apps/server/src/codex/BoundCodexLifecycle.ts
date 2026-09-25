import type { AgentRuntimeMessage } from "../agent-conversations/AgentRuntimePort.js";
import type { ChatConversationsRepo, ChatMessageRecord } from "../repos/ChatConversationsRepo.js";
import { ensureBoundContextCards, type BoundCodexContext } from "./BoundContextCard.js";

export type BoundCodexTurnState = {
  lastContextSyncAt?: string;
  contextVersion?: string;
  incrementalContext?: string;
};

export type PreparedBoundCodexTurn = {
  cards: [ChatMessageRecord, ChatMessageRecord];
  messages: ChatMessageRecord[];
  runtimeContext?: AgentRuntimeMessage[];
};

/**
 * The common lifecycle for every Rich resource bound to Codex.
 * It keeps the visible cards and the runtime prompt in the same order, and
 * switches to an incremental context only after the initial snapshot was sent.
 */
export async function prepareBoundCodexTurn(
  chats: Pick<ChatConversationsRepo, "appendMessage" | "listMessages">,
  conversationId: string,
  context: BoundCodexContext,
  state: BoundCodexTurnState = {},
): Promise<PreparedBoundCodexTurn> {
  const { cards, messages } = await ensureBoundContextCards(chats, conversationId, context);
  const hasSyncedCurrentContext = Boolean(state.lastContextSyncAt && (state.contextVersion === undefined || context.contextVersion === undefined || state.contextVersion === context.contextVersion));
  const runtimeContext = hasSyncedCurrentContext
    ? state.incrementalContext
      ? [{ role: "system" as const, content: `${context.systemInstruction ?? ""}\n\n${state.incrementalContext}`.trim() }]
      : undefined
    : cards.map(card => ({ role: "system" as const, content: card.content }));
  return { cards, messages, runtimeContext };
}
