# Unified AI Task Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide one AI execution platform with two explicit execution modes in the existing Rich chat: persistent Hermes Agent sessions selected through `/agent`, and scenario-defined structured tasks. Deliverable tasks remain the first structured scenario and can run on Hermes or Multica with frozen context and auditable outputs.

**Architecture:** Keep Rich as the system of record. Structured work uses `mcp_tasks`, a scenario registry, and an executor-neutral dispatcher. `/agent` binds the current Rich conversation to a persistent Hermes session while reusing `chat_conversations`, `chat_messages`, and summaries; Agent policy lives in a small companion repository. An enforceable capability gateway controls filesystem, Shell, browser, network, and MCP access. Conversation content reaches Rich business data only through explicit promotion or approved save actions. See `docs/ADR-20260901-agent-conversation-and-task-modes.md` for the accepted boundaries.

**Tech Stack:** TypeScript, Hono, Zod, SQLite/Postgres-compatible repositories, Rich MCP v2, local Hermes OpenAI-compatible API, React.

## Current implementation status

The branch already implements the deliverable snapshot, Hermes and Multica executors, publication route, executor-neutral task MCP protocol, permission profiles for structured tasks, frozen prior-task history, and server integration. Tasks 1–5 below describe that delivered foundation. The next implementation checkpoint starts at Task 8; the deliverable publishing UI in Task 6 remains part of the same release.

---

### Task 1: Define the task-dispatch contract

**Files:**
- Create: `apps/server/src/ai-tasks/types.ts`
- Create: `apps/server/test/ai-tasks-types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("normalizes a Hermes deliverable task with immutable context", () => {
  const task = parseAiTaskRequest({
    projectId: "p1", deliverableId: "d1", executor: "hermes",
    instructions: "create the report", acceptanceCriteria: ["a .docx exists"],
    contextSnapshot: { version: 1, createdAt: "2026-09-01T00:00:00.000Z", deliverable: { folderPath: "07-交付/a" }, records: [], files: [] },
  });
  assert.equal(task.executor, "hermes");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ke/server exec tsx --test test/ai-tasks-types.test.ts`

Expected: failure because `parseAiTaskRequest` does not exist.

- [ ] **Step 3: Write the minimal contract**

