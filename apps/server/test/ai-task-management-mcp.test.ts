import { describe, expect, it } from "vitest";
import { RichToolRegistry } from "../src/mcp-v2/registry/toolRegistry.js";
import { openDb } from "../src/db/sqlite.js";
import { SqliteAiTaskManagementRepo } from "../src/repos/SqliteAiTaskManagementRepo.js";
import { AiTaskManagementService } from "../src/ai-task-management/service.js";
import { registerAiTaskManagementTools } from "../src/mcp-v2/tasks/aiTaskManagementTools.js";

describe("AI task management MCP", () => {
  it("lets a Codex agent list, claim, read and report a concise task", async () => {
    const service = new AiTaskManagementService(new SqliteAiTaskManagementRepo(openDb(":memory:")));
    const task = await service.create({ sceneId: "bug_fix", title: "刷新异常", input: { text: "列表未刷新", images: [], materials: [] } });
    const registry = new RichToolRegistry(); registerAiTaskManagementTools(registry, service);
    expect((await registry.invoke("rich_ai_task_list", {})).ok).toBe(true);
    expect((await registry.invoke("rich_ai_task_claim", { taskId: task.id, agentId: "codex" })).ok).toBe(true);
    expect((await registry.invoke("rich_ai_task_get", { taskId: task.id })).ok).toBe(true);
    expect((await registry.invoke("rich_ai_task_report_result", { taskId: task.id, agentId: "codex", analysis: "事件遗漏", result: "已修复", carryForward: "检查回归", statusAfter: "needs_review" })).ok).toBe(true);
  });
});
