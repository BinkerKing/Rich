import { readAllOpLogSnapshot, readAllOpRecords, readOpTrace, reduceToFinal, type AIOpRecord, type AITraceEvent } from "./aiOpLog.js";
import { AI_CONTEXT_POLICIES } from "./contextPolicy.js";
import type { AIAdapter } from "./adapter.js";
import type { McpTransportState } from "../mcp-v2/transport.js";
import type { MulticaTaskSynchronizer } from "../mcp-v2/delegation/multica/MulticaTaskSynchronizer.js";
import type { PersistentTaskService } from "../mcp-v2/tasks/persistentTaskService.js";

export type ServiceState = "healthy" | "degraded" | "offline" | "not_configured";

export interface ServiceHealth {
  id: string;
  label: string;
  kind: "server" | "adapter" | "mcp" | "delegation";
  state: ServiceState;
  checkedAt: string;
  detail: string;
  latencyMs?: number;
  lastSuccessAt?: string;
  lastError?: string;
}

export interface ObservabilityDeps {
  adapters: AIAdapter[];
  mcpTransportState: McpTransportState;
  multicaTaskSynchronizer: MulticaTaskSynchronizer;
  multicaWorkTasks: PersistentTaskService;
  getMcpRegistryToolCount: () => number;
  childRegistryCount?: () => number;
  now?: () => Date;
  adapterTimeoutMs?: number;
}

export function createAIObservability(deps: ObservabilityDeps) {
  const clock = deps.now ?? (() => new Date());
  const iso = () => clock().toISOString();

  return {
    async health(): Promise<ServiceHealth[]> {
      const checkedAt = iso();
      const adapters = await Promise.all(deps.adapters.map(async adapter => {
        const started = Date.now();
        let state: ServiceState = "offline";
        let lastError: string | undefined;
        const outcome = await boundedAvailability(adapter.available(), deps.adapterTimeoutMs ?? 2_000);
        if (outcome.type === "available") state = outcome.available ? "healthy" : "offline";
        else if (outcome.type === "timeout") { state = "degraded"; lastError = "Availability check timed out."; }
        else lastError = "Adapter availability check failed.";
        return {
          id: `adapter:${adapter.name}`,
          label: adapter.name,
          kind: "adapter" as const,
          state,
          checkedAt,
          detail: state === "healthy" ? "Adapter is available." : state === "degraded" ? "Adapter availability check timed out." : "Adapter is unavailable.",
          latencyMs: Date.now() - started,
          ...(lastError ? { lastError } : {}),
        };
      }));
      const transport = deps.mcpTransportState.snapshot;
      const toolCount = deps.getMcpRegistryToolCount();
      const mcpState: ServiceState = toolCount === 0
        ? "offline"
        : !transport.lastSuccessAt
          ? transport.lastError ? "offline" : "degraded"
          : transport.lastErrorAt && transport.lastErrorAt > transport.lastSuccessAt ? "offline" : "healthy";
      const sync = deps.multicaTaskSynchronizer;
      const freshAfter = (sync.intervalMs ?? 30_000) * 2;
      const lastSuccess = sync.lastSuccessAt ? new Date(sync.lastSuccessAt).getTime() : 0;
      const multicaState: ServiceState = !sync.lastSuccessAt && isDependencyUnavailable(sync.lastError)
        ? "not_configured"
        : sync.lastError || !sync.lastSuccessAt || clock().getTime() - lastSuccess > freshAfter
          ? "degraded"
          : "healthy";
      return [
        {
          id: "rich-server", label: "Rich server", kind: "server", state: "healthy", checkedAt,
          detail: `Uptime ${Math.round(process.uptime())}s; ${deps.childRegistryCount?.() ?? 0} registered child processes.`,
        },
        ...adapters,
        {
          id: "rich-mcp", label: "Rich MCP", kind: "mcp", state: mcpState, checkedAt,
          detail: `${toolCount} registry tools; ${transport.requestsTotal} transport requests.`,
          ...(transport.lastSuccessAt ? { lastSuccessAt: transport.lastSuccessAt.toISOString() } : {}),
          ...(transport.lastError ? { lastError: "Most recent MCP transport request failed." } : {}),
        },
        {
          id: "multica", label: "Multica", kind: "delegation", state: multicaState, checkedAt,
          detail: sync.lastSuccessAt ? `Last sync ${sync.lastSuccessAt}.` : "No successful task sync yet.",
          ...(sync.lastSuccessAt ? { lastSuccessAt: sync.lastSuccessAt } : {}),
          ...(sync.lastError ? { lastError: multicaState === "not_configured" ? "Multica is not configured." : "Multica synchronization failed." } : {}),
        },
      ];
    },

    async traces(kind?: "chat" | "workflow" | "delegation", limit = 50) {
      const snapshot = await readAllOpLogSnapshot();
      const records = reduceToFinal(snapshot.records);
      const items = records
        .map(record => traceListItem(record, snapshot.tracesByOp.get(record.id) ?? []))
        .filter(item => !kind || item.kind === kind);
      return { total: items.length, items: items.slice(0, limit) };
    },

    async trace(id: string) {
      const record = reduceToFinal(await readAllOpRecords()).find(item => item.id === id);
      if (!record) return null;
      const events = await readOpTrace(id);
      return {
        ...traceMetadata(record),
        hasOutput: Boolean(record.output),
        outputLength: record.output?.length ?? 0,
        events,
      };
    },

    async workflows() {
      const records = reduceToFinal(await readAllOpRecords());
      const summaries = new Map<string, { total: number; done: number; error: number; latestAt: string }>();
      for (const record of records) {
        const summary = summaries.get(record.op) ?? { total: 0, done: 0, error: 0, latestAt: record.ts };
        summary.total += 1;
        if (record.status === "done") summary.done += 1;
        if (record.status === "error") summary.error += 1;
        if (record.ts > summary.latestAt) summary.latestAt = record.ts;
        summaries.set(record.op, summary);
      }
      return {
        recentOperations: Array.from(summaries.entries())
          .map(([op, summary]) => ({ op, ...summary }))
          .sort((left, right) => right.latestAt.localeCompare(left.latestAt)),
        items: AI_CONTEXT_POLICIES.map(policy => ({
          operation: policy.operation,
          scenario: policy.scenario,
          sources: policy.sources,
          memory: policy.memory,
          notes: policy.notes,
          entryType: policy.entryType,
          usesMcp: policy.operation === "MCP tools",
          recent: summaries.get(policy.operation) ?? { total: 0, done: 0, error: 0, latestAt: undefined },
        })),
      };
    },

    async delegations() {
      const [total, tasks] = await Promise.all([
        deps.multicaWorkTasks.count(),
        deps.multicaWorkTasks.list({ limit: 50 }),
      ]);
      return { total, items: tasks.map(task => ({
        id: task.id,
        title: task.title,
        status: task.status,
        backend: task.backend,
        externalTaskId: task.externalTaskId,
        resultRefs: task.resultRefs.map(ref => ({ type: ref.type, id: ref.id })),
        reviewStatus: task.reviewStatus,
        conversationId: task.conversationId,
        requestId: task.requestId,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        updatedAt: task.updatedAt,
        finishedAt: task.finishedAt,
        lastSyncedAt: task.lastSyncedAt,
        hasError: Boolean(task.error),
        errorLength: task.error?.length ?? 0,
        hasProgress: Boolean(task.progressSummary),
        progress: task.progressSummary ? "available" : "none",
      })) };
    },
  };
}

