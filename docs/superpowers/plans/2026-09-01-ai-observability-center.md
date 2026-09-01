# AI Observability Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current AI engine dashboard with an evidence-based observability center that checks Rich, model adapters, Rich MCP, and Multica health; catalogs AI pathways; and reconstructs each chat and delegated-task execution trace.

**Architecture:** Keep the existing append-only AI operation log as the source for model-operation traces, but add append-only correlated trace events so a chat turn retains its planner, selected adapter, Hermes tool progress, and final answer. Add an admin-only observability service that combines that log with read-only runtime probes for adapters, Rich MCP registration, persistent work tasks, and Multica. The web UI becomes five focused views: service health, chat traces, embedded workflows, delegation loop, and Agent/MCP inventory.

**Tech Stack:** TypeScript, Hono, Vitest, React, existing JSONL AI operation log, MCP SDK registry, SQLite/Postgres task repositories, Multica CLI adapter.

---

## Scope and terminology

- A **service** is a long-lived dependency whose health can be probed: Rich server, Hermes, model adapter, Rich MCP, Multica CLI/synchronization.
- An **Agent** is an execution role. It may be `ready` without a process currently running; it is not marked failed merely because it has no active task.
- A **trace** is a single request execution. It includes the request, planner decision, adapter, tool events, output/error, and correlations to any `McpTask`.
- An **embedded workflow** is a direct `/api/ai/*` or `/api/mindmaps/*` operation. It must not be presented as an MCP call unless it actually invokes MCP.
- Do not implement a synthetic MCP “test write.” Rich MCP health is derived from server registration plus its latest invocation event; health probes remain read-only.

## File structure

| File | Responsibility |
| --- | --- |
| `apps/server/src/ai/aiOpLog.ts` | Persist and query correlated trace events alongside operation records. |
| `apps/server/src/ai/observability.ts` | Build service health, trace, workflow catalog, and delegation snapshots for admin routes. |
| `apps/server/src/routes/chat.ts` | Emit trace events for chat planning, adapter selection, Hermes tool progress, fallback, output, and errors. |
| `apps/server/src/mcp-v2/server.ts` | Emit Rich MCP tool start/completion/error events with `context.requestId` / `conversationId` correlation. |
| `apps/server/src/mcp-v2/delegation/multica/MulticaTaskSynchronizer.ts` | Expose last synchronization attempt/result for the health snapshot. |
| `apps/server/src/routes/admin.ts` | Serve focused observability endpoints; retain existing `/engine` compatibility during migration. |
| `apps/server/src/index.ts` | Construct the observability dependencies once and provide them to `/api/admin`. |
| `apps/web/src/views/AdminView.tsx` | Replace the monolithic engine tab with the five focused AI observability views. |
| `apps/web/src/views/AdminView.css` | Add only styles required by the new focused pages and execution timeline. |

## Task 1: Add correlated, append-only AI trace events

**Files:**
- Modify: `apps/server/src/ai/aiOpLog.ts`
- Create: `apps/server/test/ai-op-log.test.ts`

- [ ] **Step 1: Write the failing trace-event persistence test**

  Create `apps/server/test/ai-op-log.test.ts` with a temporary log directory. It must prove that trace events retain their sequence and are returned with the final operation without making old operation readers see event rows as operations.

  ```ts
  import { describe, expect, it } from "vitest";
  import { mkdtempSync } from "node:fs";
  import { join } from "node:path";
  import { tmpdir } from "node:os";
  import { configureOpLog, readOpTrace, startOpRecord } from "../src/ai/aiOpLog.js";

  describe("AI operation trace log", () => {
    it("keeps ordered trace events attached to one operation", async () => {
      configureOpLog(mkdtempSync(join(tmpdir(), "rich-ai-op-log-")));
      const op = await startOpRecord({ op: "chat-stream", model: "hermes", scenario: "agent-task", prompt: "user: update plan" });
      await op.recordEvent({ type: "turn.plan", summary: "agent-task" });
      await op.recordEvent({ type: "mcp.tool", summary: "rich_project_manage completed", data: { tool: "rich_project_manage", status: "completed" } });
      await op.recordDone("Plan updated");

      await expect(readOpTrace(op.id)).resolves.toEqual([
        expect.objectContaining({ type: "turn.plan", summary: "agent-task" }),
        expect.objectContaining({ type: "mcp.tool", data: { tool: "rich_project_manage", status: "completed" } }),
      ]);
    });
  });
  ```

