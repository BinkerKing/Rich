# Unified AI Task Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a deliverable record to publish a persistent AI task explicitly to Hermes or Multica, with a frozen project/deliverable context and auditable output files.

**Architecture:** Keep Rich as the system of record by reusing `mcp_tasks`; add a dispatcher that selects an executor and owns retries/status. The Hermes executor sends a task-scoped prompt to the local Gateway; Hermes uses new task-scoped Rich MCP tools to read the frozen context and create only new deliverable files/versions. Multica retains the existing external-adapter flow behind the same executor interface.

**Tech Stack:** TypeScript, Hono, Zod, SQLite/Postgres-compatible repositories, Rich MCP v2, local Hermes OpenAI-compatible API, React.

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
