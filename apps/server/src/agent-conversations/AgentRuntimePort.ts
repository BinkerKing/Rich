import type { AgentRuntimeCapabilities, AgentCapabilityAction } from "./types.js";

export interface AgentRuntimeMessage {
  role: "user" | "assistant" | "system";
  content: string;
  imageUrls?: string[];
}

export interface AgentRuntimeTurnInput {
  conversationId: string;
  turnId: string;
  sessionId?: string;
  messages: AgentRuntimeMessage[];
  capabilityToken: string;
}

export type AgentRuntimeEvent =
  | { type: "delta"; text: string }
  | {
      type: "tool_call";
      runtimeCallId: string;
      idempotencyKey: string;
      name: string;
      arguments: Record<string, unknown>;
      action: AgentCapabilityAction;
      sessionId?: string;
    }
  | { type: "done"; fullText: string; sessionId?: string }
  | { type: "error"; message: string; code?: "stale_session" | "runtime_error" };

export interface AgentRuntimeToolResult {
  runtimeCallId: string;
  result?: unknown;
  error?: string;
}

export interface AgentRuntimePort {
  agentRuntimeCapabilities(): AgentRuntimeCapabilities;
  startTurn(input: AgentRuntimeTurnInput): AsyncGenerator<AgentRuntimeEvent, void, AgentRuntimeToolResult | undefined>;
  checkConnection?(sessionId?: string): Promise<{ server: boolean; session: boolean }>;
  interrupt?(threadId: string, turnId: string): Promise<void>;
}
