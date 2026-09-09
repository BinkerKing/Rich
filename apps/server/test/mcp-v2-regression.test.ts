import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildMcpV2Registry } from "../src/mcp-v2/server.js";
import { EmptyProjectManagementRepo } from "../src/repos/EmptyProjectManagementRepo.js";
import type { McpTask, McpTaskListOptions, McpTaskRepo } from "../src/repos/McpTaskRepo.js";

class MemoryTaskRepo implements McpTaskRepo {
  private readonly tasks = new Map<string, McpTask>();
  create(task: McpTask): void { this.tasks.set(task.id, task); }
  get(id: string): McpTask | null { return this.tasks.get(id) ?? null; }
  list(options: McpTaskListOptions = {}): McpTask[] { return Array.from(this.tasks.values()).filter(task => !options.status || task.status === options.status); }
  count(options: Pick<McpTaskListOptions, "status"> = {}) { return this.list(options).length; }
  save(task: McpTask): void { this.tasks.set(task.id, task); }
}

function makeRegistry() {
  return buildMcpV2Registry({
    elements: {
      async list() { return []; }, async get() { return null; }, async put() {}, async removeMany() {},
    } as never,
    projectManagement: new EmptyProjectManagementRepo(),
    operationRepo: { async claim() { throw new Error("not used by read regression"); }, async complete() {}, async abandon() {} },
    taskRepo: new MemoryTaskRepo(),
    greatMe: { async get() { return { plans: [], version: 1 }; }, async put() {} },
    projectAutomation: {
      async listPlans() { return []; }, async getPlan() { return null; },
      async createPlan() { throw new Error("not used"); }, async updatePlan() { return null; }, async deletePlan() { return false; },
    } as never,
  });
}

describe("MCP 2.0 final regression", () => {
  it("covers representative reads from every retained Rich domain", async () => {
    const registry = makeRegistry();
    const calls: Array<[string, unknown]> = [
      ["rich_context_get_overview", {}],
      ["rich_knowledge_manage", { action: "list" }],
      ["rich_project_manage", { action: "summary", projectId: "rich" }],
      ["rich_dictionary_manage", { action: "list_systems", projectId: "rich" }],
      ["rich_planning_manage", { action: "get_state" }],
      ["rich_practice_manage", { action: "list" }],
      ["rich_automation_manage", { action: "list_plans", projectId: "rich" }],
      ["rich_work_list", {}],
    ];
    for (const [name, input] of calls) {
      await expect(registry.invoke(name, input), name).resolves.toMatchObject({ ok: true, action: name });
    }
  });

  it("contains no legacy tool names", () => {
    const names = makeRegistry().listDefinitions().map(tool => tool.name);
    // Optional business modules may register tools, within the registry budget.
    expect(names.length).toBeLessThanOrEqual(40);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining([
      "rich_deliverable_get", "rich_deliverable_files_get", "rich_deliverable_file_read",
      "rich_project_files_get", "rich_project_file_read",
      "rich_deliverable_record_create", "rich_deliverable_record_update",
      "rich_deliverable_requirement_update", "rich_deliverable_settings_update",
      "rich_deliverable_file_meta_update",
      "rich_startup_project_manual",
    ]));
    expect(names.every(name => name.startsWith("rich_"))).toBe(true);
    expect(names).not.toEqual(expect.arrayContaining([
      "create_element", "project_management_summary", "plan_get", "practice_get", "create_improvement",
    ]));
  });

  it("has removed the legacy MCP registration sources", () => {
    const legacy = ["server.ts", "tasks.ts", "transport.ts", "corpusTools.ts", "projectManagementTools.ts", "planTools.ts", "practiceTools.ts", "projectAutomationTools.ts"];
    const directory = fileURLToPath(new URL("../src/mcp/", import.meta.url));
    expect(legacy.filter(file => existsSync(`${directory}${file}`))).toEqual([]);
  });
});
