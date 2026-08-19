import type { AIAdapter } from "./adapter.js";
import { buildChatContextMessages, refreshChatSummaryIfNeeded } from "./chatContextEngine.js";
import type { ContextMessage } from "./chatContextEngine.js";
import type { ChatConversationsRepo } from "../repos/ChatConversationsRepo.js";

export interface AIContextProvider {
  buildChatContext(conversationId: string, incoming: ContextMessage[]): Promise<ContextMessage[]>;
  refreshChatSummary(conversationId: string, adapter: AIAdapter | null): Promise<void>;
}

class NoopAIContextProvider implements AIContextProvider {
  async buildChatContext(_conversationId: string, incoming: ContextMessage[]): Promise<ContextMessage[]> {
    return incoming;
  }

  async refreshChatSummary(_conversationId: string, _adapter: AIAdapter | null): Promise<void> {
    return undefined;
  }
}

class RichInternalAIContextProvider implements AIContextProvider {
  constructor(private readonly conversationsRepo: ChatConversationsRepo) {}

  buildChatContext(conversationId: string, incoming: ContextMessage[]): Promise<ContextMessage[]> {
    return buildChatContextMessages(this.conversationsRepo, conversationId, incoming);
  }

  refreshChatSummary(conversationId: string, adapter: AIAdapter | null): Promise<void> {
    return refreshChatSummaryIfNeeded(this.conversationsRepo, adapter, conversationId);
  }
}

export function createAIContextProvider(conversationsRepo: ChatConversationsRepo | null): AIContextProvider {
  return conversationsRepo
    ? new RichInternalAIContextProvider(conversationsRepo)
    : new NoopAIContextProvider();
}
