import { describe, expect, it, vi } from "vitest";
import type { Element } from "@ke/domain";
import { registerResourceTools } from "../src/mcp-v2/registerResourceTools.js";
import { RichToolRegistry } from "../src/mcp-v2/registry/toolRegistry.js";
import type {
  McpOperationClaim,
  McpOperationRecord,
  McpOperationRepo,
} from "../src/repos/McpOperationRepo.js";
import { EmptyProjectManagementRepo } from "../src/repos/EmptyProjectManagementRepo.js";
import type { ProjectModuleItem } from "../src/repos/ProjectManagementRepo.js";
import type { ProjectDictionaryTable } from "../src/repos/ProjectManagementRepo.js";
import type { AutomationPlanDetail } from "../src/modules/project-automation/contracts.js";
import type { Flowchart } from "../src/repos/FlowchartsRepo.js";

class MemoryOperationRepo implements McpOperationRepo {
  readonly records = new Map<string, McpOperationRecord>();

  claim(toolName: string, requestId: string, inputHash: string): McpOperationClaim {
    const key = `${toolName}:${requestId}`;
    const existing = this.records.get(key);
    if (existing) return { claimed: false, record: existing };
    this.records.set(key, {
      toolName,
      requestId,
      inputHash,
      status: "pending",
      createdAt: "2026-08-28T00:00:00.000Z",
    });
    return { claimed: true };
  }

  complete(toolName: string, requestId: string, inputHash: string, response: Parameters<McpOperationRepo["complete"]>[3]): void {
    const key = `${toolName}:${requestId}`;
    this.records.set(key, {
      ...this.records.get(key)!,
      inputHash,
      status: "completed",
      response,
      completedAt: "2026-08-28T00:00:01.000Z",
    });
  }

  abandon(toolName: string, requestId: string): void {
    this.records.delete(`${toolName}:${requestId}`);
  }
}

function makeHarness(options: { persistWrites?: boolean } = {}) {
  const elementMap = new Map<string, Element>();
  const put = vi.fn(async (element: Element) => {
    if (options.persistWrites !== false) elementMap.set(element.id, element);
  });
  const removeMany = vi.fn(async (ids: string[]) => {
    for (const id of ids) elementMap.delete(id);
  });
  const projectItems = new Map<string, ProjectModuleItem>();
  const flowcharts = new Map<string, Flowchart>();
  const projectManagement = new EmptyProjectManagementRepo();
  projectManagement.listModuleItems = async (_projectId, moduleKey) =>
    Array.from(projectItems.values()).filter(item => item.moduleKey === moduleKey);
  projectManagement.listAllModuleItems = projectManagement.listModuleItems;
  projectManagement.createModuleItem = async (projectId, input) => {
    const item: ProjectModuleItem = {
      id: `item-${projectItems.size + 1}`,
      projectId,
      moduleKey: input.moduleKey,
      parentId: input.parentId ?? undefined,
      title: input.title,
      subtitle: input.subtitle ?? undefined,
      sortOrder: input.sortOrder ?? 0,
      content: input.content ?? {},
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    };
    projectItems.set(item.id, item);
    return item;
  };
  projectManagement.updateModuleItem = async (_projectId, id, patch) => {
    const current = projectItems.get(id);
    if (!current) return null;
    const next = { ...current, ...patch, parentId: patch.parentId ?? current.parentId, content: patch.content ?? current.content } as ProjectModuleItem;
    projectItems.set(id, next);
    return next;
  };
  projectManagement.deleteModuleItem = async (_projectId, id) => projectItems.delete(id);

  const registry = new RichToolRegistry();
  const operationRepo = new MemoryOperationRepo();
  const flowchartRepo = {
    get: async (id: string) => flowcharts.get(id) ?? null,
    update: async (id: string, patch: Partial<Pick<Flowchart, "title" | "graph">>) => {
      const current = flowcharts.get(id);
      if (!current) return null;
      const next = { ...current, ...patch, updatedAt: "2026-08-28T00:00:01.000Z" };
      flowcharts.set(id, next);
      return next;
    },
  };
  registerResourceTools(registry, {
    elements: {
      async list() { return Array.from(elementMap.values()); },
      async get(id) { return elementMap.get(id) ?? null; },
      put,
      removeMany,
    } as never,
    projectManagement,
    operationRepo,
    flowcharts: flowchartRepo as never,
  });
  return { registry, elementMap, projectItems, flowcharts, put, removeMany, operationRepo };
}

