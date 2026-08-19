import type { AIAdapter } from "./adapter.js";
import { CHAT_CONTEXT_CONFIG, buildChatContextMessages, refreshChatSummaryIfNeeded } from "./chatContextEngine.js";
import type { ContextMessage } from "./chatContextEngine.js";
import type { ChatConversationsRepo } from "../repos/ChatConversationsRepo.js";

export type AIContextProviderKind = "none" | "rich-internal";

export interface AIContextProviderStatus {
  provider: AIContextProviderKind;
  source: "env" | "default" | "fallback";
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
  constructor(private readonly source: AIContextProviderStatus["source"] = "fallback") {}

  status(): AIContextProviderStatus {
    return {
      provider: "none",
      source: this.source,
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
  constructor(
    private readonly conversationsRepo: ChatConversationsRepo,
    private readonly source: AIContextProviderStatus["source"] = "default",
  ) {}

  status(): AIContextProviderStatus {
    return {
      provider: "rich-internal",
      source: this.source,
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
  const envValue = process.env.RICH_AI_CONTEXT_PROVIDER?.trim();
  if (envValue === "none") return new NoopAIContextProvider("env");
  if (envValue === "rich-internal") {
    return conversationsRepo
      ? new RichInternalAIContextProvider(conversationsRepo, "env")
      : new NoopAIContextProvider("fallback");
  }
  return conversationsRepo
    ? new RichInternalAIContextProvider(conversationsRepo, "default")
    : new NoopAIContextProvider("fallback");
}