Define `AiTaskExecutor = "hermes" | "multica"`, `AiTaskRequest`, `AiTaskContextSnapshot`, and a Zod parser. The snapshot contains project ID, deliverable ID, folder path, requirement HTML, records, files, and its creation timestamp. Do not add a database column; persist this object in `McpTask.request`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ke/server exec tsx --test test/ai-tasks-types.test.ts`

Expected: PASS.

### Task 2: Build and persist a deliverable context snapshot

**Files:**
- Create: `apps/server/src/ai-tasks/DeliverableTaskContextService.ts`
- Create: `apps/server/test/deliverable-task-context.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("snapshot contains requirements, historical records, and only files within the deliverable folder", async () => {
  const snapshot = await service.createSnapshot("project-1", "deliverable-1");
  assert.equal(snapshot.deliverable.folderPath, "07-交付/01-report");
  assert.equal(snapshot.records[0]?.text, "Use the approved template");
  assert.deepEqual(snapshot.files.map(file => file.relativePath), ["07-交付/01-report/source.xlsx"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ke/server exec tsx --test test/deliverable-task-context.test.ts`

Expected: failure because `DeliverableTaskContextService` does not exist.

- [ ] **Step 3: Write the minimal implementation**

Read the deliverable module item through `ProjectManagementRepo`, normalize its content with server-side guards, read project folder metadata from `ElementsRepo`, and create a JSON-safe snapshot. Include file metadata from the existing folder-listing code path; do not inline file bytes. Reject a task whose deliverable or configured folder is missing.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ke/server exec tsx --test test/deliverable-task-context.test.ts`

Expected: PASS.

### Task 3: Add executor abstraction and Hermes worker

**Files:**
- Create: `apps/server/src/ai-tasks/AiTaskDispatcher.ts`
- Create: `apps/server/src/ai-tasks/HermesTaskExecutor.ts`
- Create: `apps/server/test/ai-task-dispatcher.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("dispatcher creates a queued task and invokes Hermes once", async () => {
  const task = await dispatcher.publish(input);
  await dispatcher.drain();
  assert.equal(task.status, "queued");
  assert.equal(executor.calls.length, 1);
  assert.match(executor.calls[0].prompt, /rich_task_context_get/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ke/server exec tsx --test test/ai-task-dispatcher.test.ts`

Expected: failure because `AiTaskDispatcher` does not exist.

- [ ] **Step 3: Write the minimal implementation**

`publish` creates an `mcp_tasks` row before dispatch. `drain` serializes one run per task, moves status to `running`, and invokes the requested executor. Hermes sends a non-streaming request to `HERMES_BASE_URL/v1/chat/completions` with the existing local authentication header and an explicit instruction to call task-scoped MCP tools. It does not grant shell/file-system paths in the prompt. Multica delegates through the existing `WorkDelegationPort` and retains the current synchronizer.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ke/server exec tsx --test test/ai-task-dispatcher.test.ts`

Expected: PASS.

### Task 4: Add task-scoped Rich MCP tools

**Files:**
- Create: `apps/server/src/mcp-v2/scenarios/executeDeliverableTask.ts`
- Modify: `apps/server/src/mcp-v2/server.ts`
- Create: `apps/server/test/mcp-v2-deliverable-task-execution.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("Hermes can create a new version only inside its task deliverable folder", async () => {
  const response = await tools.call("rich_task_write_file", {
    taskId: task.id, relativePath: "report.md", content: "final report",
  });
  assert.equal(response.ok, true);
  assert.equal(await exists("07-交付/01-report/report.md"), true);
});

test("Hermes cannot overwrite or escape the task folder", async () => {
  await assert.rejects(() => tools.call("rich_task_write_file", {
    taskId: task.id, relativePath: "../outside.md", content: "bad",
  }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ke/server exec tsx --test test/mcp-v2-deliverable-task-execution.test.ts`

Expected: failure because the task-scoped tools are absent.

- [ ] **Step 3: Write the minimal implementation**

Register `rich_task_context_get`, `rich_task_write_file`, and `rich_task_report_result`. Validate the task executor is Hermes, the task is running, and every relative path resolves under the snapshot folder. Reject existing targets; write only text files, update the deliverable's `versions` and `fileMeta`, and append a result reference. `rich_task_report_result` stores summary/evidence and leaves the task at `succeeded` with `reviewStatus: "needs_human"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ke/server exec tsx --test test/mcp-v2-deliverable-task-execution.test.ts`

Expected: PASS.

### Task 5: Expose dispatch and availability endpoints

**Files:**
- Create: `apps/server/src/routes/aiTasks.ts`
- Modify: `apps/server/src/index.ts`
- Create: `apps/server/test/ai-tasks-routes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("publish route rejects an unavailable executor before creating a task", async () => {
  const response = await app.request("/api/ai-tasks", { method: "POST", body: JSON.stringify({ executor: "multica" }) });
  assert.equal(response.status, 409);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ke/server exec tsx --test test/ai-tasks-routes.test.ts`

Expected: failure because the route does not exist.

- [ ] **Step 3: Write the minimal implementation**

Expose `GET /api/ai-tasks/availability`, `POST /api/ai-tasks`, `GET /api/ai-tasks/:id`, and `POST /api/ai-tasks/:id/cancel`. Hermes availability checks the local models endpoint using its bearer key. Multica availability uses the existing CLI/version and project-binding checks. Publish requires explicit executor choice and returns the persisted Rich task.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ke/server exec tsx --test test/ai-tasks-routes.test.ts`

Expected: PASS.

### Task 6: Add the deliverable AI-task publishing UI

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/views/project-management/deliverables/DeliverablesModel.ts`
- Modify: `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.tsx`
- Modify: `apps/web/src/views/ProjectsView.css`
- Modify: `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("交付物记录可选择 AI 任务并显式选择 Hermes 或 Multica", () => {
  assert.match(deliverables, /AI 任务/);
  assert.match(deliverables, /Hermes/);
  assert.match(deliverables, /Multica/);
  assert.match(deliverables, /publishDeliverableAiTask/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ke/web exec tsx --test src/views/project-management/deliverables/DeliverablesWorkspace.test.ts`

Expected: failure because no AI task controls are rendered.

- [ ] **Step 3: Write the minimal implementation**

Add `ai_task` as a record kind with explicit executor select. When selected, show availability and a publish button; publish includes the record text as instructions and uses deliverable requirement records as acceptance context. Render the returned task status under the record. Do not add automatic routing or destructive file controls.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ke/web exec tsx --test src/views/project-management/deliverables/DeliverablesWorkspace.test.ts`

Expected: PASS.

### Task 7: Verify the integrated application

**Files:**
- Modify: `apps/server/test/mcp-v2-tasks.test.ts` only if a regression assertion is needed.

- [ ] **Step 1: Run focused server tests**

Run: `pnpm --filter @ke/server exec tsx --test test/ai-tasks-types.test.ts test/deliverable-task-context.test.ts test/ai-task-dispatcher.test.ts test/mcp-v2-deliverable-task-execution.test.ts test/ai-tasks-routes.test.ts`

Expected: PASS.

- [ ] **Step 2: Run affected existing tests**

Run: `pnpm --filter @ke/server exec tsx --test test/mcp-v2-tasks.test.ts test/mcp-v2-delegation.test.ts test/multica-integration.test.ts && pnpm --filter @ke/web exec tsx --test src/views/project-management/deliverables/DeliverablesWorkspace.test.ts`

Expected: PASS.

- [ ] **Step 3: Build and publish the desktop app**

Run: `pnpm --filter @ke/desktop package`

Expected: exit 0; replace `/Applications/Rich.app`, relaunch it, and perform one Hermes deliverable-task smoke test.

### Task 8: Extract a scenario registry from deliverable-specific dispatch

**Files:**
- Create: `apps/server/src/agent-scenarios/types.ts`
- Create: `apps/server/src/agent-scenarios/ScenarioRegistry.ts`
- Create: `apps/server/src/agent-scenarios/deliverableAnalysisScenario.ts`
- Modify: `apps/server/src/ai-tasks/types.ts`
- Modify: `apps/server/src/ai-tasks/AiTaskDispatcher.ts`
- Modify: `apps/server/src/routes/aiTasks.ts`
- Create: `apps/server/test/agent-scenario-registry.test.ts`

- [ ] **Step 1: Write failing registry tests**

```ts
test("the dispatcher resolves task behavior through its scenario", async () => {
  const scenario = registry.get("deliverable_analysis");
  assert.equal(scenario.id, "deliverable_analysis");
  const task = await dispatcher.publish({
    scenario: "deliverable_analysis",
    executor: "hermes",
    input: { projectId: "p1", deliverableId: "d1", instructions: "analyze" },
  });
  assert.equal(task.request.scenario, "deliverable_analysis");
});

test("an unknown scenario is rejected before a task row is created", async () => {
  await assert.rejects(() => dispatcher.publish({ scenario: "missing", executor: "hermes", input: {} }));
  assert.equal(await tasks.list({ limit: 10 }).then(rows => rows.length), 0);
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm --filter @ke/server exec tsx --test test/agent-scenario-registry.test.ts`

Expected: failure because the registry does not exist.

- [ ] **Step 3: Implement the minimal scenario contract**

Define `AgentTaskScenario` with input parsing, snapshot building, permission policy, result contract, and result validation. Register `deliverable_analysis` by adapting `DeliverableTaskContextService` and the existing deliverable result rules. Change the dispatcher to resolve scenario behavior before persisting. Keep executor selection independent of the scenario.

- [ ] **Step 4: Run focused and regression tests**

Run: `pnpm --filter @ke/server exec tsx --test test/agent-scenario-registry.test.ts test/ai-task-dispatcher.test.ts test/ai-tasks-routes.test.ts test/mcp-v2-deliverable-task-tools.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/server/src/agent-scenarios apps/server/src/ai-tasks apps/server/src/routes/aiTasks.ts apps/server/test/agent-scenario-registry.test.ts && git commit -m "refactor: route AI tasks through scenarios"`

### Task 9: Persist Agent conversation configuration

**Files:**
- Create: `apps/server/src/repos/AgentConversationConfigRepo.ts`
- Create: `apps/server/src/repos/SqliteAgentConversationConfigRepo.ts`
- Create: `apps/server/src/repos/PostgresAgentConversationConfigRepo.ts`
- Modify: `apps/server/src/db/sqlite.ts`
- Modify: `apps/server/src/db/postgres.ts`
- Create: `apps/server/test/agent-conversation-config-repo.test.ts`

- [ ] **Step 1: Write failing repository contract tests**

```ts
test("stores Agent policy separately from the conversation transcript", async () => {
  await conversations.ensureConversation({ id: "c1", surface: "agent", now });
  await configs.create({
    conversationId: "c1",
    executor: "hermes",
    permissionProfile: "chat_only",
    allowedMcpServers: [],
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  assert.equal((await configs.get("c1"))?.permissionProfile, "chat_only");
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm --filter @ke/server exec tsx --test test/agent-conversation-config-repo.test.ts`

Expected: failure because the repository and table do not exist.

- [ ] **Step 3: Add the companion table and repositories**

Create `agent_conversation_configs` keyed by `conversation_id`, with executor, permission profile, nullable canonical workspace root, allowed MCP server JSON, status, and timestamps. Use a foreign key with cascade deletion. Do not add Agent fields to `chat_messages`; the transcript remains unchanged.

- [ ] **Step 4: Test SQLite and Postgres-compatible behavior**

Run: `pnpm --filter @ke/server exec tsx --test test/agent-conversation-config-repo.test.ts && pnpm --filter @ke/server typecheck`

Expected: PASS and exit 0.

- [ ] **Step 5: Commit**

Run: `git add apps/server/src/repos apps/server/src/db apps/server/test/agent-conversation-config-repo.test.ts && git commit -m "feat: persist Agent conversation policy"`

### Task 10: Add fail-closed conversation capability enforcement

**Files:**
- Create: `apps/server/src/agent-conversations/types.ts`
- Create: `apps/server/src/agent-conversations/AgentCapabilityGateway.ts`
- Create: `apps/server/src/agent-conversations/ConversationPermissionPolicy.ts`
- Modify: `apps/server/src/ai/adapter.ts`
- Modify: `apps/server/src/ai/hermes.ts`
- Create: `apps/server/test/agent-capability-gateway.test.ts`
- Create: `apps/server/test/hermes-capability-enforcement.test.ts`

- [ ] **Step 1: Write failing denial tests**

```ts
test("chat_only denies every tool family", () => {
  const grant = gateway.issue({ conversationId: "c1", turnId: "t1", profile: "chat_only" });
  assert.equal(gateway.authorize(grant, { family: "filesystem", action: "read" }).allowed, false);
  assert.equal(gateway.authorize(grant, { family: "mcp", action: "rich.project.update" }).allowed, false);
});

test("a runtime that cannot enforce a profile cannot start that turn", async () => {
  await assert.rejects(
    () => runtime.startTurn({ profile: "workspace_agent", workspaceRoot: workspace }),
    /capability profile unavailable/i,
  );
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm --filter @ke/server exec tsx --test test/agent-capability-gateway.test.ts test/hermes-capability-enforcement.test.ts`

Expected: failure because capability grants and runtime enforcement are absent.

- [ ] **Step 3: Implement turn-scoped grants**

Create signed, in-memory grants bound to a conversation ID, turn ID, canonical workspace root, allowed tool families, allowed MCP servers, and a short expiry. Reject path traversal after resolving real paths. Mark destructive filesystem actions, out-of-workspace access, system installation, Git push/deploy, external side effects, and Rich business writes as approval-required.

- [ ] **Step 4: Extend the runtime contract and probe Hermes**

Add an explicit runtime capability descriptor rather than overloading prompts:

```ts
export interface AgentRuntimeCapabilities {
  profiles: AgentPermissionProfile[];
  enforcesToolSelection: boolean;
  enforcesWorkspaceRoot: boolean;
}
```

The Hermes adapter reports only profiles it can enforce through its API/configuration. Until per-session native-tool and workspace restriction are both verified, expose only `chat_only`. Never report a broader profile based on a system prompt.

- [ ] **Step 5: Run security-focused tests**

Run: `pnpm --filter @ke/server exec tsx --test test/agent-capability-gateway.test.ts test/hermes-capability-enforcement.test.ts`

Expected: PASS, including traversal, expiry, cross-turn replay, and unsupported-profile cases.

- [ ] **Step 6: Commit**

Run: `git add apps/server/src/agent-conversations apps/server/src/ai apps/server/test/agent-capability-gateway.test.ts apps/server/test/hermes-capability-enforcement.test.ts && git commit -m "feat: enforce Agent conversation capabilities"`

### Task 11: Implement persistent Hermes Agent sessions

**Files:**
- Create: `apps/server/src/agent-conversations/AgentRuntimePort.ts`
- Create: `apps/server/src/agent-conversations/AgentConversationService.ts`
- Create: `apps/server/src/agent-conversations/ConversationTurnLock.ts`
- Modify: `apps/server/src/routes/chat.ts`
- Modify: `apps/server/src/index.ts`
- Create: `apps/server/test/agent-conversation-service.test.ts`
- Create: `apps/server/test/chat-agent-session-routes.test.ts`

- [ ] **Step 1: Write failing lifecycle tests**

```ts
test("continues Hermes with the latest stored session", async () => {
  await service.sendMessage("c1", { content: "first" });
  await service.sendMessage("c1", { content: "continue" });
  assert.equal(runtime.calls[1].sessionId, "hermes-session-1");
});

test("serializes turns in the same conversation", async () => {
  const first = service.sendMessage("c1", { content: "one" });
  await assert.rejects(() => service.sendMessage("c1", { content: "two" }), /turn already running/i);
  await first;
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm --filter @ke/server exec tsx --test test/agent-conversation-service.test.ts test/chat-agent-session-routes.test.ts`

Expected: failure because the service and routes do not exist.

- [ ] **Step 3: Implement the conversation service**

Reuse `ChatConversationsRepo`, `ChatMessageRecord.modelSessionId`, and the existing context summary provider. Create Hermes conversations with `chat_only` by default. For each turn, persist the user message, acquire a per-conversation lock, issue a capability grant, resume the latest Hermes session, stream typed runtime events, and persist the assistant result. If Hermes rejects a stale session, retry once in a new session using the Rich summary and recent transcript.

- [ ] **Step 4: Expose explicit Agent routes**

Extend the existing chat routes with start/resume/new/exit/status Agent-session endpoints under `/api/chat/conversations/:id/agent-session`. Keep `/api/chat/stream` as the message stream. When the stored conversation mode is `agent_session`, resolve and pass the latest Hermes `session_id`, emit `turn`, `tool`, `approval_required`, `delta`, `done`, and `error` events, and bypass `planTurn`. Do not silently fall back to Codex because executor identity and permissions must remain stable.

- [ ] **Step 5: Run focused and existing chat tests**

Run: `pnpm --filter @ke/server exec tsx --test test/agent-conversation-service.test.ts test/chat-agent-session-routes.test.ts test/chat-observability.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add apps/server/src/agent-conversations apps/server/src/routes/chat.ts apps/server/src/index.ts apps/server/test/agent-conversation-service.test.ts apps/server/test/chat-agent-session-routes.test.ts && git commit -m "feat: add persistent Hermes chat sessions"`

### Task 12: Add approval handling and broader Agent profiles

**Files:**
- Create: `apps/server/src/agent-conversations/AgentApprovalService.ts`
- Modify: `apps/server/src/agent-conversations/AgentConversationService.ts`
- Modify: `apps/server/src/routes/chat.ts`
- Create: `apps/server/test/agent-conversation-approvals.test.ts`

- [ ] **Step 1: Write failing approval tests**

```ts
test("a risky action pauses until the exact action is approved", async () => {
  const event = await nextEvent(service.sendMessage("c1", { content: "push this branch" }), "approval_required");
  assert.equal(event.action.family, "git_remote");
  await service.approve("c1", event.approvalId, { approved: true });
  assert.equal(runtime.executedActions.length, 1);
});

test("approval cannot be reused by another turn", async () => {
  await assert.rejects(() => service.approve("c1", approvalIdFromOtherTurn, { approved: true }));
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm --filter @ke/server exec tsx --test test/agent-conversation-approvals.test.ts`

Expected: failure because approvals are not modeled.

- [ ] **Step 3: Implement exact-action approvals**

Persist pending approval metadata with conversation ID, turn ID, tool name, normalized arguments digest, expiry, and decision. Add approve/deny routes. Resume only the paused action that matches the digest; a changed action requires new approval.

- [ ] **Step 4: Enable broader profiles only when enforcement is available**

Expose `workspace_agent` after Hermes demonstrates tool selection and canonical workspace enforcement. Expose `extended_agent` only after browser/network and selected MCP restrictions also pass integration tests. Keep unsupported profiles visible as unavailable with a reason.

- [ ] **Step 5: Run approval and capability tests**

Run: `pnpm --filter @ke/server exec tsx --test test/agent-conversation-approvals.test.ts test/agent-capability-gateway.test.ts test/hermes-capability-enforcement.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add apps/server/src/agent-conversations apps/server/src/routes/chat.ts apps/server/test/agent-conversation-approvals.test.ts && git commit -m "feat: approve risky Agent actions"`

### Task 13: Convert a conversation into a structured task

**Files:**
- Create: `apps/server/src/agent-conversations/ConversationPromotionService.ts`
- Modify: `apps/server/src/routes/chat.ts`
- Create: `apps/server/test/agent-conversation-promotion.test.ts`

- [ ] **Step 1: Write failing promotion tests**

```ts
test("promotion freezes selected conversation evidence into a scenario task", async () => {
  const preview = await promotion.preview({
    conversationId: "c1",
    scenario: "deliverable_analysis",
    target: { projectId: "p1", deliverableId: "d1" },
    selectedMessageIds: ["m1", "m4"],
    instructions: "produce the reviewed report",
  });
  const task = await promotion.publish(preview.confirmationToken);
  assert.deepEqual(task.request.promotion.selectedMessageIds, ["m1", "m4"]);
  assert.equal(task.request.contextSnapshot.sourceConversationId, "c1");
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm --filter @ke/server exec tsx --test test/agent-conversation-promotion.test.ts`

Expected: failure because promotion is absent.

- [ ] **Step 3: Implement preview and confirmed publication**

Build an immutable promotion snapshot from the conversation summary, selected message IDs and contents, attachment references, selected workspace artifacts, and the user's current goal. Validate the target and inputs through `ScenarioRegistry`, show the exact snapshot in preview, and publish through `AiTaskDispatcher` only after confirmation. Do not copy the entire transcript unless the user explicitly selected all messages.

- [ ] **Step 4: Add save-to-Rich as a separate approved scenario action**

The route accepts an exact destination and content preview. Reuse scenario-scoped Rich tools for the write and record its approval. Do not give general conversation turns direct business-write tools.

- [ ] **Step 5: Run promotion and dispatcher regressions**

Run: `pnpm --filter @ke/server exec tsx --test test/agent-conversation-promotion.test.ts test/agent-scenario-registry.test.ts test/ai-task-dispatcher.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add apps/server/src/agent-conversations apps/server/src/routes/chat.ts apps/server/test/agent-conversation-promotion.test.ts && git commit -m "feat: promote Agent conversations to tasks"`

### Task 14: Add Agent sessions to the existing Rich chat

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Create: `apps/web/src/lib/chatSlashCommands.ts`
- Create: `apps/web/src/components/ChatSlashCommandMenu.tsx`
- Create: `apps/web/src/components/ChatSlashCommandMenu.css`
- Modify: `apps/web/src/views/HomeView.tsx`
- Modify: `apps/web/src/views/ChatOverlay.tsx`
- Modify: `apps/web/src/views/ChatOverlay.css`
- Create: `apps/web/src/components/ChatSlashCommandMenu.test.ts`
- Create: `apps/web/src/views/HomeAgentSession.test.ts`

- [ ] **Step 1: Write failing UI contract tests**

```ts
test("typing slash exposes the shared Rich conversation modes", () => {
  assert.deepEqual(commandIds, ["chat", "agent", "task", "find"]);
  assert.equal(parseChatSlashCommand("/agent").command, "agent");
  assert.equal(parseChatSlashCommand("/agent new").argument, "new");
});

test("selecting agent starts a session and does not send the command as prose", async () => {
  await chooseCommand("agent");
  assert.equal(api.startedSessions.length, 1);
  assert.equal(api.sentMessages.some(message => message.content === "/agent"), false);
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm --filter @ke/web exec tsx --test src/components/ChatSlashCommandMenu.test.ts src/views/HomeAgentSession.test.ts`

Expected: failure because the shared menu and Agent-session state do not exist.

- [ ] **Step 3: Implement conversation navigation and composer**

Extract the existing `/find` parsing and panel from `ChatOverlay.tsx` into shared components. Typing `/` in the homepage or global overlay shows `/chat`, `/agent`, `/task`, and `/find`, supports arrow keys, Enter, Escape, mouse selection, command filtering, and IME composition. `/agent` starts or resumes a session; `/agent new` starts a fresh Hermes session; `/chat` exits Agent mode; `/task` opens structured-task target selection. Commands are consumed by Rich and are never sent as model prose.

- [ ] **Step 4: Implement promotion and save previews**

Show a compact Agent-session marker in the existing composer with Hermes status, workspace, permission profile, and an exit action. Continue rendering typed tool calls and approval requests inline with the assistant turn. “转为任务” asks for scenario, target, selected messages/artifacts, instructions, and acceptance criteria, then shows the frozen preview before publication.

- [ ] **Step 5: Run UI tests and typecheck**

Run: `pnpm --filter @ke/web exec tsx --test src/components/ChatSlashCommandMenu.test.ts src/views/HomeAgentSession.test.ts && pnpm --filter @ke/web typecheck`

Expected: PASS and exit 0.

- [ ] **Step 6: Commit**

Run: `git add apps/web/src/api/client.ts apps/web/src/lib/chatSlashCommands.ts apps/web/src/components/ChatSlashCommandMenu.tsx apps/web/src/components/ChatSlashCommandMenu.css apps/web/src/views/HomeView.tsx apps/web/src/views/ChatOverlay.tsx apps/web/src/views/ChatOverlay.css apps/web/src/components/ChatSlashCommandMenu.test.ts apps/web/src/views/HomeAgentSession.test.ts && git commit -m "feat: start Hermes sessions from Rich chat"`

### Task 15: End-to-end verification and release

**Files:**
- Create: `apps/server/test/agent-conversation-e2e.test.ts`
- Modify: `docs/RICH_MCP_V2_CATALOG.md`
- Modify: `docs/DEPLOYMENT.md`

- [ ] **Step 1: Verify the two modes remain isolated**

Run: `pnpm --filter @ke/server exec tsx --test test/agent-conversation-e2e.test.ts test/agent-conversation-promotion.test.ts test/mcp-v2-deliverable-task-tools.test.ts`

Expected: `/agent` starts and resumes the same Hermes session; `chat_only` cannot call tools; no business data changes before confirmed promotion; the promoted task uses the normal task lifecycle.

- [ ] **Step 2: Run affected server and web suites**

Run: `pnpm --filter @ke/server test && pnpm --filter @ke/server typecheck && pnpm --filter @ke/web exec tsx --test src/components/ChatSlashCommandMenu.test.ts src/views/HomeAgentSession.test.ts src/views/project-management/deliverables/DeliverablesWorkspace.test.ts && pnpm --filter @ke/web typecheck`

Expected: PASS and exit 0.

- [ ] **Step 3: Perform local runtime smoke tests**

Start Rich and Hermes, then verify: restart recovery of a conversation; stale Hermes session recovery; simultaneous-turn rejection; unavailable permission profile reason; approval denial and approval expiry; conversation-to-deliverable-task promotion; Hermes and Multica structured task completion.

- [ ] **Step 4: Update operator documentation**

Document the capability matrix, Hermes enforcement prerequisites, environment variables, approval audit trail, session recovery behavior, and failure diagnostics. State clearly that prompt instructions do not grant or restrict capabilities.

- [ ] **Step 5: Package and publish the desktop app**

Run: `pnpm --filter @ke/desktop package`

Expected: exit 0; replace `/Applications/Rich.app`, relaunch it, and repeat one `chat_only` conversation and one promoted deliverable task.

- [ ] **Step 6: Commit**

Run: `git add apps/server/test/agent-conversation-e2e.test.ts docs/RICH_MCP_V2_CATALOG.md docs/DEPLOYMENT.md && git commit -m "test: verify unified Agent interaction modes"`