- [ ] **Step 2: Run the focused test and confirm the expected failure**

  Run: `pnpm --filter @ke/server test -- ai-op-log.test.ts`

  Expected: FAIL because `recordEvent` and `readOpTrace` do not exist.

- [ ] **Step 3: Extend the log contract without changing existing operation rows**

  In `apps/server/src/ai/aiOpLog.ts`, add an `AITraceEvent` type, an event-row discriminator, `OpHandle.recordEvent`, and `readOpTrace`. Trace row data must be JSON-safe, limited to 2,000 characters per summary, and must never receive the complete system prompt or tool argument body.

  ```ts
  export interface AITraceEvent {
    opId: string;
    ts: string;
    type: "turn.plan" | "adapter.selected" | "agent.started" | "mcp.tool" | "fallback" | "output" | "error";
    summary: string;
    data?: Record<string, string | number | boolean | null>;
  }

  export interface OpHandle {
    id: string;
    startedAt: number;
    recordEvent(input: Omit<AITraceEvent, "opId" | "ts">): Promise<void>;
    recordDone(output: string, sessionId?: string): Promise<void>;
    recordError(message: string): Promise<void>;
  }
  ```

  Serialize a trace row as `{ kind: "trace", ...event }`. Preserve the existing operation record shape as `{ kind: "operation", ...record }` on new writes, and make `readAllOpRecords()` accept both the old untagged rows and new `kind: "operation"` rows. `reduceToFinal()` must only receive operation rows.

- [ ] **Step 4: Run the focused test and the existing operation tests**

  Run: `pnpm --filter @ke/server test -- ai-op-log.test.ts ai-operations.test.ts`

  Expected: PASS; old structured-operation logging remains readable.

- [ ] **Step 5: Commit the isolated logging change**

  ```bash
  git add apps/server/src/ai/aiOpLog.ts apps/server/test/ai-op-log.test.ts
  git commit -m "feat(ai): record correlated operation trace events"
  ```

## Task 2: Record chat planner, Agent, MCP-progress, fallback, and reply events

**Files:**
- Modify: `apps/server/src/routes/chat.ts`
- Create: `apps/server/test/chat-observability.test.ts`

- [ ] **Step 1: Write a failing streaming-chat trace test**

  In `apps/server/test/chat-observability.test.ts`, mock an Hermes-compatible SSE response that includes a `hermes.tool.progress` event followed by a text completion. Assert the resulting chat operation trace contains the planner, adapter, tool progress, and output events in order.

  ```ts
  expect(await readOpTrace(op.id)).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "turn.plan", data: expect.objectContaining({ scenario: "agent-task" }) }),
    expect.objectContaining({ type: "adapter.selected", data: { adapter: "hermes" } }),
    expect.objectContaining({ type: "mcp.tool", data: { tool: "rich_project_manage", status: "completed" } }),
    expect.objectContaining({ type: "output" }),
  ]));
  ```

- [ ] **Step 2: Run the focused test and confirm it fails**

  Run: `pnpm --filter @ke/server test -- chat-observability.test.ts`

  Expected: FAIL because the chat route currently forwards tool progress only to the browser SSE stream.

- [ ] **Step 3: Emit trace events at the authoritative chat boundaries**

  In both `/api/chat` and `/api/chat/stream`, call `opRecorder.event` after `startOpRecord` with:

  ```ts
  { type: "turn.plan", summary: turnPlan.reason, data: { scenario: turnPlan.scenario, intent: turnPlan.intent, requiresAgent: turnPlan.requiresAgent } }
  { type: "adapter.selected", summary: `Selected ${adapter?.name ?? "hermes"}`, data: { adapter: adapter?.name ?? "hermes" } }
  ```

  Add `event` to `makeChatOpRecorder`. When parsing `hermes.tool.progress`, record only `tool` and `status`. Record `agent.started` only when `turnPlan.requiresAgent` is true. Record `fallback` before every Codex fallback path. Record `output` with the output length immediately before `done`; never duplicate the answer text in the event row because it remains in the operation record.

- [ ] **Step 4: Run the focused test plus chat history coverage**

  Run: `pnpm --filter @ke/server test -- chat-observability.test.ts history.test.ts`

  Expected: PASS; tool progress remains visible to the existing chat UI and is now queryable by operation ID.

- [ ] **Step 5: Commit the chat trace change**

  ```bash
  git add apps/server/src/routes/chat.ts apps/server/test/chat-observability.test.ts
  git commit -m "feat(chat): trace planner adapter and tool progress"
  ```