describe("MCP 2.0 safe resource writes", () => {
  it("previews a create without writing or requiring a request id", async () => {
    const { registry, elementMap, put } = makeHarness();
    const response = await registry.invoke("rich_knowledge_manage", {
      action: "create",
      input: { title: "MCP 2.0", type: "concept" },
      options: { dryRun: true },
    });

    expect(response).toMatchObject({
      ok: true,
      data: { dryRun: true },
      changes: [{ operation: "create", resource: "knowledge" }],
      verification: { status: "skipped" },
    });
    expect(elementMap.size).toBe(0);
    expect(put).not.toHaveBeenCalled();
  });

  it("requires a request id for a real write", async () => {
    const { registry, put } = makeHarness();
    const response = await registry.invoke("rich_knowledge_manage", {
      action: "create",
      input: { title: "MCP 2.0", type: "concept" },
    });
    expect(response).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(put).not.toHaveBeenCalled();
  });

  it("writes, verifies, and replays an idempotent create", async () => {
    const { registry, elementMap, put } = makeHarness();
    const input = {
      action: "create",
      input: { title: "MCP 2.0", type: "concept", tags: ["MCP"] },
      context: { requestId: "create-knowledge-1" },
    };

    const created = await registry.invoke("rich_knowledge_manage", input);
    const replay = await registry.invoke("rich_knowledge_manage", input);

    expect(created).toMatchObject({
      ok: true,
      data: { item: { title: "MCP 2.0" } },
      verification: { status: "verified" },
    });
    expect(replay).toEqual(created);
    expect(elementMap.size).toBe(1);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("updates an existing record and verifies the read-back", async () => {
    const harness = makeHarness();
    harness.elementMap.set("knowledge-1", baseElement("knowledge-1", "旧标题"));

    const response = await harness.registry.invoke("rich_knowledge_manage", {
      action: "update",
      id: "knowledge-1",
      input: { title: "新标题" },
      context: { requestId: "update-knowledge-1" },
    });

    expect(response).toMatchObject({ ok: true, data: { item: { title: "新标题" } }, verification: { status: "verified" } });
    expect(harness.elementMap.get("knowledge-1")?.title).toBe("新标题");
  });

  it("requires confirmation before delete and verifies confirmed deletion", async () => {
    const harness = makeHarness();
    harness.elementMap.set("knowledge-1", baseElement("knowledge-1", "待删除"));
    const input = {
      action: "delete",
      id: "knowledge-1",
      context: { requestId: "delete-knowledge-1" },
    };

    await expect(harness.registry.invoke("rich_knowledge_manage", input)).resolves.toMatchObject({
      ok: false,
      error: { code: "CONFIRMATION_REQUIRED" },
    });
    expect(harness.removeMany).not.toHaveBeenCalled();

    const deleted = await harness.registry.invoke("rich_knowledge_manage", {
      ...input,
      options: { confirmDestructive: true },
    });
    expect(deleted).toMatchObject({ ok: true, verification: { status: "verified" } });
    expect(harness.elementMap.has("knowledge-1")).toBe(false);
  });

  it("does not report success when write-after-read verification fails", async () => {
    const { registry } = makeHarness({ persistWrites: false });
    const response = await registry.invoke("rich_knowledge_manage", {
      action: "create",
      input: { title: "不会落库", type: "concept" },
      context: { requestId: "failed-readback-1" },
    });
    expect(response).toMatchObject({
      ok: false,
      error: { code: "TASK_FAILED" },
      verification: { status: "failed" },
    });
  });

  it("uses the same safe pipeline for project item creation", async () => {
    const { registry, projectItems } = makeHarness();
    const response = await registry.invoke("rich_project_manage", {
      action: "create_item",
      projectId: "project-rich",
      moduleKey: "todos",
      input: { title: "实现写安全" },
      context: { requestId: "create-project-item-1" },
    });
    expect(response).toMatchObject({ ok: true, verification: { status: "verified" } });
    expect(Array.from(projectItems.values())[0]).toMatchObject({ title: "实现写安全", moduleKey: "todos" });
  });

  it("reads a project flowchart through its dedicated MCP tool", async () => {
    const harness = makeHarness();
    harness.projectItems.set("flowchart-1", {
      id: "flowchart-1", projectId: "project-rich", moduleKey: "flowcharts", title: "订单处理", sortOrder: 0,
      content: { graph: { version: 1, objective: "梳理订单处理", status: "active", nodes: [{ id: "start", position: { x: 100, y: 100 }, data: { label: "接收订单", kind: "step", description: "", source: "", verified: false, scope: "root" } }], edges: [] } },
      createdAt: "2026-08-28T00:00:00.000Z", updatedAt: "2026-08-28T00:00:00.000Z",
    });

    await expect(harness.registry.invoke("rich_flowchart_manage", {
      action: "get", projectId: "project-rich", flowchartId: "flowchart-1",
    })).resolves.toMatchObject({
      ok: true,
      data: { flowchart: { id: "flowchart-1", title: "订单处理", graph: { nodes: [{ id: "start" }] } } },
    });
  });

  it("updates a standalone flowchart that is bound to the requested project", async () => {
    const harness = makeHarness();
    harness.elementMap.set("project-rich", { id: "project-rich", type: "project", title: "Rich 项目", content: { flowchartIds: ["standalone-flowchart"] }, metadata: { createdAt: "2026-08-28T00:00:00.000Z", updatedAt: "2026-08-28T00:00:00.000Z", generatedBy: "user", richness: 1 } });
    harness.flowcharts.set("standalone-flowchart", { id: "standalone-flowchart", title: "旧版流程图", graph: { version: 1, objective: "", status: "active", nodes: [{ id: "start", position: { x: 0, y: 0 }, data: { label: "开始", kind: "step" } }], edges: [] }, createdAt: "2026-08-28T00:00:00.000Z", updatedAt: "2026-08-28T00:00:00.000Z" });

    const response = await harness.registry.invoke("rich_flowchart_manage", {
      action: "update_node", projectId: "project-rich", flowchartId: "standalone-flowchart", nodeId: "start",
      patch: { description: "由 Codex 补充的说明" }, context: { requestId: "standalone-flowchart-node-1" },
    });

    expect(response).toMatchObject({ ok: true, verification: { status: "verified" } });
    expect(harness.flowcharts.get("standalone-flowchart")?.graph).toMatchObject({ nodes: [{ data: { description: "由 Codex 补充的说明" } }] });
  });

  it("creates flowchart nodes and edges, and updates node details with read-back verification", async () => {
    const harness = makeHarness();
    harness.projectItems.set("flowchart-1", {
      id: "flowchart-1", projectId: "project-rich", moduleKey: "flowcharts", title: "订单处理", sortOrder: 0,
      content: { graph: { version: 1, objective: "", status: "draft", nodes: [{ id: "start", position: { x: 100, y: 100 }, data: { label: "接收订单", kind: "step", description: "", source: "", verified: false, scope: "root" } }], edges: [] } },
      createdAt: "2026-08-28T00:00:00.000Z", updatedAt: "2026-08-28T00:00:00.000Z",
    });

    const node = await harness.registry.invoke("rich_flowchart_manage", {
      action: "create_node", projectId: "project-rich", flowchartId: "flowchart-1",
      node: { id: "review", label: "人工审核", kind: "decision", position: { x: 420, y: 100 }, description: "检查订单风险" },
      context: { requestId: "flowchart-node-1" },
    });
    const detail = await harness.registry.invoke("rich_flowchart_manage", {
      action: "update_node", projectId: "project-rich", flowchartId: "flowchart-1", nodeId: "review",
      patch: { description: "检查订单风险并决定是否继续" }, context: { requestId: "flowchart-detail-1" },
    });
    const edge = await harness.registry.invoke("rich_flowchart_manage", {
      action: "create_edge", projectId: "project-rich", flowchartId: "flowchart-1",
      edge: { id: "start-review", source: "start", target: "review", label: "提交审核" }, context: { requestId: "flowchart-edge-1" },
    });

    expect(node).toMatchObject({ ok: true, verification: { status: "verified" } });
    expect(detail).toMatchObject({ ok: true, data: { node: { data: { description: "检查订单风险并决定是否继续" } } }, verification: { status: "verified" } });
    expect(edge).toMatchObject({ ok: true, verification: { status: "verified" } });
    expect(harness.projectItems.get("flowchart-1")?.content).toMatchObject({ graph: { nodes: expect.arrayContaining([expect.objectContaining({ id: "review" })]), edges: [expect.objectContaining({ source: "start", target: "review" })] } });
  });

  it("creates, updates, and deletes colored flowchart region nodes", async () => {
    const harness = makeHarness();
    harness.projectItems.set("flowchart-region", {
      id: "flowchart-region", projectId: "project-rich", moduleKey: "flowcharts", title: "订单处理", sortOrder: 0,
      content: { graph: { version: 1, objective: "", status: "draft", nodes: [], edges: [] } },
      createdAt: "2026-08-28T00:00:00.000Z", updatedAt: "2026-08-28T00:00:00.000Z",
    });

    await expect(harness.registry.invoke("rich_flowchart_manage", {
      action: "create_node", projectId: "project-rich", flowchartId: "flowchart-region",
      node: { id: "review-area", label: "人工审核区", kind: "region", tone: "amber", width: 680, height: 320, position: { x: 80, y: 60 } }, context: { requestId: "flowchart-region-create-1" },
    })).resolves.toMatchObject({ ok: true, data: { node: { id: "review-area", type: "region", style: { width: 680, height: 320 }, data: { tone: "amber" } } }, verification: { status: "verified" } });
    await expect(harness.registry.invoke("rich_flowchart_manage", {
      action: "update_node", projectId: "project-rich", flowchartId: "flowchart-region", nodeId: "review-area",
      patch: { tone: "mint", width: 720, height: 360 }, context: { requestId: "flowchart-region-update-1" },
    })).resolves.toMatchObject({ ok: true, data: { node: { type: "region", style: { width: 720, height: 360 }, data: { tone: "mint" } } }, verification: { status: "verified" } });
    await expect(harness.registry.invoke("rich_flowchart_manage", {
      action: "delete_node", projectId: "project-rich", flowchartId: "flowchart-region", nodeId: "review-area", context: { requestId: "flowchart-region-delete-1" }, options: { confirmDestructive: true },
    })).resolves.toMatchObject({ ok: true, data: { deletedNodeId: "review-area" }, verification: { status: "verified" } });
  });

  it("registers and safely writes dictionary, planning, practice, and automation resources", async () => {
    const elementMap = new Map<string, Element>();
    let planningState: unknown = { plans: [], version: 0 };
    let tables: ProjectDictionaryTable[] = [{
      id: "table-1",
      tableName: "OLD_TABLE",
      tableCn: "旧表",
      hasMapping: true,
      fieldCount: 0,
    }];
    const automationPlans = new Map<string, AutomationPlanDetail>();
    const projectManagement = new EmptyProjectManagementRepo();
    projectManagement.listDictionaryTables = async () => tables;
    projectManagement.updateDictionaryTable = async (_projectId, tableId, patch) => {
      const current = tables.find(table => table.id === tableId);
      if (!current) return null;
      const next = { ...current, ...patch };
      tables = tables.map(table => table.id === tableId ? next : table);
      return next;
    };
    const operationRepo = new MemoryOperationRepo();
    const registry = new RichToolRegistry();
    registerResourceTools(registry, {
      elements: {
        async list() { return Array.from(elementMap.values()); },
        async get(id) { return elementMap.get(id) ?? null; },
        async put(element) { elementMap.set(element.id, element); },
      } as never,
      projectManagement,
      operationRepo,
      greatMe: {
        async get() { return planningState; },
        async put(value) { planningState = value; },
      },
      projectAutomation: {
        async listPlans() { return Array.from(automationPlans.values()); },
        async getPlan(_projectId, planId) { return automationPlans.get(planId) ?? null; },
        async createPlan(projectId, input) {
          const plan: AutomationPlanDetail = {
            id: `plan-${automationPlans.size + 1}`,
            projectId,
            name: input.name,
            description: input.description ?? undefined,
            sortOrder: input.sortOrder ?? 0,
            createdAt: "2026-08-28T00:00:00.000Z",
            updatedAt: "2026-08-28T00:00:00.000Z",
            groups: [],
          };
          automationPlans.set(plan.id, plan);
          return plan;
        },
      } as never,
    });

    expect(registry.listDefinitions().map(tool => tool.name)).toEqual(expect.arrayContaining([
      "rich_dictionary_manage",
      "rich_planning_manage",
      "rich_practice_manage",
      "rich_automation_manage",
    ]));

    await expect(registry.invoke("rich_dictionary_manage", {
      action: "update_table",
      projectId: "project-rich",
      id: "table-1",
      input: { tableCn: "新表" },
      context: { requestId: "dictionary-update-1" },
    })).resolves.toMatchObject({ ok: true, verification: { status: "verified" } });
    expect(tables[0].tableCn).toBe("新表");

    await expect(registry.invoke("rich_planning_manage", {
      action: "replace_state",
      input: { plans: [{ id: "plan-year" }], version: 1 },
      context: { requestId: "planning-replace-1" },
      options: { confirmDestructive: true },
    })).resolves.toMatchObject({ ok: true, verification: { status: "verified" } });
    expect(planningState).toEqual({ plans: [{ id: "plan-year" }], version: 1 });

    await expect(registry.invoke("rich_practice_manage", {
      action: "create",
      input: { title: "MCP 实战" },
      context: { requestId: "practice-create-1" },
    })).resolves.toMatchObject({ ok: true, verification: { status: "verified" } });
    expect(Array.from(elementMap.values())[0]).toMatchObject({ type: "practice", title: "MCP 实战" });

    await expect(registry.invoke("rich_automation_manage", {
      action: "create_plan",
      projectId: "project-rich",
      input: { name: "每日同步" },
      context: { requestId: "automation-create-1" },
    })).resolves.toMatchObject({ ok: true, verification: { status: "verified" } });
    expect(Array.from(automationPlans.values())[0]).toMatchObject({ name: "每日同步" });
  });
});

function baseElement(id: string, title: string): Element {
  return {
    id,
    type: "concept",
    title,
    tags: [],
    content: { sections: [] },
    metadata: {
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
      generatedBy: "ai",
      richness: 1,
    },
  };
}
