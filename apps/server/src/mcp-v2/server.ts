import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { GreatMeRepo } from "../repos/GreatMeRepo.js";
import type { McpOperationRepo } from "../repos/McpOperationRepo.js";
import type { McpTaskRepo } from "../repos/McpTaskRepo.js";
import type { ProjectManagementRepo } from "../repos/ProjectManagementRepo.js";
import type { DeliverablesRepo } from "../repos/DeliverablesRepo.js";
import type { ProjectAutomationRepo } from "../modules/project-automation/contracts.js";
import type { WorkDelegationPort } from "./delegation/WorkDelegationPort.js";
import { UnavailableDelegationAdapter } from "./delegation/UnavailableDelegationAdapter.js";
import { RichToolRegistry } from "./registry/toolRegistry.js";
import { registerResourceTools } from "./registerResourceTools.js";
import { registerScenarioTools } from "./scenarios/registerScenarioTools.js";
import { registerDelegationTools } from "./scenarios/delegateWork.js";
import { PersistentTaskService } from "./tasks/persistentTaskService.js";
import { registerTaskTools } from "./tasks/taskTools.js";
import { registerDeliverableTaskTools } from "./tasks/deliverableTaskTools.js";
import { registerDeliverableWorkspaceTools } from "./tasks/deliverableWorkspaceTools.js";
import type { ExecutionTeamAdministrationPort } from "./scenarios/manageExecutionTeam.js";
import { RichMcpError } from "./registry/errors.js";
import type { WorkbenchService } from "../task-workbench/service.js";
import { registerWorkbenchTools } from "./resources/workbenchTools.js";
import type { WorkbenchDocumentService } from "../workbench-document/service.js";
import { registerWorkbenchDocumentTools } from "./resources/workbenchDocumentTools.js";
import type { TestCenterSqliteRepo } from "../test-center/TestCenterSqliteRepo.js";
import type { AiTaskManagementService } from "../ai-task-management/service.js";
import { registerAiTaskManagementTools } from "./tasks/aiTaskManagementTools.js";

export interface McpToolEvent {
  type: "mcp.tool";
  data: {
    phase: "started" | "completed" | "error";
    tool: string;
    requestId?: string;
    conversationId?: string;
    projectId?: string;
    deliverableId?: string;
    ok?: boolean;
  };
}

export type McpToolEventDelivery = () => void | Promise<void>;

export interface BuildMcpV2Deps {
  workbench?: WorkbenchService;
  workbenchDocuments?: WorkbenchDocumentService;
  elements: ElementsRepo;
  projectManagement: ProjectManagementRepo;
  deliverables?: DeliverablesRepo;
  operationRepo: McpOperationRepo;
  taskRepo: McpTaskRepo;
  greatMe?: GreatMeRepo;
  projectAutomation?: ProjectAutomationRepo;
  testCenter?: TestCenterSqliteRepo;
  startupProjectsRoot?: string;
  delegationAdapter?: WorkDelegationPort;
  executionTeams?: ExecutionTeamAdministrationPort;
  taskService?: PersistentTaskService;
  aiTaskManagement?: AiTaskManagementService;
  onRegistryBuilt?: (toolCount: number) => void;
  onToolEvent?: (event: McpToolEvent) => McpToolEventDelivery | void;
}

export function buildMcpV2Registry(deps: BuildMcpV2Deps): RichToolRegistry {
  // Rich now exposes the AI task lifecycle alongside the existing project,
  // deliverable, and workbench tools. Keep an explicit server-wide ceiling so
  // the full registry cannot fail during desktop startup as tools are added.
  const registry = new RichToolRegistry({ maxTools: 50 });
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
    testCenter: deps.testCenter,
    startupProjectsRoot: deps.startupProjectsRoot,
  });
  registerScenarioTools(registry, {
    elements: deps.elements,
    projects: deps.projectManagement,
    operationRepo: deps.operationRepo,
    executionTeams,
  });
  registerTaskTools(registry, { tasks, operationRepo: deps.operationRepo });
  if (deps.aiTaskManagement) registerAiTaskManagementTools(registry, deps.aiTaskManagement);
  registerDeliverableTaskTools(registry, tasks, deps.elements, deps.projectManagement);
  registerDeliverableWorkspaceTools(registry, deps.elements, deps.projectManagement, deps.operationRepo, deps.deliverables);
  if (deps.workbench) registerWorkbenchTools(registry, deps.workbench, deps.operationRepo);
  if (deps.workbenchDocuments) registerWorkbenchDocumentTools(registry, deps.workbenchDocuments, deps.operationRepo);
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
    }, async (input, extra) => {
      // Idempotency belongs to the MCP transport, not to the model. Codex
      // should never have to invent or copy a Rich request ID just to write.
      const enrichedInput = injectMcpRequestContext(input, extra.requestId, extra.sessionId);
      const correlation = { ...readCorrelation(enrichedInput), ...readDeliverableTarget(tool.name, enrichedInput) };
      emitToolEvent({ type: "mcp.tool", data: {
        phase: "started", tool: tool.name, ...correlation,
      } });
      let response;
      try {
        response = await registry.invoke(tool.name, enrichedInput);
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

function injectMcpRequestContext(input: unknown, requestId: unknown, sessionId?: string): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const source = input as Record<string, unknown>;
  const current = source.context && typeof source.context === "object" && !Array.isArray(source.context)
    ? source.context as Record<string, unknown>
    : {};
  if (typeof current.requestId === "string" && current.requestId.trim()) return input;
  const id = `mcp:${sessionId ?? "stateless"}:${String(requestId)}`;
  return { ...source, context: { ...current, requestId: id } };
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

function readDeliverableTarget(toolName: string, input: unknown): Pick<McpToolEvent["data"], "projectId" | "deliverableId"> {
  if (!toolName.startsWith("rich_deliverable_")) return {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const { projectId, deliverableId } = input as { projectId?: unknown; deliverableId?: unknown };
  return {
    ...(typeof projectId === "string" && projectId.trim() ? { projectId } : {}),
    ...(typeof deliverableId === "string" && deliverableId.trim() ? { deliverableId } : {}),
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