## Task 3: Record Rich MCP tool execution and correlate it with turns and tasks

**Files:**
- Modify: `apps/server/src/mcp-v2/server.ts`
- Modify: `apps/server/src/mcp-v2/transport.ts`
- Create: `apps/server/test/mcp-v2-observability.test.ts`

- [ ] **Step 1: Write a failing MCP invocation trace test**

  Build the MCP registry with a fake trace recorder, invoke a registered tool with `context: { conversationId: "chat-1", requestId: "op-1" }`, and assert the recorder receives start then completed records with no input payload.

  ```ts
  expect(events).toEqual([
    expect.objectContaining({ type: "mcp.tool", data: { phase: "started", tool: "rich_context_get_overview", requestId: "op-1", conversationId: "chat-1" } }),
    expect.objectContaining({ type: "mcp.tool", data: { phase: "completed", tool: "rich_context_get_overview", requestId: "op-1", conversationId: "chat-1", ok: true } }),
  ]);
  ```

- [ ] **Step 2: Run the focused test and confirm it fails**

  Run: `pnpm --filter @ke/server test -- mcp-v2-observability.test.ts`

  Expected: FAIL because registry invocation has no observability hook.

- [ ] **Step 3: Add a narrow MCP execution observer**

  Add an optional `onToolEvent` dependency to `BuildMcpV2Deps`; do not change any tool schema. In `buildMcpV2Server`, wrap the registered handler with two emissions. Extract correlation only from the standard optional context object.

  ```ts
  type McpToolEvent = {
    type: "mcp.tool";
    data: { phase: "started" | "completed" | "error"; tool: string; requestId?: string; conversationId?: string; ok?: boolean };
  };

  const context = input && typeof input === "object"
    ? (input as { context?: { requestId?: string; conversationId?: string } }).context
    : undefined;
  ```

  Wire the observer in `apps/server/src/index.ts` to append a standalone MCP trace record keyed by `context.requestId`. If the request ID matches an active chat operation ID, append it to that trace too. If no correlation exists, retain it as an unlinked MCP activity record for the Agent/MCP page; do not guess a conversation.

- [ ] **Step 4: Add a transport-health counter without probing writes**

  In `apps/server/src/mcp-v2/transport.ts`, introduce a small in-memory `McpTransportState` with `startedAt`, `requestsTotal`, `lastRequestAt`, `lastSuccessAt`, and `lastError`. Increment it around each `/mcp` request and expose it through `mountMcpV2` options. The admin health view will read this state; it must not make a fake JSON-RPC request.

- [ ] **Step 5: Run focused MCP regression tests**

  Run: `pnpm --filter @ke/server test -- mcp-v2-observability.test.ts mcp-v2-transport.test.ts mcp-v2-registry.test.ts`

  Expected: PASS; normal MCP responses and error envelopes are unchanged.

- [ ] **Step 6: Commit the MCP observability change**

  ```bash
  git add apps/server/src/mcp-v2/server.ts apps/server/src/mcp-v2/transport.ts apps/server/src/index.ts apps/server/test/mcp-v2-observability.test.ts
  git commit -m "feat(mcp): expose tool execution and transport health"
  ```

## Task 4: Add service-health and trace read models to the admin API

**Files:**
- Create: `apps/server/src/ai/observability.ts`
- Modify: `apps/server/src/routes/admin.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/src/mcp-v2/delegation/multica/MulticaTaskSynchronizer.ts`
- Create: `apps/server/test/admin-observability.test.ts`

- [ ] **Step 1: Write failing admin API tests**

  Cover the two new read endpoints:

  ```ts
  const health = await (await app.request("/api/admin/ai-observability/health")).json();
  expect(health.services).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "rich-server", state: "healthy" }),
    expect.objectContaining({ id: "rich-mcp", state: expect.any(String) }),
    expect.objectContaining({ id: "multica", state: expect.any(String) }),
  ]));

  const trace = await (await app.request(`/api/admin/ai-observability/traces/${op.id}`)).json();
  expect(trace).toMatchObject({ operation: expect.objectContaining({ id: op.id }), events: expect.any(Array) });
  ```

- [ ] **Step 2: Run the focused test and confirm it fails**

  Run: `pnpm --filter @ke/server test -- admin-observability.test.ts`

  Expected: FAIL with 404 because no observability routes exist.

