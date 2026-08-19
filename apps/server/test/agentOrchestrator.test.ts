import { describe, expect, it } from "vitest";
import { planChatTurn } from "../src/ai/agentOrchestrator.js";

describe("planChatTurn", () => {
  it("keeps ordinary questions in chat", () => {
    const plan = planChatTurn([{ role: "user", content: "一般酒店开发票税点是多少？" }]);
    expect(plan.scenario).toBe("chat");
    expect(plan.requiresAgent).toBe(false);
  });

  it("routes explicit work mode to agent-task", () => {
    const plan = planChatTurn([{ role: "user", content: "/干活 帮我检查 Rich 数据库连接" }]);
    expect(plan.scenario).toBe("agent-task");
    expect(plan.requiresAgent).toBe(true);
  });

  it("routes Rich operations to agent-task", () => {
    const plan = planChatTurn([{ role: "user", content: "帮我把 Rich 首页聊天历史修复一下" }]);
    expect(plan.scenario).toBe("agent-task");
    expect(plan.intent).toBe("operate-rich");
  });

  it("routes mapping and sql analysis to data", () => {
    const plan = planChatTurn([{ role: "user", content: "分析一下这个 Mapping 字段抓取 SQL 怎么写" }]);
    expect(plan.scenario).toBe("data");
  });

  it("routes document generation to document", () => {
    const plan = planChatTurn([{ role: "user", content: "帮我写一个简易租赁合同" }]);
    expect(plan.scenario).toBe("document");
  });
});
