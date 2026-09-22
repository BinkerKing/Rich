import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { fileURLToPath } from "node:url";
import { existsSync, realpathSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { relative } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { elementsRoutes } from "./routes/elements.js";
import { relationsRoutes } from "./routes/relations.js";
import { pathsRoutes } from "./routes/paths.js";
import { signalsRoutes } from "./routes/signals.js";
import { stateRoutes } from "./routes/state.js";
import { corpusRoutes } from "./routes/corpus.js";
import { aiRoutes } from "./routes/ai.js";
import { adminRoutes } from "./routes/admin.js";
import { join, resolve as pathResolve, join as pathJoin, extname as pathExtname } from "node:path";
import { readFile as fsReadFile, stat as fsStat } from "node:fs/promises";

const STATIC_MIMES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

type MiniProgramTone = "cyan" | "blue" | "gold" | "green" | "violet" | "slate";

interface MiniProgramDefinition {
  id: string;
  label: string;
  desc: string;
  category: string;
  icon: string;
  tone: MiniProgramTone;
  candidates: string[];
}

const richWorkspaceDir = process.env.RICH_WORKSPACE_DIR
  ? pathResolve(process.env.RICH_WORKSPACE_DIR)
  : pathResolve(process.env.HOME ?? process.cwd(), "Documents/Ai-WorkSpace");

function inWorkspace(...segments: string[]) {
  return pathResolve(richWorkspaceDir, ...segments);
}

const MINI_PROGRAMS: MiniProgramDefinition[] = [
  {
    id: "riking-ybt-ops-manual",
    label: "Riking-YBT-OpsManual",
    desc: "打开【首都银行】一表通独立运维手册",
    category: "Script",
    icon: "book",
    tone: "cyan",
    candidates: [
      inWorkspace("Tools/Riking-YBT-OpsManual/index.html"),
      inWorkspace("Script/Riking-YBT-OpsManual/index.html"),
    ],
  },
  {
    id: "file-compare",
    label: "对比文件工具",
    desc: "打开中间层数据文件对比工具",
    category: "tools",
    icon: "card",
    tone: "gold",
    candidates: [
      inWorkspace("Tools/对比文件脚本/web/compare.html"),
      inWorkspace("Tools/对比文件脚本/dist/中间层数据文件对比工具/首页.html"),
      inWorkspace("Script/对比文件脚本/web/compare.html"),
      inWorkspace("Script/对比文件脚本/dist/中间层数据文件对比工具/首页.html"),
    ],
  },
  {
    id: "speech-script-presenter",
    label: "演讲稿",
    desc: "适合演讲现场查看和编辑节点、重点、提示的讲稿小程序",
    category: "Tools",
    icon: "chat",
    tone: "blue",
    candidates: [
      inWorkspace("Tools/SpeechScriptPresenter/index.html"),
    ],
  },
];

function resolveMiniProgramTarget(program: MiniProgramDefinition): string | null {
  return program.candidates.find(candidate => existsSync(candidate)) ?? null;
}

function findOpsManualIndex(): string | null {
  const external = MINI_PROGRAMS.find(program => program.id === "riking-ybt-ops-manual");
  return external ? resolveMiniProgramTarget(external) : null;
}

function openLocalFile(target: string) {
  const command = process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "cmd"
      : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", target] : [target];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}
import { annotationsRoutes } from "./routes/annotations.js";
import { imagesRoutes } from "./routes/images.js";
import { attachmentsRoutes } from "./routes/attachments.js";
import { mindmapsRoutes } from "./routes/mindmaps.js";
import { SqliteElementsRepo } from "./repos/SqliteElementsRepo.js";
import { SqliteRelationsRepo } from "./repos/SqliteRelationsRepo.js";
import { SqlitePathsRepo } from "./repos/SqlitePathsRepo.js";
import { SqliteSignalsRepo } from "./repos/SqliteSignalsRepo.js";
import { SqliteChatVisualBlocksRepo } from "./repos/SqliteChatVisualBlocksRepo.js";
import { SqliteFlowchartsRepo } from "./repos/SqliteFlowchartsRepo.js";
import { SqliteDeliverablesRepo } from "./repos/SqliteDeliverablesRepo.js";
import { SqliteChatAttachmentsRepo } from "./repos/SqliteChatAttachmentsRepo.js";
import { SqliteChatConversationsRepo } from "./repos/SqliteChatConversationsRepo.js";
import { SqliteDeliverableCodexConversationRepo } from "./repos/SqliteDeliverableCodexConversationRepo.js";
import { SqliteAgentConversationConfigRepo } from "./repos/SqliteAgentConversationConfigRepo.js";
import { SqliteAgentConversationTurnRepo } from "./repos/SqliteAgentConversationTurnRepo.js";
import { SqliteAgentToolCallRepo } from "./repos/SqliteAgentToolCallRepo.js";
import { SqliteAgentApprovalRepo } from "./repos/SqliteAgentApprovalRepo.js";
import { SqliteQARepo } from "./repos/SqliteQARepo.js";
import { SqliteAnnotationsRepo } from "./repos/SqliteAnnotationsRepo.js";
import { SqliteStateRepo } from "./repos/SqliteStateRepo.js";
import { SqliteCorpusRepo } from "./repos/SqliteCorpusRepo.js";
import { openDb } from "./db/sqlite.js";
import { openPostgresPool } from "./db/postgres.js";
import type { ElementsRepo } from "./repos/ElementsRepo.js";
import type { RelationsRepo } from "./repos/RelationsRepo.js";
import type { PathsRepo } from "./repos/PathsRepo.js";
import type { SignalsRepo } from "./repos/SignalsRepo.js";
import type { ChatVisualBlocksRepo } from "./repos/ChatVisualBlocksRepo.js";
import type { FlowchartsRepo } from "./repos/FlowchartsRepo.js";
import type { DeliverablesRepo } from "./repos/DeliverablesRepo.js";
import type { ChatAttachmentsRepo } from "./repos/ChatAttachmentsRepo.js";
import type { ChatConversationsRepo } from "./repos/ChatConversationsRepo.js";
import type { DeliverableCodexConversationRepo } from "./repos/DeliverableCodexConversationRepo.js";
import type { AgentConversationConfigRepo } from "./repos/AgentConversationConfigRepo.js";
import type { AgentConversationTurnRepo } from "./repos/AgentConversationTurnRepo.js";
import type { AgentToolCallRepo } from "./repos/AgentToolCallRepo.js";
import type { AgentApprovalRepo } from "./repos/AgentApprovalRepo.js";
import type { HealthRepo } from "./repos/HealthRepo.js";
import type { QARepo } from "./repos/QARepo.js";
import type { AnnotationsRepo } from "./repos/AnnotationsRepo.js";
import type { StateRepo } from "./repos/StateRepo.js";
import type { CorpusRepo } from "./repos/CorpusRepo.js";
import { dataDir, aiDir } from "./lib/paths.js";
import { ClaudeAdapter } from "./ai/claude.js";
import { CodexAdapter } from "./ai/codex.js";
import { HermesAdapter } from "./ai/hermes.js";
import { HermesTaskExecutor } from "./ai-tasks/HermesTaskExecutor.js";
import { MulticaTaskExecutor } from "./ai-tasks/MulticaTaskExecutor.js";
import { AiTaskDispatcher } from "./ai-tasks/AiTaskDispatcher.js";
import { DeliverableTaskHistoryService } from "./ai-tasks/DeliverableTaskHistoryService.js";
import { appendDeliverableCodexOperationRecord, describeDeliverableCodexOperation } from "./deliverable-codex/DeliverableCodexOperationLog.js";
import { BailianAdapter } from "./ai/bailian.js";
import { loadAIEngineSettings } from "./ai/engineSettings.js";
import { configureOpLog, healStaleRunningOps, recordTraceForExistingOp } from "./ai/aiOpLog.js";
import { OperationCorrelationRegistry } from "./ai/operationCorrelation.js";
import { imageQueue } from "./ai/imageQueue.js";
import type { AIAdapter } from "./ai/adapter.js";
import { pickScenarioAdapter } from "./ai/pickAdapter.js";
import { createAIContextProvider } from "./ai/contextProvider.js";
import { createLogger, noopLogger, type Logger } from "./lib/logger.js";
import { installShutdownHandlers, childRegistry } from "./lib/childRegistry.js";
import { McpTransportState, mountMcpV2 } from "./mcp-v2/transport.js";
import type { MulticaBindingRepo } from "./mcp-v2/delegation/multica/MulticaBindingRepo.js";
import { SqliteMulticaBindingRepo } from "./mcp-v2/delegation/multica/SqliteMulticaBindingRepo.js";
import { PostgresMulticaBindingRepo } from "./mcp-v2/delegation/multica/PostgresMulticaBindingRepo.js";
import { openSqliteMulticaWorkbenchSnapshotRepo } from "./mcp-v2/delegation/multica/SqliteMulticaWorkbenchSnapshotRepo.js";
import { createMulticaIntegration } from "./mcp-v2/delegation/multica/createMulticaIntegration.js";
import { MulticaTaskSynchronizer } from "./mcp-v2/delegation/multica/MulticaTaskSynchronizer.js";
import type { McpOperationRepo } from "./repos/McpOperationRepo.js";
import type { McpTaskRepo } from "./repos/McpTaskRepo.js";
import { SqliteMcpOperationRepo } from "./repos/SqliteMcpOperationRepo.js";
import { SqliteMcpTaskRepo } from "./repos/SqliteMcpTaskRepo.js";
import { PostgresMcpOperationRepo } from "./repos/PostgresMcpOperationRepo.js";
import { PostgresMcpTaskRepo } from "./repos/PostgresMcpTaskRepo.js";
import { eventsRoute } from "./routes/events.js";
import { greatMeRoutes } from "./routes/greatMe.js";
import { chatRoutes } from "./routes/chat.js";
import { chatVisualBlocksRoutes } from "./routes/chatVisualBlocks.js";
import { chatAttachmentsRoutes } from "./routes/chatAttachments.js";
import { healthRoutes } from "./routes/health.js";
import { createReminderTicker } from "./lib/reminderTicker.js";
import { projectsRoutes } from "./routes/projects.js";
import { projectManagementRoutes } from "./routes/projectManagement.js";
import { flowchartsRoutes } from "./routes/flowcharts.js";
import { deliverablesRoutes } from "./routes/deliverables.js";
import { testCenterRoutes } from "./routes/testCenter.js";
import { TestCenterSqliteRepo } from "./test-center/TestCenterSqliteRepo.js";
import { aiTaskRoutes } from "./routes/aiTasks.js";
import { multicaProjectWorkbenchRoutes } from "./routes/multicaProjectWorkbench.js";
import { projectDictionaryTestFilesRoutes } from "./routes/projectDictionaryTestFiles.js";
import { rikingProjectsRoutes } from "./routes/rikingProjects.js";
import { cronRoutes } from "./routes/cron.js";
import { ImprovementsRepo, type ImprovementsStore } from "./repos/ImprovementsRepo.js";
import { improvementsRoutes } from "./routes/improvements.js";
import { InvocationsRepo, type InvocationsStore } from "./repos/InvocationsRepo.js";
import { ToolRuntime } from "./tools/runtime.js";
import { lockScreenTool } from "./tools/lockScreen.js";
import { BreakReminder } from "./lib/breakReminder.js";
import { toolboxRoutes } from "./routes/toolbox.js";
import { mascotRoutes } from "./routes/mascot.js";
import { SqliteGreatMeRepo } from "./repos/SqliteGreatMeRepo.js";
import type { GreatMeRepo } from "./repos/GreatMeRepo.js";
import { PostgresElementsRepo } from "./repos/PostgresElementsRepo.js";
import { PostgresRelationsRepo } from "./repos/PostgresRelationsRepo.js";
import { PostgresPathsRepo } from "./repos/PostgresPathsRepo.js";
import { PostgresSignalsRepo } from "./repos/PostgresSignalsRepo.js";
import { PostgresChatVisualBlocksRepo } from "./repos/PostgresChatVisualBlocksRepo.js";
import { PostgresFlowchartsRepo } from "./repos/PostgresFlowchartsRepo.js";
import { PostgresDeliverablesRepo } from "./repos/PostgresDeliverablesRepo.js";
import { PostgresChatAttachmentsRepo } from "./repos/PostgresChatAttachmentsRepo.js";
import { PostgresChatConversationsRepo } from "./repos/PostgresChatConversationsRepo.js";
import { PostgresDeliverableCodexConversationRepo } from "./repos/PostgresDeliverableCodexConversationRepo.js";
import { PostgresAgentConversationConfigRepo } from "./repos/PostgresAgentConversationConfigRepo.js";
import { PostgresAgentConversationTurnRepo } from "./repos/PostgresAgentConversationTurnRepo.js";
import { PostgresAgentToolCallRepo } from "./repos/PostgresAgentToolCallRepo.js";
import { PostgresAgentApprovalRepo } from "./repos/PostgresAgentApprovalRepo.js";
import { PostgresHealthRepo } from "./repos/PostgresHealthRepo.js";
import { PostgresQARepo } from "./repos/PostgresQARepo.js";
import { PostgresAnnotationsRepo } from "./repos/PostgresAnnotationsRepo.js";
import { PostgresStateRepo } from "./repos/PostgresStateRepo.js";
import { PostgresCorpusRepo } from "./repos/PostgresCorpusRepo.js";
import { PostgresGreatMeRepo } from "./repos/PostgresGreatMeRepo.js";
import { PostgresInvocationsRepo } from "./repos/PostgresInvocationsRepo.js";
import { PostgresImprovementsRepo } from "./repos/PostgresImprovementsRepo.js";
import { getAgentId } from "./lib/agentId.js";
import { eventBus } from "./lib/eventBus.js";
import { PROJECT_MANAGEMENT_MODULES, type ProjectManagementModuleKey, type ProjectManagementRepo } from "./repos/ProjectManagementRepo.js";
import { PostgresProjectManagementRepo } from "./repos/PostgresProjectManagementRepo.js";
import { SqliteProjectManagementRepo } from "./repos/SqliteProjectManagementRepo.js";
import type { ProjectAutomationRepo } from "./modules/project-automation/contracts.js";
import { PostgresProjectAutomationRepo } from "./modules/project-automation/infrastructure/PostgresProjectAutomationRepo.js";
import { SqliteProjectAutomationRepo } from "./modules/project-automation/infrastructure/SqliteProjectAutomationRepo.js";
import { projectAutomationRoutes } from "./modules/project-automation/presentation/routes.js";
import { PersistentTaskService } from "./mcp-v2/tasks/persistentTaskService.js";
import { createAIObservability } from "./ai/observability.js";
import { syncProjectPlanTasks } from "./services/projectPlanTaskSync.js";
import { AgentCapabilityGateway } from "./agent-conversations/AgentCapabilityGateway.js";
import { AgentConversationService } from "./agent-conversations/AgentConversationService.js";
import { AgentToolCallService } from "./agent-conversations/AgentToolCallService.js";
import { AgentApprovalService } from "./agent-conversations/AgentApprovalService.js";
import { HermesAgentRuntime } from "./agent-conversations/HermesAgentRuntime.js";
import { CodexAppServerRuntime } from "./agent-conversations/CodexAppServerRuntime.js";
import { ConversationPromotionService } from "./agent-conversations/ConversationPromotionService.js";
import { DeliverableTaskContextService } from "./ai-tasks/DeliverableTaskContextService.js";
import { DeliverableCodexContextService } from "./deliverable-codex/DeliverableCodexContextService.js";
import { deliverableCodexRoutes } from "./routes/deliverableCodex.js";
import { PromptLibraryService } from "./prompt-library/PromptLibraryService.js";
import { promptLibraryRoutes } from "./routes/promptLibrary.js";
import { SqliteWorkbenchRepo, PostgresWorkbenchRepo, type WorkbenchRepo } from "./task-workbench/repository.js";
import { WorkbenchService } from "./task-workbench/service.js";
import { WorkbenchCommands } from "./task-workbench/commands.js";
import { taskWorkbenchRoutes } from "./routes/taskWorkbench.js";
import { SqliteWorkbenchDocumentRepo, PostgresWorkbenchDocumentRepo, type WorkbenchDocumentRepo } from "./workbench-document/repository.js";
import { WorkbenchDocumentService } from "./workbench-document/service.js";
import { workbenchDocumentRoutes } from "./routes/workbenchDocuments.js";
import type { AiTaskManagementRepo } from "./repos/AiTaskManagementRepo.js";
import { SqliteAiTaskManagementRepo } from "./repos/SqliteAiTaskManagementRepo.js";
import { PostgresAiTaskManagementRepo } from "./repos/PostgresAiTaskManagementRepo.js";
import { AiTaskManagementService } from "./ai-task-management/service.js";
import { migrateImprovementTasks } from "./ai-task-management/improvementMigration.js";
import { aiTaskManagementRoutes } from "./routes/aiTaskManagement.js";

export interface BuildAppOptions {
  adapters?: AIAdapter[];
  logger?: Logger;
  /** Override the AI manuals directory. Defaults to monorepo's `ai/`. */
  aiDir?: string;
}

export function buildApp(root: string, adapters?: AIAdapter[], logger?: Logger, opts: BuildAppOptions = {}) {
  // Storage backend selection. SQLite by default; PostgreSQL supports multi-machine Rich nodes.
  const storage = (process.env.KE_STORAGE ?? "sqlite").toLowerCase();
  let elements: ElementsRepo;
  let relations: RelationsRepo;
  let paths: PathsRepo;
  let signals: SignalsRepo;
  let qa: QARepo;
  let annotations: AnnotationsRepo;
  let state: StateRepo;
  let workbenchRepo: WorkbenchRepo | null = null;
  let workbenchDocumentRepo: WorkbenchDocumentRepo | null = null;
  let corpus: CorpusRepo;
  let greatMe: GreatMeRepo;
  let improvements: ImprovementsStore | null = null;
  let invocations: InvocationsStore | null = null;
  let projectManagement: ProjectManagementRepo;
  let testCenter: TestCenterSqliteRepo | null = null;
  let projectAutomation: ProjectAutomationRepo;
  let mcpOperationRepo: McpOperationRepo;
  let mcpTaskRepo: McpTaskRepo;
  let aiTaskManagementRepo: AiTaskManagementRepo;
  let multicaBindingRepo: MulticaBindingRepo;
  /** chat_visual_blocks 仅 sqlite + postgres 后端支持；json 模式下保持 null。 */
  let chatVisualBlocks: ChatVisualBlocksRepo | null = null;
  let flowcharts: FlowchartsRepo;
  let deliverables: DeliverablesRepo;
  /** chat_attachments 同上 —— bytea 存储需要数据库后端 */
  let chatAttachments: ChatAttachmentsRepo | null = null;
  let chatConversations: ChatConversationsRepo | null = null;
  let deliverableCodexConversations: DeliverableCodexConversationRepo | null = null;
  let agentConversationConfigs: AgentConversationConfigRepo | null = null;
  let agentConversationTurns: AgentConversationTurnRepo | null = null;
  let agentToolCalls: AgentToolCallRepo | null = null;
  let agentApprovals: AgentApprovalRepo | null = null;
  /** Body Insights 健康档案 —— V0.1 只支持 postgres（数据敏感、需跨机同步） */
  let healthRepo: HealthRepo | null = null;
  if (storage === "postgres") {
    const connectionString = process.env.DATABASE_URL ?? process.env.KE_DATABASE_URL;
    if (!connectionString) {
      throw new Error("KE_STORAGE=postgres requires DATABASE_URL or KE_DATABASE_URL");
    }
    const pg = openPostgresPool(connectionString);
    elements = new PostgresElementsRepo(pg);
    relations = new PostgresRelationsRepo(pg);
    paths = new PostgresPathsRepo(pg);
    signals = new PostgresSignalsRepo(pg);
    qa = new PostgresQARepo(pg);
    annotations = new PostgresAnnotationsRepo(pg);
    state = new PostgresStateRepo(pg);
    workbenchRepo = new PostgresWorkbenchRepo(pg);
    workbenchDocumentRepo = new PostgresWorkbenchDocumentRepo(pg);
    corpus = new PostgresCorpusRepo(pg);
    greatMe = new PostgresGreatMeRepo(pg);
    invocations = new PostgresInvocationsRepo(pg);
    improvements = new PostgresImprovementsRepo(pg);
    chatVisualBlocks = new PostgresChatVisualBlocksRepo(pg);
    flowcharts = new PostgresFlowchartsRepo(pg);
    deliverables = new PostgresDeliverablesRepo(pg);
    chatAttachments = new PostgresChatAttachmentsRepo(pg);
    chatConversations = new PostgresChatConversationsRepo(pg);
    deliverableCodexConversations = new PostgresDeliverableCodexConversationRepo(pg);
    agentConversationConfigs = new PostgresAgentConversationConfigRepo(pg);
    agentConversationTurns = new PostgresAgentConversationTurnRepo(pg);
    agentToolCalls = new PostgresAgentToolCallRepo(pg);
    agentApprovals = new PostgresAgentApprovalRepo(pg);
    healthRepo = new PostgresHealthRepo(pg);
    projectManagement = new PostgresProjectManagementRepo(pg);
    // Test center is single-user execution data. Keep its SQLite repository
    // available in PostgreSQL deployments until a PostgreSQL implementation
    // exists, so the project menu and MCP/CLI contract remain usable.
    testCenter = new TestCenterSqliteRepo(openDb(join(root, "test-center.db")));
    projectAutomation = new PostgresProjectAutomationRepo(pg);
    mcpOperationRepo = new PostgresMcpOperationRepo(pg);
    mcpTaskRepo = new PostgresMcpTaskRepo(pg);
    aiTaskManagementRepo = new PostgresAiTaskManagementRepo(pg);
    multicaBindingRepo = new PostgresMulticaBindingRepo(pg);
  } else if (storage === "sqlite") {
    const dbPath = process.env.KE_SQLITE_PATH ?? join(root, "ke.db");
    const db = openDb(dbPath);
    elements = new SqliteElementsRepo(db);
    relations = new SqliteRelationsRepo(db);
    paths = new SqlitePathsRepo(db);
    signals = new SqliteSignalsRepo(db);
    qa = new SqliteQARepo(db);
    annotations = new SqliteAnnotationsRepo(db);
    state = new SqliteStateRepo(db);
    workbenchRepo = new SqliteWorkbenchRepo(db);
    workbenchDocumentRepo = new SqliteWorkbenchDocumentRepo(db);
    corpus = new SqliteCorpusRepo(db);
    greatMe = new SqliteGreatMeRepo(db);
    improvements = new ImprovementsRepo(db);
    invocations = new InvocationsRepo(db);
    chatVisualBlocks = new SqliteChatVisualBlocksRepo(db);
    flowcharts = new SqliteFlowchartsRepo(db);
    deliverables = new SqliteDeliverablesRepo(db);
    chatAttachments = new SqliteChatAttachmentsRepo(db);
    chatConversations = new SqliteChatConversationsRepo(db);
    deliverableCodexConversations = new SqliteDeliverableCodexConversationRepo(db);
    agentConversationConfigs = new SqliteAgentConversationConfigRepo(db);
    agentConversationTurns = new SqliteAgentConversationTurnRepo(db);
    agentToolCalls = new SqliteAgentToolCallRepo(db);
    agentApprovals = new SqliteAgentApprovalRepo(db);
    projectManagement = new SqliteProjectManagementRepo(db);
    testCenter = new TestCenterSqliteRepo(db);
    projectAutomation = new SqliteProjectAutomationRepo(db);
    mcpOperationRepo = new SqliteMcpOperationRepo(db);
    mcpTaskRepo = new SqliteMcpTaskRepo(db);
    aiTaskManagementRepo = new SqliteAiTaskManagementRepo(db);
    multicaBindingRepo = new SqliteMulticaBindingRepo(db);
  } else {
    throw new Error(`Unsupported KE_STORAGE=${storage}. Use sqlite or postgres.`);
  }

  // Toolbox runtime constructed below (after `log` is defined).
  // Adapter order is no longer the routing policy. Keep Hermes/Codex/Claude
  // registered here, and let modelRouter decide per AI scenario.
  const ai = adapters ?? opts.adapters ?? [
    new HermesAdapter(),
    new BailianAdapter(),
    new CodexAdapter(),
    new ClaudeAdapter(),
  ];
  const hermesAdapter = ai.find(adapter => adapter.name === "hermes") ?? null;
  const agentExecution = agentConversationConfigs && agentConversationTurns && agentToolCalls && agentApprovals && chatConversations && hermesAdapter
    ? (() => {
        const gateway = new AgentCapabilityGateway(
          process.env.RICH_AGENT_CAPABILITY_SECRET || randomUUID(),
          (turnId, now) => agentConversationTurns!.hasActiveLease(turnId, now),
        );
        const toolService = new AgentToolCallService(agentToolCalls, gateway, async () => {
          throw new Error("Agent runtime tool execution is unavailable for chat_only");
        }, new AgentApprovalService(agentApprovals));
        return new AgentConversationService(agentConversationConfigs, chatConversations, {
          turns: agentConversationTurns,
          toolCallRepo: agentToolCalls,
          toolCalls: toolService,
          runtime: new HermesAgentRuntime(hermesAdapter),
          runtimes: { hermes: new HermesAgentRuntime(hermesAdapter), codex: new CodexAppServerRuntime() },
          gateway,
          attachments: chatAttachments,
          workspaceRoot: richWorkspaceDir,
        });
      })()
    : null;
  loadAIEngineSettings();
  const log = logger ?? opts.logger ?? noopLogger;
  const multicaSnapshots = openSqliteMulticaWorkbenchSnapshotRepo(join(root, "multica-workbench.db"));
  const multica = createMulticaIntegration(multicaBindingRepo, {
    snapshots: multicaSnapshots,
    syncIntervalMs: Number(process.env.RICH_MULTICA_WORKBENCH_SYNC_INTERVAL_MS) || 5_000,
  });
  const multicaWorkTasks = new PersistentTaskService(mcpTaskRepo, {
    cancelExternal: task => multica.delegationAdapter.cancel(task.externalTaskId!),
    getExternalStatus: task => multica.delegationAdapter.getStatus(task.externalTaskId!),
  });
  const multicaTaskSynchronizer = new MulticaTaskSynchronizer(mcpTaskRepo, multica.delegationAdapter, {
    intervalMs: Number(process.env.RICH_MULTICA_SYNC_INTERVAL_MS) || 30_000,
    onError: error => log.warn("multica.task_sync.failed", {
      error: error instanceof Error ? error.message : String(error),
    }),
    availabilityCheck: async () => {
      if (!multica.commands.runText) throw new Error("DEPENDENCY_UNAVAILABLE: Multica CLI does not support version checks.");
      await multica.commands.runText(["--version"], { includeWorkspace: false });
    },
  });
  multicaTaskSynchronizer.start();
  const hermesTaskExecutor = new HermesTaskExecutor();
  const multicaTaskExecutor = new MulticaTaskExecutor(multica.delegationAdapter, async projectId => {
    try {
      if (!multica.commands.runText) return false;
      await multica.commands.runText(["--version"], { includeWorkspace: false });
      return Boolean(await multicaBindingRepo.getBinding(projectId));
    } catch { return false; }
  });
  const aiTaskDispatcher = new AiTaskDispatcher(
    multicaWorkTasks,
    [hermesTaskExecutor, multicaTaskExecutor],
    new DeliverableTaskHistoryService(multicaWorkTasks),
  );
  const aiTaskManagement = new AiTaskManagementService(aiTaskManagementRepo, improvements ?? undefined);
  if (improvements) {
    void migrateImprovementTasks(improvements, aiTaskManagementRepo, aiTaskManagement)
      .catch(error => log.warn(`Failed to migrate legacy system improvements into AI tasks: ${String(error)}`));
  }
  const promotionContext = new DeliverableTaskContextService(projectManagement, async (projectId, folderPath) => {
    const project = await elements.get(projectId);
    const localFolder = project?.type === "project" && project.content && typeof project.content === "object"
      ? (project.content as { localFolder?: unknown }).localFolder
      : null;
    if (typeof localFolder !== "string" || !localFolder) throw new Error("Project local folder is unavailable.");
    const projectRoot = realpathSync(localFolder);
    const directory = pathResolve(projectRoot, folderPath);
    const offset = relative(projectRoot, directory);
    if (offset.startsWith("..") || pathResolve(projectRoot, offset) !== directory) throw new Error("Deliverable folder is outside the project.");
    const entries = await readdir(directory, { withFileTypes: true });
    return Promise.all(entries.filter(entry => entry.isFile()).map(async entry => ({
      fileName: entry.name,
      relativePath: `${folderPath.replace(/\/$/, "")}/${entry.name}`,
      size: (await stat(pathResolve(directory, entry.name))).size,
    })));
  });
  const conversationPromotions = chatConversations
    ? new ConversationPromotionService(chatConversations, chatAttachments, (projectId, deliverableId) => promotionContext.createSnapshot(projectId, deliverableId), async request => {
        const task = await aiTaskDispatcher.publish(request);
        void aiTaskDispatcher.drain(task.id).catch(error => log.warn("ai_task.dispatch.failed", { taskId: task.id, error: error instanceof Error ? error.message : String(error) }));
        return task;
      }, request => aiTaskDispatcher.validate(request), scenario => aiTaskDispatcher.assertScenario(scenario), async action => {
        const moduleKey = action.destination.moduleKey as ProjectManagementModuleKey;
        if (!PROJECT_MANAGEMENT_MODULES.some(module => module.key === moduleKey)) {
          throw new Error(`Unknown Rich module: ${action.destination.moduleKey}.`);
        }
        return projectManagement.createModuleItem(action.destination.projectId, {
          moduleKey,
          title: action.destination.title,
          content: action.content,
        });
      })
    : null;
  const manualsDir = opts.aiDir ?? aiDir();
  const promptLibrary = new PromptLibraryService(join(root, "prompt-library.json"));
  // ─── Toolbox runtime (gracefully no-op if SQLite repo missing) ──
  const toolRuntime = invocations ? new ToolRuntime(invocations) : null;
  const breakReminder = new BreakReminder(join(root, "break-reminder.json"));
  breakReminder.restore();
  if (toolRuntime) {
    toolRuntime.register(lockScreenTool);
    // Re-schedule any deferred invocations that survived the previous crash.
    void toolRuntime.rehydrate().then(rehydrated => {
      if (rehydrated.rescheduled + rehydrated.cancelled > 0) {
        log.info("toolbox.rehydrated", rehydrated);
      }
    });
  }
  // Persist every AI op prompt + output to data/ai-ops.jsonl for the admin UI.
  configureOpLog(root);
  const aiContextProvider = createAIContextProvider(chatConversations);
  const deliverableCodexContext = new DeliverableCodexContextService(promotionContext, elements);
  const workbench = workbenchRepo && deliverableCodexConversations ? new WorkbenchService(workbenchRepo, deliverableCodexConversations) : undefined;
  const workbenchDocuments = workbenchDocumentRepo ? new WorkbenchDocumentService(workbenchDocumentRepo) : undefined;
  // Self-heal: any op stuck in "running" from a previous crash / pkill / OOM
  // gets a synthetic error terminal line, so the admin UI doesn't show
  // dead-but-still-running entries indefinitely. Fire-and-forget.
  void healStaleRunningOps().then(n => {
    if (n > 0) log.info("ai.ops.healed", { stale_running_marked_error: n });
  });
  imageQueue.configure(pickScenarioAdapter(ai, "image"), elements, log);
  const app = new Hono();
  const mcpTransportState = new McpTransportState();
  let mcpRegistryToolCount = 0;
  const operationCorrelations = new OperationCorrelationRegistry();
  // Backfill open tasks that existed before this sync was introduced. Subsequent project-plan writes
  // are synchronized by the project-management routes below.
  void (async () => {
    for (const project of (await elements.list()).filter(element => element.type === "project")) {
      await syncProjectPlanTasks(greatMe, project, await projectManagement.listAllModuleItems(project.id, "deliveryPlan"));
    }
  })().catch(error => log.warn("project.plan-task-sync.failed", { error: error instanceof Error ? error.message : String(error) }));
  app.use("*", async (c, next) => {
    c.header("access-control-allow-origin", "*");
    c.header("access-control-allow-headers", "content-type");
    if (c.req.method === "OPTIONS") return c.body(null, 204);
    await next();
  });
  app.route("/api/elements", elementsRoutes({ elements, relations, paths, qa, annotations, signals }));
  app.route("/api/relations", relationsRoutes(relations));
  app.route("/api/paths", pathsRoutes(paths));
  app.route("/api/signals", signalsRoutes(signals));
  app.route("/api/annotations", annotationsRoutes(annotations));
  app.route("/api/images", imagesRoutes());
  app.route("/api/attachments", attachmentsRoutes());
  app.route("/api/state", stateRoutes(state, elements, signals));
  app.route("/api/corpus", corpusRoutes(corpus));
  app.route("/api/great-me", greatMeRoutes(greatMe));
  app.route("/api/chat", chatRoutes(chatAttachments, ai, chatConversations, aiContextProvider, operationCorrelations, agentConversationConfigs, agentConversationTurns, agentExecution, conversationPromotions));
  if (deliverableCodexConversations && chatConversations && agentExecution) {
    if (workbench) {
      const commands = new WorkbenchCommands(workbench, agentExecution, deliverableCodexContext);
      const ready = commands.recoverInterrupted();
      app.use("/api/workbench/*", async (_c, next) => { await ready; await next(); });
      app.route("/api/workbench", taskWorkbenchRoutes(workbench, commands, join(root, "task-materials")));
    }
    app.route("/api/deliverable-codex", deliverableCodexRoutes({ conversations: deliverableCodexConversations, chats: chatConversations, context: deliverableCodexContext, agents: agentExecution, attachments: chatAttachments, prompts: promptLibrary, onTurnCompleted: async input => {
      const appended = await appendDeliverableCodexOperationRecord({ projects: projectManagement, standaloneDeliverables: deliverables, ...input });
      if (appended) eventBus.publish("deliverable.changed", { source: "mcp", detail: input });
    } }));
  }
  app.route("/api/prompt-library", promptLibraryRoutes(promptLibrary));
  app.route("/api/chat-visual-blocks", chatVisualBlocksRoutes(chatVisualBlocks));
  app.route("/api/chat/attachments", chatAttachmentsRoutes(chatAttachments));
  if (workbenchDocuments) app.route("/api/workbench-documents", workbenchDocumentRoutes(workbenchDocuments));
  app.route("/api/health", healthRoutes(healthRepo));
  app.route("/api/projects", projectsRoutes(elements, projectManagement));
  app.route("/api/ai-tasks", aiTaskRoutes({
    availability: async projectId => ({
      hermes: await hermesTaskExecutor.available(),
      multica: projectId ? await multicaTaskExecutor.available(projectId) : false,
    }),
    publish: async input => {
      const task = await aiTaskDispatcher.publish(input);
      void aiTaskDispatcher.drain(task.id).catch(error => log.warn("ai_task.dispatch.failed", { taskId: task.id, error: error instanceof Error ? error.message : String(error) }));
      return task;
    },
  }));
  app.route("/api/ai-task-management", aiTaskManagementRoutes(aiTaskManagement));
  app.route("/api/project-management", projectManagementRoutes(projectManagement, { elements, greatMe }));
  app.route("/api/flowcharts", flowchartsRoutes(flowcharts));
  app.route("/api/deliverables", deliverablesRoutes(deliverables, { elements, projectManagement }));
  if (testCenter) app.route("/api/project-management/testing", testCenterRoutes(testCenter));
  app.route("/api/project-management", projectAutomationRoutes(projectManagement, projectAutomation));
  app.route("/api/project-management", multicaProjectWorkbenchRoutes({
    workbench: multica.workbench,
    teams: multica.executionTeams,
    delegation: multica.delegationAdapter,
    tasks: multicaWorkTasks,
  }));
  app.route("/api/project-dictionary-test-files", projectDictionaryTestFilesRoutes());
  app.route("/api/riking-projects", rikingProjectsRoutes(root));

  // 提醒触发器 —— 仅在 healthRepo 可用（即 KE_STORAGE=postgres）时启动。
  // 每分钟扫描一次 enabled 的提醒，到点发飞书 + SSE。
  if (healthRepo) {
    const ticker = createReminderTicker(healthRepo);
    ticker.start();
    log.info("reminder.ticker.started");
  }
  app.route("/api/cron", cronRoutes());
  if (improvements) {
    app.route("/api/improvements", improvementsRoutes(improvements));
  }
  if (toolRuntime && invocations) {
    app.route("/api/toolbox", toolboxRoutes(toolRuntime, invocations, breakReminder));
  }
  app.route("/api/mascot", mascotRoutes());
  app.route("/api/ai", aiRoutes({
    adapters: ai, elements, relations, paths, signals, qa, annotations,
    aiDir: manualsDir, logger: log,
  }));
  app.route("/api/admin", adminRoutes({
    signals,
    aiDir: manualsDir,
    adapters: ai,
    corpus,
    chatConversations,
    contextProvider: aiContextProvider,
    observability: createAIObservability({
      adapters: ai,
      mcpTransportState,
      multicaTaskSynchronizer,
      multicaWorkTasks,
      getMcpRegistryToolCount: () => mcpRegistryToolCount,
      childRegistryCount: () => childRegistry.size(),
    }),
  }));
  // Mindmap PPT decks — element-backed. Every deck IS the root element of
  // a subtree that carries a `mindmap-embed` section. No separate storage.
  app.route("/api/mindmaps", mindmapsRoutes({
    adapters: ai, elements, relations, signals, logger: log,
  }));

  // SSE channel for UIs to receive change notifications. Backend code
  // calls `eventBus.publish("element.changed", ...)` whenever it writes
  // data; this route forwards those events to every connected tab so
  // they re-hydrate without polling.
  app.route("/api/events", eventsRoute());

  // MCP server — exposes Rich's data + AI ops as MCP tools so external
  // agents (Hermes / Claude Desktop / Cursor / Codex / etc.) can drive
  // the knowledge tree. Mounted at /mcp. Shares the same repos and AI
  // adapters as the rest of this Hono app, so an agent edit lands in
  // the same SQLite the Rich UI is reading from.
  mountMcpV2(app, {
    workbench,
    workbenchDocuments,
    elements,
    projectManagement,
    deliverables,
    operationRepo: mcpOperationRepo,
    taskRepo: mcpTaskRepo,
    greatMe,
    projectAutomation,
    testCenter: testCenter ?? undefined,
    startupProjectsRoot: root,
    delegationAdapter: multica.delegationAdapter,
    executionTeams: multica.executionTeams,
    taskService: multicaWorkTasks,
    aiTaskManagement,
    onToolEvent: event => {
      const summary = describeDeliverableCodexOperation(event.data.tool);
      const deliverableOperation = event.data.phase === "completed" && event.data.ok && summary
        && event.data.projectId && event.data.deliverableId
        ? { summary, projectId: event.data.projectId, deliverableId: event.data.deliverableId, attachment: event.data.attachment }
        : undefined;
      const operationId = event.data.requestId && operationCorrelations.resolve(event.data.requestId);
      if (!deliverableOperation && !operationId) return;
      return async () => {
        if (deliverableOperation) {
          await appendDeliverableCodexOperationRecord({
            projects: projectManagement,
            standaloneDeliverables: deliverables,
            ...deliverableOperation,
          });
          eventBus.publish("deliverable.changed", {
            source: "mcp",
            detail: { projectId: deliverableOperation.projectId, deliverableId: deliverableOperation.deliverableId, tool: event.data.tool },
          });
        }
        if (operationId) await recordTraceForExistingOp(operationId, {
          type: event.type,
          data: { tool: event.data.tool, status: event.data.phase },
        });
      };
    },
  }, {
    state: mcpTransportState,
    onRegistryBuilt: toolCount => { mcpRegistryToolCount = toolCount; },
    onError: error => log.error("mcp.v2.transport.failed", {
      error: error instanceof Error ? error.message : String(error),
    }),
  });

  // Agent-id endpoint：前端读这个值在 admin UI 默认填进 claim 表单。
  app.get("/api/agent-id", (c) => {
    return c.json({ agentId: getAgentId() });
  });

  app.post("/api/launcher/open-ops-manual", (c) => {
    const target = findOpsManualIndex();
    if (!target) {
      return c.json({ error: "ops_manual_not_found" }, 404);
    }
    try {
      openLocalFile(target);
      return c.json({ ok: true, path: target });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return c.json({ error: "open_failed", message }, 500);
    }
  });

  app.get("/api/mini-programs", (c) => {
    return c.json({
      workspaceDir: richWorkspaceDir,
      programs: MINI_PROGRAMS.map(program => {
        const target = resolveMiniProgramTarget(program);
        return {
          id: program.id,
          label: program.label,
          desc: program.desc,
          category: program.category,
          icon: program.icon,
          tone: program.tone,
          path: target,
          exists: Boolean(target),
          launchable: Boolean(target),
        };
      }),
    });
  });

  app.post("/api/mini-programs/:id/open", (c) => {
    const id = c.req.param("id");
    const program = MINI_PROGRAMS.find(item => item.id === id);
    if (!program) {
      return c.json({ error: "mini_program_not_found" }, 404);
    }
    const target = resolveMiniProgramTarget(program);
    if (!target) {
      return c.json({ error: "mini_program_entry_not_found", workspaceDir: richWorkspaceDir }, 404);
    }
    try {
      openLocalFile(target);
      return c.json({ ok: true, path: target });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return c.json({ error: "open_failed", message }, 500);
    }
  });

  // Health endpoint registered BEFORE the SPA catch-all so it actually matches.
  app.get("/api/health", async (c) => {
    const adapterChecks = await Promise.all(ai.map(async (a) => ({
      name: a.name,
      available: await a.available(),
    })));
    const allAdaptersOk = adapterChecks.some(a => a.available);
    return c.json({
      ok: allAdaptersOk,
      adapters: adapterChecks,
      uptimeSec: Math.round(process.uptime()),
      childProcesses: childRegistry.size(),
      signals: await signals.count(),
    });
  });

  // In desktop / standalone mode, serve the prebuilt web bundle from the
  // same server so the Electron BrowserWindow can load http://localhost:<p>/
  // without a separate vite dev server. Activated when KE_WEB_DIST points
  // at the apps/web/dist/ directory.
  const webDist = process.env.KE_WEB_DIST;
  if (webDist) {
    const ROOT = pathResolve(webDist);
    app.get("/*", async (c) => {
      // Skip /api/* — those are mounted earlier and would have matched.
      if (c.req.path.startsWith("/api/")) return c.notFound();
      let p = c.req.path.replace(/^\/+/, "");
      if (!p || p.endsWith("/")) p = pathJoin(p, "index.html");
      const target = pathResolve(pathJoin(ROOT, p));
      if (!target.startsWith(ROOT)) return c.notFound();
      // SPA fallback: any path not matching a real file falls back to
      // index.html so the React app can render the right view.
      const fallback = pathResolve(pathJoin(ROOT, "index.html"));
      try {
        const s = await fsStat(target);
        if (!s.isFile()) {
          const buf = await fsReadFile(fallback);
          return c.body(new Uint8Array(buf), 200, { "content-type": "text/html; charset=utf-8" });
        }
      } catch {
        try {
          const buf = await fsReadFile(fallback);
          return c.body(new Uint8Array(buf), 200, { "content-type": "text/html; charset=utf-8" });
        } catch { return c.notFound(); }
      }
      const ct = STATIC_MIMES[pathExtname(target).toLowerCase()] ?? "application/octet-stream";
      const buf = await fsReadFile(target);
      return c.body(new Uint8Array(buf), 200, { "content-type": ct, "cache-control": "private, max-age=60" });
    });
  }

  return app;
}

function isMainModule(): boolean {
  // ESM detection (works when running via tsx / node loader).
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch { return false; }
}

if (isMainModule() || process.env.KE_AUTO_START === "1") {
  const port = Number(process.env.PORT ?? 3001);
  const log = createLogger({ bound: { app: "ke-server" } });
  const app = buildApp(dataDir(), undefined, log);
  // Bind explicitly to IPv4 localhost. The desktop launcher probes candidate
  // ports on 127.0.0.1; leaving this unspecified can bind IPv6 and let a
  // second desktop instance mistakenly select an already occupied port.
  serve({ fetch: app.fetch, port, hostname: "127.0.0.1" });
  log.info("server.started", { port, url: `http://localhost:${port}` });

  // Publish the MCP URL to a known location so external agent configs
  // (Hermes, Claude Desktop, ...) can read it without guessing the port.
  // Re-written on every boot — port can shift if 31515 is taken.
  void (async () => {
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const url = `http://127.0.0.1:${port}/mcp`;
      await fs.writeFile(path.join(dataDir(), ".mcp-url"), url + "\n", "utf8");
      log.info("mcp.url.published", { url });
    } catch (e) {
      log.warn("mcp.url.publish_failed", { error: e instanceof Error ? e.message : String(e) });
    }
  })();

  installShutdownHandlers({
    onShutdown: () => log.info("server.shutdown", { childProcesses: childRegistry.size() }),
  });
}
