import { describe, expect, it } from "vitest";
import { createBoundContextCards } from "../src/codex/BoundContextCard.js";

describe("bound Codex context cards", () => {
  it("keeps binding details and the full context as two ordered cards", () => {
    const [binding, context] = createBoundContextCards("conversation-1", {
      initialContext: "## 项目资料\n- 需求：导出报表",
      allowedMcpTools: ["rich_deliverable_record_update"],
      systemInstruction: "仅按用户明确要求操作。",
    }, "2026-09-25T00:00:00.000Z");

    expect(binding.metadata).toMatchObject({ type: "binding-context" });
    expect(binding.content).toContain("## 首次绑定说明");
    expect(binding.content).toContain("rich_deliverable_record_update");
    expect(context.metadata).toMatchObject({ type: "binding-context-payload" });
    expect(context.content).toContain("## 整体上下文已交给 Codex");
    expect(context.content).toContain("需求：导出报表");
  });
});
