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
import type { ExecutionTeamAdministrationPort } from "./scenarios/manageExecutionTeam.js";
import { RichMcpError } from "./registry/errors.js";

export interface McpToolEvent {
  type: "mcp.tool";
  data: {
    phase: "started" | "completed" | "error";
    tool: string;
    requestId?: string;
    conversationId?: string;
    ok?: boolean;
  };
}

export type McpToolEventDelivery = () => void | Promise<void>;

export interface BuildMcpV2Deps {
  elements: ElementsRepo;
  projectManagement: ProjectManagementRepo;
  operationRepo: McpOperationRepo;
  taskRepo: McpTaskRepo;
  greatMe?: GreatMeRepo;
  projectAutomation?: ProjectAutomationRepo;
  delegationAdapter?: WorkDelegationPort;
  executionTeams?: ExecutionTeamAdministrationPort;
  taskService?: PersistentTaskService;
  onRegistryBuilt?: (toolCount: number) => void;
  onToolEvent?: (event: McpToolEvent) => McpToolEventDelivery | void;
}

export function buildMcpV2Registry(deps: BuildMcpV2Deps): RichToolRegistry {
  const registry = new RichToolRegistry({ maxTools: 40 });
  const adapter = deps.delegationAdapter ?? new UnavailableDelegationAdapter(
    "Agent delegation is not configured. Install and configure a Multica CLI adapter before delegating work.",
  );
  const tasks = deps.taskService ?? new PersistentTaskService(deps.taskRepo, {
    cancelExternal: task => adapter.cancel(task.externalTaskId!),
    getExternalStatus: task => adapter.getStatus(task.externalTaskId!),
  });
  const executionTeams = deps.executionTeams ?? unavailableExecutionTeams();

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
    executionTeams,
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

function unavailableExecutionTeams(): ExecutionTeamAdministrationPort {
  const unavailable = async (): Promise<never> => {
    throw new RichMcpError("DEPENDENCY_UNAVAILABLE", "Multica execution-team management is not configured.", { retryable: true });
  };
  return { planTeam: unavailable, applyPlan: unavailable, getPlan: unavailable, getBinding: unavailable };
}

export function buildMcpV2Server(deps: BuildMcpV2Deps): McpServer {
  const registry = buildMcpV2Registry(deps);
  deps.onRegistryBuilt?.(registry.listRegistrations().length);
  const server = new McpServer({ name: "rich", version: "2.0.0" });
  const emitToolEvent = createToolEventQueue(deps.onToolEvent);

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
      const correlation = readCorrelation(input);
      emitToolEvent({ type: "mcp.tool", data: {
        phase: "started", tool: tool.name, ...correlation,
      } });
      let response;
      try {
        response = await registry.invoke(tool.name, input);
      } catch (error) {
        emitToolEvent({ type: "mcp.tool", data: {
          phase: "error", tool: tool.name, ...correlation, ok: false,
        } });
        throw error;
      }
      emitToolEvent({ type: "mcp.tool", data: {
        phase: response.ok ? "completed" : "error",
        tool: tool.name,
        ...correlation,
        ok: response.ok,
      } });
      return {
        isError: !response.ok,
        content: [{ type: "text" as const, text: JSON.stringify(response) }],
      };
    });
  }
  return server;
}

function readCorrelation(input: unknown): Pick<McpToolEvent["data"], "requestId" | "conversationId"> {
  if (!input || typeof input !== "object") return {};
  const context = (input as { context?: unknown }).context;
  if (!context || typeof context !== "object") return {};
  const { requestId, conversationId } = context as { requestId?: unknown; conversationId?: unknown };
  return {
    ...(typeof requestId === "string" ? { requestId } : {}),
    ...(typeof conversationId === "string" ? { conversationId } : {}),
  };
}

function createToolEventQueue(listener: BuildMcpV2Deps["onToolEvent"]): (event: McpToolEvent) => void {
  let queue: Promise<void> = Promise.resolve();
  return event => {
    if (!listener) return;
    let delivery: McpToolEventDelivery | void;
    try {
      delivery = listener(event);
    } catch {
      return;
    }
    if (!delivery) return;
    queue = queue
      .catch(() => undefined)
      .then(async () => { await delivery(); })
      .catch(() => undefined);
  };
}
