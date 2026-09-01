import { describe, expect, it } from "vitest";
import { HermesAdapter } from "../src/ai/hermes.js";
import { assertRuntimeProfileSupported } from "../src/agent-conversations/ConversationPermissionPolicy.js";

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
});
