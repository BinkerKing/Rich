import { describe, expect, it } from "vitest";
import { HermesAdapter } from "../src/ai/hermes.js";
import { assertRuntimeProfileSupported } from "../src/agent-conversations/ConversationPermissionPolicy.js";
import { HermesAgentRuntime } from "../src/agent-conversations/HermesAgentRuntime.js";
import type { AIAdapter, GenerateArgs, StreamEvent } from "../src/ai/adapter.js";

describe("Hermes capability enforcement", () => {
  it("reports only chat_only until native tools and workspace boundaries are mediated", () => {
    const capabilities = new HermesAdapter().agentRuntimeCapabilities();

    expect(capabilities).toEqual({
      profiles: ["chat_only"],
      enforcesToolSelection: false,
      enforcesWorkspaceRoot: false,
      supportsResumableToolCalls: false,
    });
    expect(() => assertRuntimeProfileSupported(capabilities, "workspace_agent"))
      .toThrow(/capability profile unavailable/i);
  });

  it("maps Hermes adapter events into the Agent runtime protocol", async () => {
    const adapter: AIAdapter = {
      name: "hermes",
      async available() { return true; },
      agentRuntimeCapabilities() {
        return { profiles: ["chat_only"], enforcesToolSelection: false, enforcesWorkspaceRoot: false, supportsResumableToolCalls: false };
      },
      async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {
        yield { type: "delta", text: "hello" };
        yield { type: "done", fullText: "hello", sessionId: "session-1" };
      },
    };
    const runtime = new HermesAgentRuntime(adapter);

    const events = [];
    for await (const event of runtime.startTurn({
      conversationId: "c1", turnId: "t1", sessionId: "old",
      messages: [{ role: "user", content: "continue" }], capabilityToken: "unused",
    })) events.push(event);

    expect(events).toEqual([
      { type: "delta", text: "hello" },
      { type: "done", fullText: "hello", sessionId: "session-1" },
    ]);
  });

  it("classifies a rejected stored session as recoverable", async () => {
    const adapter: AIAdapter = {
      name: "hermes",
      async available() { return true; },
      agentRuntimeCapabilities() {
        return { profiles: ["chat_only"], enforcesToolSelection: false, enforcesWorkspaceRoot: false, supportsResumableToolCalls: false };
      },
      async *stream(): AsyncIterable<StreamEvent> {
        yield { type: "error", message: "Hermes HTTP 404: session not found" };
      },
    };
    const runtime = new HermesAgentRuntime(adapter);

    const events = [];
    for await (const event of runtime.startTurn({
      conversationId: "c1", turnId: "t1", sessionId: "stale",
      messages: [{ role: "user", content: "continue" }], capabilityToken: "unused",
    })) events.push(event);

    expect(events).toEqual([{ type: "error", code: "stale_session", message: "Hermes HTTP 404: session not found" }]);
  });
});
