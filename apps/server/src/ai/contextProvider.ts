import type { AIAdapter } from "./adapter.js";
import { CHAT_CONTEXT_CONFIG, buildChatContextMessages, refreshChatSummaryIfNeeded } from "./chatContextEngine.js";
import type { ContextMessage } from "./chatContextEngine.js";
import type { ChatConversationsRepo } from "../repos/ChatConversationsRepo.js";

export type AIContextProviderKind = "none" | "rich-internal";

export interface AIContextProviderStatus {
  provider: AIContextProviderKind;
  chatContextEnabled: boolean;
  summaryEnabled: boolean;
  recentMessages: number;
  summaryTriggerMessages: number;
  summaryKeepTail: number;
  maxSummarySourceChars: number;
}

export interface AIContextProvider {
  status(): AIContextProviderStatus;
  buildChatContext(conversationId: string, incoming: ContextMessage[]): Promise<ContextMessage[]>;
  refreshChatSummary(conversationId: string, adapter: AIAdapter | null): Promise<void>;
}

class NoopAIContextProvider implements AIContextProvider {
  status(): AIContextProviderStatus {
    return {
      provider: "none",
      chatContextEnabled: false,
      summaryEnabled: false,
      ...CHAT_CONTEXT_CONFIG,
    };
  }

  async buildChatContext(_conversationId: string, incoming: ContextMessage[]): Promise<ContextMessage[]> {
    return incoming;
  }

  async refreshChatSummary(_conversationId: string, _adapter: AIAdapter | null): Promise<void> {
    return undefined;
  }
}

class RichInternalAIContextProvider implements AIContextProvider {
  constructor(private readonly conversationsRepo: ChatConversationsRepo) {}

  status(): AIContextProviderStatus {
    return {
      provider: "rich-internal",
      chatContextEnabled: true,
      summaryEnabled: true,
      ...CHAT_CONTEXT_CONFIG,
    };
  }

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
