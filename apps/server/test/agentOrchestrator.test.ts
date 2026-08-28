import { describe, expect, it } from "vitest";
import { planChatTurn, planChatTurnWithModel } from "../src/ai/agentOrchestrator.js";
import type { AIAdapter } from "../src/ai/adapter.js";

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

  it("routes natural-language project implementation requests to agent-task", () => {
    const plan = planChatTurn([{
      role: "user",
      content: "这是一个客户管理项目，需要你把登录页面和任务看板实现出来",
    }]);
    expect(plan.scenario).toBe("agent-task");
    expect(plan.requiresAgent).toBe(true);
  });

  it("routes project status requests to agent-task", () => {
    const plan = planChatTurn([{ role: "user", content: "帮我查看这个项目当前有哪些待办任务" }]);
    expect(plan.scenario).toBe("agent-task");
    expect(plan.requiresAgent).toBe(true);
  });

  it("keeps project-writing requests in content mode", () => {
    const plan = planChatTurn([{ role: "user", content: "帮我写一份项目方案" }]);
    expect(plan.scenario).toBe("content");
    expect(plan.requiresAgent).toBe(false);
  });

  it("routes mapping and sql analysis to data", () => {
    const plan = planChatTurn([{ role: "user", content: "分析一下这个 Mapping 字段抓取 SQL 怎么写" }]);
    expect(plan.scenario).toBe("data");
  });

  it("routes document generation to document", () => {
    const plan = planChatTurn([{ role: "user", content: "帮我写一个简易租赁合同" }]);
    expect(plan.scenario).toBe("document");
  });

  it("falls back when model planner returns invalid output", async () => {
    const adapter: AIAdapter = {
      name: "bailian",
      available: async () => true,
      async *stream() {
        yield { type: "done", fullText: "not json" };
      },
    };
    const plan = await planChatTurnWithModel(adapter, [{ role: "user", content: "帮我把 Rich 数据库检查一下" }]);
    expect(plan.scenario).toBe("agent-task");
  });
});
