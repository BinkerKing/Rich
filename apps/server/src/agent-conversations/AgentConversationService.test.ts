import { describe, expect, it } from "vitest";
import { buildAgentRuntimeMessages } from "./AgentConversationService.js";

describe("buildAgentRuntimeMessages", () => {
  it("sends only the current prompt and attachments to a healthy Codex thread", () => {
    const messages = buildAgentRuntimeMessages({
      executor: "codex",
      content: "当前窗口定位：交付物 / 首页\n\n请检查这个页面。",
      imageUrls: ["data:image/png;base64,image"],
      recent: [
        { role: "user", content: "旧问题" },
        { role: "assistant", content: "旧回答" },
      ],
      summaryContext: "旧会话摘要",
    });

    expect(messages).toEqual([{
      role: "user",
      content: "当前窗口定位：交付物 / 首页\n\n请检查这个页面。",
      imageUrls: ["data:image/png;base64,image"],
    }]);
  });

  it("sends bound context in order before the first user request", () => {
    const messages = buildAgentRuntimeMessages({
      executor: "codex",
      content: "请开始整理。",
      runtimeContext: [
        { role: "system", content: "首次绑定说明" },
        { role: "system", content: "整体上下文" },
      ],
      recent: [],
      summaryContext: "",
    });

    expect(messages.map(message => message.content)).toEqual(["首次绑定说明", "整体上下文", "请开始整理。"]);
  });
});