- [ ] **Step 3: Implement pure snapshot builders in `observability.ts`**

  Define these stable response types and builders:

  ```ts
  export type ServiceState = "healthy" | "degraded" | "offline" | "not_configured";
  export interface ServiceHealth { id: string; label: string; kind: "server" | "adapter" | "mcp" | "delegation"; state: ServiceState; checkedAt: string; detail: string; latencyMs?: number; lastSuccessAt?: string; lastError?: string; }
  export interface ObservabilityDeps { adapters: AIAdapter[]; mcp: McpTransportState; multicaSync: MulticaTaskSynchronizer; tasks: PersistentTaskService; }
  ```

  Required health rules:

  - `rich-server`: always `healthy` while responding; include uptime and child-process count.
  - each adapter: time `adapter.available()`; `healthy` on true, `offline` on false, and include latency.
  - `rich-mcp`: `healthy` only when its registry has at least one tool and the last transport error is not newer than the last success; `degraded` when registered but no successful request has occurred; `offline` after a transport error with no later success.
  - `multica`: `not_configured` when the CLI discovery/version check fails with dependency-unavailable; `healthy` when the latest synchronizer pass has no failure; `degraded` when its latest sync fails or the latest successful sync is older than twice the configured interval.
  - Agent cards must derive activity from `McpTask` status and timestamps. Do not report Codex/Claude as “offline” merely because no child process exists.

  Add `lastAttemptAt`, `lastSuccessAt`, and `lastError` getters to `MulticaTaskSynchronizer`; set them once for every `syncOnce` call, including zero-task passes.

- [ ] **Step 4: Mount focused, read-only admin endpoints**

  Add exactly these routes in `apps/server/src/routes/admin.ts`:

  ```text
  GET /api/admin/ai-observability/health
  GET /api/admin/ai-observability/traces?kind=chat|workflow|delegation&limit=50
  GET /api/admin/ai-observability/traces/:id
  GET /api/admin/ai-observability/workflows
  GET /api/admin/ai-observability/delegations
  ```

  `/workflows` returns a static catalog from `AI_CONTEXT_POLICIES` plus recent operation records grouped by operation. `/delegations` returns persisted `McpTask` records, current status, review status, synchronization time, external task ID, and any linked request/conversation IDs. Continue exposing `/api/admin/engine` unchanged until the web migration is complete.

- [ ] **Step 5: Run the API and Multica tests**

  Run: `pnpm --filter @ke/server test -- admin-observability.test.ts multica-task-synchronizer.test.ts mcp-v2-tasks.test.ts`

  Expected: PASS; unavailable Multica is represented as `not_configured`, not as a server exception.

- [ ] **Step 6: Commit the server read-model change**

  ```bash
  git add apps/server/src/ai/observability.ts apps/server/src/routes/admin.ts apps/server/src/index.ts apps/server/src/mcp-v2/delegation/multica/MulticaTaskSynchronizer.ts apps/server/test/admin-observability.test.ts
  git commit -m "feat(admin): add AI service health and trace APIs"
  ```

## Task 5: Replace the engine monitor with five focused observability pages

**Files:**
- Modify: `apps/web/src/views/AdminView.tsx`
- Modify: `apps/web/src/views/AdminView.css`
- Create: `apps/web/src/views/AdminView.ai-observability.test.tsx`

- [ ] **Step 1: Write failing UI tests for page separation and trace rendering**

  Test that the AI monitor renders five page buttons, starts on service health, and that selecting a trace shows the user request, selected adapter, MCP tool name/status, tool summary, and final answer in chronological order.

  ```tsx
  expect(screen.getByRole("button", { name: "服务健康" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "对话追踪" }));
  await user.click(screen.getByRole("button", { name: "整理本周计划" }));
  expect(screen.getByText("rich_project_manage")).toBeVisible();
  expect(screen.getByText("最终回复")).toBeVisible();
  ```

- [ ] **Step 2: Run the focused test and confirm it fails**

  Run: `pnpm --filter @ke/web test -- AdminView.ai-observability.test.tsx`

  Expected: FAIL because the existing `EngineTab` is a single, repeated-card dashboard.