function traceListItem(record: AIOpRecord, events: AITraceEvent[]) {
  const kind = events.some(event => event.type === "mcp.tool" && event.data?.tool === "rich_work_delegate")
    ? "delegation"
    : record.op === "chat" || record.op === "chat-stream" ? "chat" : "workflow";
  return { ...traceMetadata(record), kind };
}

function traceMetadata(record: AIOpRecord) {
  return {
    id: record.id,
    ts: record.ts,
    op: record.op,
    model: record.model,
    scenario: record.scenario,
    elementId: record.elementId,
    status: record.status,
    durationMs: record.durationMs,
    sessionId: record.sessionId,
  };
}

type AvailabilityOutcome =
  | { type: "available"; available: boolean }
  | { type: "timeout" }
  | { type: "error"; message: string };

async function boundedAvailability(available: Promise<boolean>, timeoutMs: number): Promise<AvailabilityOutcome> {
  let timer: NodeJS.Timeout | undefined;
  const outcome: Promise<AvailabilityOutcome> = available.then(
    value => ({ type: "available", available: value }),
    error => ({ type: "error", message: error instanceof Error ? error.message : String(error) }),
  );
  const result = await Promise.race([
    outcome,
    new Promise<AvailabilityOutcome>(resolve => { timer = setTimeout(() => resolve({ type: "timeout" }), timeoutMs); }),
  ]);
  if (timer) clearTimeout(timer);
  return result;
}

function isDependencyUnavailable(error?: string): boolean {
  return Boolean(error && /dependency[_ ]unavailable|not configured|missing|unavailable|incompatible/i.test(error));
}
