import { describe, expect, it } from "vitest";
import { prepareBoundCodexTurn } from "../src/codex/BoundCodexLifecycle.js";

describe("bound Codex lifecycle", () => {
  it("sends the two persisted cards before the first user turn, then only an incremental update", async () => {
    const saved: any[] = [];
    const chats = {
      async listMessages() { return saved; },
      async appendMessage(message: any) { saved.push(message); },
    };
    const context = {
      initialContext: "完整资源快照",
      allowedMcpTools: ["rich_mindmap_manage"],
      systemInstruction: "先读取资源，再按用户请求修改。",
      contextVersion: "v1",
    };

    const first = await prepareBoundCodexTurn(chats, "chat-1", context);
    expect(first.runtimeContext.map(message => message.content)).toEqual(first.cards.map(card => card.content));

    const later = await prepareBoundCodexTurn(chats, "chat-1", context, {
      lastContextSyncAt: "2026-09-25T00:00:00.000Z",
      incrementalContext: "节点 A 已更新。",
    });
    expect(later.runtimeContext).toEqual([{ role: "system", content: "先读取资源，再按用户请求修改。\n\n节点 A 已更新。" }]);
  });
});