- [ ] **Step 3: Introduce focused subviews inside `EngineTab`**

  Replace only the contents of `EngineTab`; keep the Backstage sidebar and unrelated admin tabs intact. Add local page state with these labels and endpoint ownership:

  ```ts
  type ObservabilityPage = "health" | "traces" | "workflows" | "delegations" | "agents";
  // health      -> /ai-observability/health
  // traces      -> /ai-observability/traces and /traces/:id
  // workflows   -> /ai-observability/workflows
  // delegations -> /ai-observability/delegations
  // agents      -> health services plus active task summary
  ```

  Required presentation rules:

  - **服务健康**: one service row per Rich, adapter, Rich MCP, and Multica; state, latency, last successful probe, error detail, and “last checked.”
  - **对话追踪**: recent trace list left; selected trace timeline right. The timeline must show “用户输入 → 意图判断 → 选择模型/Agent → MCP 工具开始/完成/失败 → 最终回复/错误.” Tool summaries are collapsed by default, but tool name and status remain visible.
  - **内嵌 AI 工作流**: show catalog operation, entry API, scenario, selected adapter, context sources, MCP = “否”, and recent operation state. Never label an embedded workflow as an Agent action without trace evidence.
  - **任务委派闭环**: show Rich task ID, title, request ID, `rich_work_delegate`, Multica external task ID, assigned/executing status if known, synchronization time, review state, output references, and error.
  - **Agent 与 MCP**: show readiness/activity separately, MCP registry count/transport health, and current task count. Do not repeat workflow catalog here.

- [ ] **Step 4: Restrict automatic refresh to live data pages**

  Poll every five seconds only while `health`, `traces`, `delegations`, or `agents` is visible. `workflows` loads once and refreshes only on explicit refresh. Cancel in-flight fetches with `AbortController` when changing pages.

- [ ] **Step 5: Run focused UI verification and build**

  Run: `pnpm --filter @ke/web test -- AdminView.ai-observability.test.tsx && pnpm --filter @ke/web build`

  Expected: tests pass and Vite production build exits 0.

- [ ] **Step 6: Commit the focused UI change**

  ```bash
  git add apps/web/src/views/AdminView.tsx apps/web/src/views/AdminView.css apps/web/src/views/AdminView.ai-observability.test.tsx
  git commit -m "feat(web): redesign AI observability pages"
  ```

## Task 6: Final integration and regression verification

**Files:**
- Modify: `docs/RICH_AI_ENGINE_REFACTOR.md`

- [ ] **Step 1: Add a concise operational section**

  Add “AI Observability Center” to `docs/RICH_AI_ENGINE_REFACTOR.md` documenting the five admin views, the health-state rules, and the guarantee that trace summaries exclude full prompts/tool input payloads.

- [ ] **Step 2: Run all affected server checks**

  Run:

  ```bash
  pnpm --filter @ke/server test -- ai-op-log.test.ts chat-observability.test.ts mcp-v2-observability.test.ts admin-observability.test.ts multica-task-synchronizer.test.ts
  pnpm --filter @ke/server typecheck
  ```

  Expected: all named suites pass; server typecheck exits 0.

- [ ] **Step 3: Run web checks and manually inspect the five pages**

  Run:

  ```bash
  pnpm --filter @ke/web test -- AdminView.ai-observability.test.tsx
  pnpm --filter @ke/web build
  ```

  Then manually verify, against a local Rich server, that service health distinguishes `not_configured` from `offline`, a Hermes chat with tool events populates the trace timeline, an embedded workflow does not show MCP activity, and a Multica task shows synchronization and review state.

- [ ] **Step 4: Commit documentation and verified integration state**

  ```bash
  git add docs/RICH_AI_ENGINE_REFACTOR.md
  git commit -m "docs: document AI observability center"
  ```

## Plan self-review

- **Service health:** Task 4 adds all requested Rich, adapter, Rich MCP, and Multica status checks, distinguishing readiness from active execution.
- **Full dialogue flow:** Tasks 1–3 capture the user request boundary, plan, adapter, Hermes tool progress, MCP execution, output, error, and fallback. Task 5 renders them as a chronological trace.
- **Embedded workflow ownership:** Task 4 provides the catalog and Task 5 renders direct-model operations separately from MCP/Agent work.
- **Delegation closed loop:** Task 4 exposes persisted task, external ID, synchronization, review, and result references; Task 5 displays them in their own page.
- **No repeated dashboard information:** Task 5 assigns each concern to one focused page and limits the overview to current work.
- **Privacy:** Task 1 limits event summaries and excludes full prompts/tool input; final documentation records this guarantee.
- **Compatibility:** Existing `/api/admin/engine`, MCP responses, and chat SSE events remain intact while the new views are added.
