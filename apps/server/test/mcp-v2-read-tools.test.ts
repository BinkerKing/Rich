import { describe, expect, it } from "vitest";
import type { Element } from "@ke/domain";
import { EmptyProjectManagementRepo } from "../src/repos/EmptyProjectManagementRepo.js";
import type {
  ProjectManagementSearchHit,
  ProjectManagementSummary,
  ProjectModuleItem,
} from "../src/repos/ProjectManagementRepo.js";
import { registerResourceTools } from "../src/mcp-v2/registerResourceTools.js";
import { RichToolRegistry } from "../src/mcp-v2/registry/toolRegistry.js";

const elements: Element[] = [
  {
    id: "knowledge-mcp",
    type: "concept",
    title: "MCP 与 CLI",
    subtitle: "Agent 工具边界",
    tags: ["MCP", "Agent"],
    content: { sections: [{ id: "summary", title: "结论", blocks: [{ style: "prose", text: "MCP 面向模型提供结构化工具。" }] }] },
    metadata: { createdAt: "2026-08-28T00:00:00.000Z", updatedAt: "2026-08-28T00:00:00.000Z", generatedBy: "ai", richness: 2 },
  },
  {
    id: "knowledge-other",
    type: "report",
    title: "数据治理周报",
    tags: ["治理"],
    content: { sections: [] },
    metadata: { createdAt: "2026-08-27T00:00:00.000Z", updatedAt: "2026-08-27T00:00:00.000Z", generatedBy: "human", richness: 1 },
  },
];

const projectSummary: ProjectManagementSummary = {
  projectId: "project-rich",
  modules: [{ key: "todos", label: "项目代办", count: 1 }],
  dictionary: { systems: 1, tables: 2, fields: 8 },
};

const projectItem: ProjectModuleItem = {
  id: "todo-mcp-v2",
  projectId: "project-rich",
  moduleKey: "todos",
  title: "实现 MCP 2.0 注册表",
  sortOrder: 0,
  content: { status: "doing" },
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T01:00:00.000Z",
};

const projectHit: ProjectManagementSearchHit = {
  id: "search-todo-mcp-v2",
  moduleKey: "todos",
  entityType: "moduleItem",
  entityId: projectItem.id,
  title: projectItem.title,
  excerpt: "为 Hermes 提供少量稳定工具",
  score: 90,
  updatedAt: projectItem.updatedAt,
  destination: { section: "todos", entityType: "moduleItem", entityId: projectItem.id },
};

function makeRegistry() {
  const registry = new RichToolRegistry();
  const projectManagement = new EmptyProjectManagementRepo();
  projectManagement.getSummary = async () => projectSummary;
  projectManagement.searchAll = async (_projectId, query) => query.includes("MCP") ? [projectHit] : [];
  projectManagement.listModuleItems = async (_projectId, moduleKey) => moduleKey === "todos" ? [projectItem] : [];
  registerResourceTools(registry, {
    elements: {
      async list() { return elements; },
      async get(id) { return elements.find(element => element.id === id) ?? null; },
    } as never,
    projectManagement,
  });
  return registry;
}

describe("MCP 2.0 read resource tools", () => {
  it("registers the core read and resource-management entry points", () => {
    expect(makeRegistry().listDefinitions().map(tool => tool.name)).toEqual([
      "rich_context_get_overview",
      "rich_context_search",
      "rich_dictionary_manage",
      "rich_flowchart_manage",
      "rich_knowledge_manage",
      "rich_practice_manage",
      "rich_project_manage",
      "rich_report_manage",
      "rich_startup_project_manual",
    ]);
  });

  it("searches knowledge and project context in one result", async () => {
    const response = await makeRegistry().invoke("rich_context_search", {
      query: "MCP",
      projectId: "project-rich",
    });

    expect(response).toMatchObject({
      ok: true,
      data: {
        results: expect.arrayContaining([
          expect.objectContaining({ source: "project", id: "todo-mcp-v2", title: "实现 MCP 2.0 注册表" }),
          expect.objectContaining({ source: "knowledge", id: "knowledge-mcp", title: "MCP 与 CLI" }),
        ]),
      },
      refs: expect.arrayContaining([
        { type: "projectItem", id: "todo-mcp-v2" },
        { type: "knowledge", id: "knowledge-mcp" },
      ]),
    });
  });

  it("respects source filters and returns an empty result without writing", async () => {
    const response = await makeRegistry().invoke("rich_context_search", {
      query: "不存在的内容",
      sources: ["knowledge"],
    });
    expect(response).toMatchObject({ ok: true, data: { results: [] }, refs: [] });
  });

  it("returns a combined overview", async () => {
    const response = await makeRegistry().invoke("rich_context_get_overview", {
      projectId: "project-rich",
    });
    expect(response).toMatchObject({
      ok: true,
      data: {
        knowledge: { total: 2, byType: { concept: 1, report: 1 } },
        project: projectSummary,
      },
      refs: [{ type: "project", id: "project-rich" }],
    });
  });

  it("lists and gets knowledge through one manage tool", async () => {
    const registry = makeRegistry();
    const list = await registry.invoke("rich_knowledge_manage", {
      action: "list",
      type: "concept",
    });
    expect(list).toMatchObject({
      ok: true,
      data: { items: [{ id: "knowledge-mcp", title: "MCP 与 CLI" }] },
    });

    const get = await registry.invoke("rich_knowledge_manage", {
      action: "get",
      id: "knowledge-mcp",
    });
    expect(get).toMatchObject({ ok: true, data: { item: { id: "knowledge-mcp" } } });

    const missing = await registry.invoke("rich_knowledge_manage", {
      action: "get",
      id: "missing",
    });
    expect(missing).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("reads summary, search results, and module items through project manage", async () => {
    const registry = makeRegistry();
    await expect(registry.invoke("rich_project_manage", {
      action: "summary",
      projectId: "project-rich",
    })).resolves.toMatchObject({ ok: true, data: { summary: projectSummary } });
    await expect(registry.invoke("rich_project_manage", {
      action: "search",
      projectId: "project-rich",
      query: "MCP",
    })).resolves.toMatchObject({ ok: true, data: { results: [projectHit] } });
    await expect(registry.invoke("rich_project_manage", {
      action: "list",
      projectId: "project-rich",
      moduleKey: "todos",
    })).resolves.toMatchObject({ ok: true, data: { items: [projectItem] } });
  });

  it("rejects invalid actions and missing action-specific fields", async () => {
    const registry = makeRegistry();
    await expect(registry.invoke("rich_project_manage", {
      action: "delete_everything",
      projectId: "project-rich",
    })).resolves.toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    await expect(registry.invoke("rich_project_manage", {
      action: "search",
      projectId: "project-rich",
    })).resolves.toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });
});
