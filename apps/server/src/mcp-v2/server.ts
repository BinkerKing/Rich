import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { GreatMeRepo } from "../repos/GreatMeRepo.js";
import type { McpOperationRepo } from "../repos/McpOperationRepo.js";
import type { McpTaskRepo } from "../repos/McpTaskRepo.js";
import type { ProjectManagementRepo } from "../repos/ProjectManagementRepo.js";
import type { ProjectAutomationRepo } from "../modules/project-automation/contracts.js";
import type { WorkDelegationPort } from "./delegation/WorkDelegationPort.js";
import { UnavailableDelegationAdapter } from "./delegation/UnavailableDelegationAdapter.js";
import { RichToolRegistry } from "./registry/toolRegistry.js";
import { registerResourceTools } from "./registerResourceTools.js";
import { registerScenarioTools } from "./scenarios/registerScenarioTools.js";
import { registerDelegationTools } from "./scenarios/delegateWork.js";
import { PersistentTaskService } from "./tasks/persistentTaskService.js";
import { registerTaskTools } from "./tasks/taskTools.js";

export interface BuildMcpV2Deps {
  elements: ElementsRepo;
  projectManagement: ProjectManagementRepo;
  operationRepo: McpOperationRepo;
  taskRepo: McpTaskRepo;
  greatMe?: GreatMeRepo;
  projectAutomation?: ProjectAutomationRepo;
  delegationAdapter?: WorkDelegationPort;
}

export function buildMcpV2Registry(deps: BuildMcpV2Deps): RichToolRegistry {
  const registry = new RichToolRegistry({ maxTools: 40 });
  const adapter = deps.delegationAdapter ?? new UnavailableDelegationAdapter(
    "Agent delegation is not configured. Install and configure a Multica CLI adapter before delegating work.",
  );
  const tasks = new PersistentTaskService(deps.taskRepo, {
    cancelExternal: task => adapter.cancel(task.externalTaskId!),
    getExternalStatus: task => adapter.getStatus(task.externalTaskId!),
  });

  registerResourceTools(registry, {
    elements: deps.elements,
    projectManagement: deps.projectManagement,
    operationRepo: deps.operationRepo,
    greatMe: deps.greatMe,
    projectAutomation: deps.projectAutomation,
  });
  registerScenarioTools(registry, {
    elements: deps.elements,
    projects: deps.projectManagement,
    operationRepo: deps.operationRepo,
  });
  registerTaskTools(registry, { tasks, operationRepo: deps.operationRepo });
  registerDelegationTools(registry, {
    adapter,
    tasks,
    elements: deps.elements,
    operationRepo: deps.operationRepo,
  });
  return registry;
}

export function buildMcpV2Server(deps: BuildMcpV2Deps): McpServer {
  const registry = buildMcpV2Registry(deps);
  const server = new McpServer({ name: "rich", version: "2.0.0" });

  for (const tool of registry.listRegistrations()) {
    server.registerTool(tool.name, {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: {
        readOnlyHint: tool.annotations.readOnly,
        destructiveHint: tool.annotations.destructive,
        idempotentHint: tool.annotations.idempotent,
      },
      _meta: {
        "rich/category": tool.category,
        "rich/verification": tool.verification,
        "rich/examples": tool.examples,
      },
    }, async input => {
      const response = await registry.invoke(tool.name, input);
      return {
        isError: !response.ok,
        content: [{ type: "text" as const, text: JSON.stringify(response) }],
      };
    });
  }
  return server;
}
