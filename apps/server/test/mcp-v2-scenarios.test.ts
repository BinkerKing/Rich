import { describe, expect, it, vi } from "vitest";
import type { Element } from "@ke/domain";
import { registerScenarioTools } from "../src/mcp-v2/scenarios/registerScenarioTools.js";
import { RichToolRegistry } from "../src/mcp-v2/registry/toolRegistry.js";
import type { McpOperationClaim, McpOperationRecord, McpOperationRepo } from "../src/repos/McpOperationRepo.js";
import { EmptyProjectManagementRepo } from "../src/repos/EmptyProjectManagementRepo.js";
import type { ProjectModuleItem } from "../src/repos/ProjectManagementRepo.js";

class MemoryOperationRepo implements McpOperationRepo {
  private readonly records = new Map<string, McpOperationRecord>();
  claim(toolName: string, requestId: string, inputHash: string): McpOperationClaim {
    const key = `${toolName}:${requestId}`;
    const record = this.records.get(key);
    if (record) return { claimed: false, record };
    this.records.set(key, { toolName, requestId, inputHash, status: "pending", createdAt: new Date().toISOString() });
    return { claimed: true };
  }
  complete(toolName: string, requestId: string, inputHash: string, response: Parameters<McpOperationRepo["complete"]>[3]): void {
    this.records.set(`${toolName}:${requestId}`, { toolName, requestId, inputHash, status: "completed", response, createdAt: new Date().toISOString() });
  }
  abandon(toolName: string, requestId: string): void { this.records.delete(`${toolName}:${requestId}`); }
}

function makeHarness(options: { failTitle?: string } = {}) {
  const elements = new Map<string, Element>();
  const projectItems = new Map<string, ProjectModuleItem>();
  const projects = new EmptyProjectManagementRepo();
  projects.createModuleItem = vi.fn(async (projectId, input) => {
    if (input.title === options.failTitle) throw new Error("simulated write failure");
    const item: ProjectModuleItem = {
      id: `item-${projectItems.size + 1}`, projectId, moduleKey: input.moduleKey, title: input.title,
      subtitle: input.subtitle ?? undefined, parentId: input.parentId ?? undefined, sortOrder: input.sortOrder ?? 0,
      content: input.content ?? {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    projectItems.set(item.id, item);
    return item;
  });
  projects.listAllModuleItems = async (_projectId, moduleKey) => Array.from(projectItems.values()).filter(item => item.moduleKey === moduleKey);
  projects.searchAll = vi.fn(async (_projectId, query) => [{
    id: "hit-1", moduleKey: "description" as const, entityType: "projectItem", entityId: "project-context",
    title: `项目中的${query}`, score: 80, updatedAt: new Date().toISOString(),
    destination: { section: "description" as const, entityType: "projectItem", entityId: "project-context" },
  }]);
  const registry = new RichToolRegistry();
  registerScenarioTools(registry, {
    elements: {
      async list() { return Array.from(elements.values()); },
      async get(id) { return elements.get(id) ?? null; },
      async put(element) { elements.set(element.id, element); },
    } as never,
    projects,
    operationRepo: new MemoryOperationRepo(),
  });
  return { registry, elements, projectItems, projects };
}

describe("MCP 2.0 scenario tools", () => {
  it("captures conversation information as a traceable Rich knowledge record", async () => {
    const { registry, elements } = makeHarness();
    const response = await registry.invoke("rich_knowledge_capture", {
      title: "Rich 应采用场景型 MCP",
      kind: "decision",
      summary: "用少量场景工具替代大量原子工具。",
      details: ["Hermes 重新学习新工具", "不兼容 MCP v1"],
      tags: ["Rich", "MCP"],
      source: { conversationId: "chat-1", messageIds: ["message-7"] },
      context: { requestId: "capture-1" },
    });

    expect(response).toMatchObject({
      ok: true,
      data: { item: { title: "Rich 应采用场景型 MCP", content: { kind: "decision", source: { conversationId: "chat-1" } } } },
      verification: { status: "verified" },
    });
    expect(Array.from(elements.values())[0]?.content).toMatchObject({ summary: "用少量场景工具替代大量原子工具。" });
  });

  it("organizes one conversation into summary, decisions, and todos in a single call", async () => {
    const { registry, projectItems, projects } = makeHarness();
    const response = await registry.invoke("rich_project_organize_conversation", {
      projectId: "rich",
      conversation: { id: "chat-1", summary: "确定 MCP 2.0 方案" },
      decisions: [{ title: "按场景划分工具", detail: "降低工具选择负担" }],
      todos: [{ title: "实现委派端口", priority: "high" }],
      context: { requestId: "organize-1" },
    });

    expect(response).toMatchObject({ ok: true, data: { items: expect.arrayContaining([
      expect.objectContaining({ moduleKey: "description" }),
      expect.objectContaining({ moduleKey: "scenarios" }),
      expect.objectContaining({ moduleKey: "todos" }),
    ]) }, verification: { status: "verified" } });
    expect(projectItems.size).toBe(3);
    expect(projects.createModuleItem).toHaveBeenCalledTimes(3);
  });

  it("reports partial writes instead of pretending a multi-record organization succeeded", async () => {
    const { registry, projectItems } = makeHarness({ failTitle: "失败事项" });
    const response = await registry.invoke("rich_project_organize_conversation", {
      projectId: "rich",
      conversation: { summary: "部分写入测试" },
      todos: [{ title: "成功事项" }, { title: "失败事项" }],
      context: { requestId: "organize-partial" },
    });
    expect(response).toMatchObject({
      ok: false,
      error: { code: "TASK_FAILED", details: { failed: [expect.objectContaining({ title: "失败事项" })] } },
      warnings: [expect.stringContaining("部分")],
    });
    expect(projectItems.size).toBe(2);
  });

  it("analyzes a goal using current Rich context without writing", async () => {
    const { registry, elements, projects } = makeHarness();
    elements.set("knowledge-1", {
      id: "knowledge-1", type: "knowledge", title: "Multica CLI", tags: ["agent"], content: { summary: "任务编排" },
      metadata: { createdAt: "2026-08-28T00:00:00.000Z", updatedAt: "2026-08-28T00:00:00.000Z", generatedBy: "ai", richness: 1 },
    });
    const response = await registry.invoke("rich_project_analyze_and_plan", {
      projectId: "rich",
      goal: "让 Rich 使用 Multica CLI 委派 Agent",
      constraints: ["先保留人工验收"],
    });
    expect(response).toMatchObject({
      ok: true,
      data: {
        analysis: { goal: "让 Rich 使用 Multica CLI 委派 Agent", relevantContext: expect.any(Array) },
        plan: { steps: expect.arrayContaining([expect.objectContaining({ verification: expect.any(String) })]) },
      },
      verification: { status: "verified" },
    });
    expect(projects.searchAll).toHaveBeenCalledTimes(1);
    expect(projects.createModuleItem).not.toHaveBeenCalled();
  });
});
