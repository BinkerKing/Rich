import type { AIAdapter } from "../ai/adapter.js";
import type { AgentRuntimeCapabilities } from "./types.js";
import type { AgentRuntimeEvent, AgentRuntimePort, AgentRuntimeToolResult, AgentRuntimeTurnInput } from "./AgentRuntimePort.js";

const CHAT_ONLY_CAPABILITIES: AgentRuntimeCapabilities = {
  profiles: ["chat_only"],
  enforcesToolSelection: false,
  enforcesWorkspaceRoot: false,
  supportsResumableToolCalls: false,
};

export class HermesAgentRuntime implements AgentRuntimePort {
  constructor(private readonly adapter: AIAdapter) {
    if (adapter.name !== "hermes") throw new Error("HermesAgentRuntime requires the Hermes adapter");
  }

  agentRuntimeCapabilities(): AgentRuntimeCapabilities {
    return this.adapter.agentRuntimeCapabilities?.() ?? CHAT_ONLY_CAPABILITIES;
  }

  async *startTurn(input: AgentRuntimeTurnInput): AsyncGenerator<AgentRuntimeEvent, void, AgentRuntimeToolResult | undefined> {
    const systemPrompt = input.messages
      .filter(message => message.role === "system")
      .map(message => message.content)
      .join("\n\n");
    const prompt = input.messages
      .filter(message => message.role !== "system")
      .map(message => `${message.role}: ${message.content}`)
      .join("\n\n");

    for await (const event of this.adapter.stream({
      prompt,
      systemPrompt: systemPrompt || undefined,
      sessionId: input.sessionId,
      scenario: "chat",
    })) {
      if (event.type === "delta") {
        yield { type: "delta", text: event.text };
      } else if (event.type === "done") {
        yield { type: "done", fullText: event.fullText, sessionId: event.sessionId };
      } else {
        const stale = Boolean(input.sessionId) && /(?:404.*session|session.*(?:not found|invalid|expired|unknown))/i.test(event.message);
        yield { type: "error", code: stale ? "stale_session" : "runtime_error", message: event.message };
      }
    }
  }
}
