# Deliverable AI Task Result Thread Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist each completed deliverable AI task as a visible, reviewable result reply under its originating task record, with optional detailed Markdown stored in that deliverable’s directory.

**Architecture:** The browser creates a publishing parent record before dispatching and persists its ID as `originRecordId` on the AI task request. A server-side projection binds that record to the new task before it executes; `rich_task_report_result` then validates and completes the task, writes optional Markdown beneath the frozen deliverable folder, and upserts one child result record. The workspace normalizes and groups the new record type immediately after its parent task, while reusing the existing file-open action for report links.

**Tech Stack:** TypeScript, React, Node.js `fs/promises`, Zod, Vitest, node:test, existing project-management repository and deliverable file actions.

---

## File map

- `apps/server/src/ai-tasks/types.ts` — task-request contract, including `originRecordId`.
- `apps/server/src/ai-tasks/DeliverableTaskResultProjection.ts` — bind the published task to its parent record and upsert a completed result reply.
- `apps/server/src/ai-tasks/AiTaskDispatcher.ts` — invoke the parent-record binding before any task is drained.
- `apps/server/src/mcp-v2/server.ts` — pass the project-management repository to deliverable task tools.
- `apps/server/src/mcp-v2/tasks/deliverableTaskTools.ts` — result-report input, confined Markdown write, and idempotent child-record upsert.
- `apps/server/test/ai-task-dispatcher.test.ts` — dispatcher test for binding a parent record before execution.
- `apps/server/test/mcp-v2-deliverable-task-tools.test.ts` — server tests for report persistence, idempotency, and path confinement.
- `apps/web/src/views/project-management/deliverables/DeliverablesModel.ts` — new record type and parsing/grouping helpers.
- `apps/web/src/views/project-management/deliverables/DeliverablesModel.test.ts` — model tests for backward compatibility and task-result grouping.
- `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.tsx` — create parent record before dispatch; render result replies and Markdown links.
- `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.test.ts` — source-level UI contract assertions.
- `apps/web/src/views/ProjectsView.css` — compact nested result-reply layout and responsive action wrapping.

### Task 1: Define the parent-child record and request contracts

**Files:**
- Modify: `apps/server/src/ai-tasks/types.ts`
- Modify: `apps/web/src/views/project-management/deliverables/DeliverablesModel.ts`
- Test: `apps/web/src/views/project-management/deliverables/DeliverablesModel.test.ts`

- [ ] **Step 1: Add failing normalization and grouping tests**

Add a test that normalizes `ai_task_result` records with `parentRecordId`, `aiTaskResult`, report attachment, and evidence attachments; add another that feeds a result before its parent and asserts the grouping helper returns parent followed by result. Keep a legacy `ai_task` record in the fixture and assert it remains unchanged.

```ts
const content = normalizeDeliverableContent({ records: [
  { id: "r", kind: "ai_task_result", parentRecordId: "t", text: "摘要", createdAt: "2026-09-02T10:01:00.000Z", aiTaskResult: { taskId: "task-1", status: "needs_human", executor: "hermes", completedAt: "2026-09-02T10:01:00.000Z", evidence: [] } },
  { id: "t", kind: "ai_task", text: "核对", createdAt: "2026-09-02T10:00:00.000Z", aiTask: { id: "task-1", status: "succeeded", executor: "hermes" } },
] });
assert.deepEqual(orderDeliverableRecords(content.records).map(record => record.id), ["t", "r"]);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm --filter web test -- DeliverablesModel.test.ts`

Expected: FAIL because `ai_task_result` is discarded and `orderDeliverableRecords` does not exist.

- [ ] **Step 3: Implement the minimal shared types and parser**

In `DeliverablesModel.ts`:

```ts
export type DeliverableRecordKind = /* existing */ | "ai_task_result";
export type DeliverableTaskResult = {
  taskId: string;
  status: "needs_human" | "archive_failed";
  executor: "hermes" | "multica";
  completedAt: string;
  report?: DeliverableRecordAttachment;
  evidence: DeliverableRecordAttachment[];
};
```

Parse `parentRecordId` only for a valid `ai_task_result`; parse report/evidence with the same strict attachment shape used by `attachments`; leave invalid optional metadata absent. Add `orderDeliverableRecords(records)` that emits every normal record in chronological order and inserts each valid child immediately after its parent. Orphaned child records remain visible at their chronological position.

In `types.ts`, add `originRecordId: z.string().min(1).optional()` beside `deliverableId` so existing persisted task requests remain readable.

- [ ] **Step 4: Run focused tests and type-check**

Run: `pnpm --filter web test -- DeliverablesModel.test.ts && pnpm --filter server typecheck && pnpm --filter web typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the contract**

```bash
git add apps/server/src/ai-tasks/types.ts apps/web/src/views/project-management/deliverables/DeliverablesModel.ts apps/web/src/views/project-management/deliverables/DeliverablesModel.test.ts
git commit -m "feat: model deliverable AI task result replies"
```

### Task 2: Bind published tasks and persist result replies

**Files:**
- Modify: `apps/server/src/mcp-v2/server.ts`
- Create: `apps/server/src/ai-tasks/DeliverableTaskResultProjection.ts`
- Modify: `apps/server/src/ai-tasks/AiTaskDispatcher.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/src/mcp-v2/tasks/deliverableTaskTools.ts`
- Test: `apps/server/test/ai-task-dispatcher.test.ts`
- Test: `apps/server/test/mcp-v2-deliverable-task-tools.test.ts`

- [ ] **Step 1: Add failing report-persistence tests**

Extend the in-memory test setup with a `ProjectManagementRepo` stub exposing `listAllModuleItems` and `updateModuleItem`, and make the project element’s `localFolder` a temporary directory. Create a request with `originRecordId: "task-record"` and a matching deliverable item whose `task-record` has kind `ai_task` and a `publishing` status.

Add tests that assert:

```ts
await registry.invoke("rich_task_report_result", {
  taskId: task.id,
  summary: "发现两项遗漏",
  evidence: ["source.xlsx"],
  reportMarkdown: "# 完整分析\n\n内容",
});
expect(updated.content.records).toEqual(expect.arrayContaining([
  expect.objectContaining({ kind: "ai_task_result", parentRecordId: "task-record", text: "发现两项遗漏" }),
]));
await expect(readFile(join(folder, "07-交付/report/AI任务结果/20260902-Report-" + task.id.slice(0, 8) + ".md"), "utf8")).resolves.toContain("完整分析");
```

Call the tool again with the same task and assert exactly one result record exists. Add a no-report case that asserts no `AI任务结果` directory is created. Add an invalid `originRecordId` case that produces a diagnostic error rather than updating another item.

- [ ] **Step 2: Run the focused server test and verify it fails**

Run: `pnpm --filter server test -- mcp-v2-deliverable-task-tools.test.ts`

Expected: FAIL because report input, repository wiring, and child record upsert are absent.

- [ ] **Step 3: Add project-management dependency wiring**

Create `DeliverableTaskResultProjection` with `bindPublishedTask(task)` and `report(task, input)`. Its dependencies are narrow `ProjectManagementRepo` and `ElementsRepo` picks. `bindPublishedTask` locates only the requested deliverable and replaces the parent `aiTask` metadata with `{ id: task.id, status: task.status, executor: request.executor }`; it must throw when the `originRecordId` does not name an `ai_task` record. Call it inside `AiTaskDispatcher.publish` after `tasks.create` and before returning the task. The dispatcher constructor accepts an optional projection so existing task-dispatcher tests remain valid.

Change the MCP registration signature to accept the projection:

```ts
projection?: DeliverableTaskResultProjection,
```

and call it from `buildMcpV2Registry`:

```ts
registerDeliverableTaskTools(registry, tasks, projection);
```

Build one projection in `index.ts` and pass it to both the dispatcher and MCP registry through the corresponding dependency wiring. Existing MCP tests without the projection must still support task history and result reporting, but cannot request delivery-record projection.

- [ ] **Step 4: Extend the result tool input and implement constrained persistence**

Use this input shape:

```ts
z.object({
  taskId: z.string().min(1),
  summary: z.string().trim().min(1).max(2_000),
  evidence: z.array(z.string().trim().min(1).max(1_000)).max(50).default([]),
  reportMarkdown: z.string().trim().min(1).max(100_000).optional(),
})
```

After `assertAgentTask`, require `originRecordId` and the projection. The projection locates only `request.deliverableId` in `listAllModuleItems(projectId, "deliverables")`, verifies the parent record is kind `ai_task` and has the matching bound task ID, then constructs one result record. Locate an existing `ai_task_result` by `aiTaskResult.taskId === task.id` and replace it; otherwise append it.

For non-empty `reportMarkdown`, derive the path solely from `request.contextSnapshot.deliverable.folderPath`:

```ts
const folder = resolveProjectRelative(localFolder, request.contextSnapshot.deliverable.folderPath);
const filename = `${dateStamp(completedAt)}-${safeFilename(task.title)}-${task.id.slice(0, 8)}.md`;
const reportPath = resolveProjectRelative(localFolder, `${request.contextSnapshot.deliverable.folderPath}/AI任务结果/${filename}`);
```

Implement `resolveProjectRelative(root, relativePath)` with `resolve(root, normalized)` and a prefix check against `resolve(root) + sep`; reject `..`, empty targets, and targets outside root. Use `mkdir(dirname(reportPath), { recursive: true })` and `writeFile(reportPath, reportMarkdown, "utf8")`. Persist a report attachment whose `relativePath` is relative to `localFolder` and whose size is `Buffer.byteLength(reportMarkdown)`.

Transition the task only after the report write and record update succeed. If report write fails, transition to `succeeded` with `reviewStatus: "needs_human"`, create/update a result record with `status: "archive_failed"` and a short explicit failure summary, then return a successful task result so the user can see the conclusion. Do not expose raw local paths in that summary.

- [ ] **Step 5: Update executor prompts**

In the Hermes and Multica deliverable task instructions, require `rich_task_report_result` before ending and tell the Agent to supply `reportMarkdown` whenever its result contains a table, multiple findings, evidence mapping, or more than a short conclusion. Do not let either executor select a filesystem destination.

- [ ] **Step 6: Run the server verification**

Run: `pnpm --filter server test -- mcp-v2-deliverable-task-tools.test.ts && pnpm --filter server typecheck`

Expected: PASS, including repeat reporting and confined report path tests.

- [ ] **Step 7: Commit server result persistence**

```bash
git add apps/server/src/ai-tasks/DeliverableTaskResultProjection.ts apps/server/src/ai-tasks/AiTaskDispatcher.ts apps/server/src/index.ts apps/server/src/mcp-v2/server.ts apps/server/src/mcp-v2/tasks/deliverableTaskTools.ts apps/server/src/ai-tasks/HermesTaskExecutor.ts apps/server/src/ai-tasks/MulticaTaskExecutor.ts apps/server/test/ai-task-dispatcher.test.ts apps/server/test/mcp-v2-deliverable-task-tools.test.ts
git commit -m "feat: persist deliverable AI task results"
```

### Task 3: Create the parent record before task dispatch

**Files:**
- Modify: `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.tsx`
- Test: `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.test.ts`

- [ ] **Step 1: Add a source-level test for stable task-record linkage**

Assert the workspace creates `const originRecordId = crypto.randomUUID()` before `api.publishDeliverableAiTask`, saves a `publishing` `ai_task` record first, and includes `originRecordId` in the publish input. Also assert a publish failure replaces only this record’s status with `failed`, rather than deleting unrelated data.

- [ ] **Step 2: Run the UI contract test and verify it fails**

Run: `pnpm --filter web test -- DeliverablesWorkspace.test.ts`

Expected: FAIL because dispatch currently happens before the record is saved.

- [ ] **Step 3: Implement the minimal dispatch order**

Replace the current publish-first flow with:

```ts
const originRecordId = crypto.randomUUID();
const createdAt = new Date().toISOString();
const parent = { id: originRecordId, kind: "ai_task" as const, text: text.trim(), createdAt, informationType: "information" as const, attachments: [], aiTask: { id: "", status: "publishing", executor: aiExecutor } };
await save(item, addDeliverableRecord(item.content, parent));
const task = await api.publishDeliverableAiTask({ /* existing input */, originRecordId });
```

The server binds the real task ID before it starts execution, so the browser must not issue a second content update after publish. If dispatch fails, refresh the deliverable and replace only the still-`publishing` parent record with `failed`; retain its task text and show the existing workspace error message.

- [ ] **Step 4: Run UI contract and type checks**

Run: `pnpm --filter web test -- DeliverablesWorkspace.test.ts && pnpm --filter web typecheck`

Expected: PASS.

- [ ] **Step 5: Commit task linkage**

```bash
git add apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.tsx apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.test.ts
git commit -m "feat: link deliverable tasks to source records"
```

### Task 4: Render result replies as nested task-thread entries

**Files:**
- Modify: `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.tsx`
- Modify: `apps/web/src/views/ProjectsView.css`
- Test: `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.test.ts`

- [ ] **Step 1: Add failing UI contract assertions**

Add expectations for `orderDeliverableRecords(item.content.records)`, an `AI 回复` label, a `待复核` label, `record.aiTaskResult?.report`, `deliverableFileAction(projectId, "open", ...)`, and the CSS selector `.deliverables-workspace__record.is-ai_task_result`.

- [ ] **Step 2: Run the focused UI test and verify it fails**

Run: `pnpm --filter web test -- DeliverablesWorkspace.test.ts`

Expected: FAIL because results are neither grouped nor rendered.

- [ ] **Step 3: Implement result rendering**

Render `orderDeliverableRecords(item.content.records)`. For `ai_task_result`:

```tsx
<b>AI 回复</b>
<div className="deliverables-workspace__record-content">{record.text}</div>
<aside className="deliverables-workspace__record-actions">
  <small className="deliverables-workspace__record-ai-result">{record.aiTaskResult?.executor === "hermes" ? "Hermes" : "Multica"} · {record.aiTaskResult?.status === "archive_failed" ? "归档失败" : "待复核"}</small>
  <time>{fileDate(record.aiTaskResult?.completedAt || record.createdAt)}</time>
</aside>
```

Render report and evidence as attachment-style buttons. On click, call the existing `api.deliverableFileAction(projectId, "open", relativePath)`. Do not make result records editable or deletable in this release; the task audit and future review actions remain authoritative.

- [ ] **Step 4: Add focused nested layout styles**

Add a left thread border and indentation only to `.deliverables-workspace__record.is-ai_task_result`, with a compact green result label. Make its action column wrap below the summary at widths below 900px. Preserve the existing parent task action layout and do not alter generic record spacing.

- [ ] **Step 5: Run frontend verification**

Run: `pnpm --filter web test -- DeliverablesWorkspace.test.ts DeliverablesModel.test.ts && pnpm --filter web typecheck`

Expected: PASS.

- [ ] **Step 6: Commit task-thread UI**

```bash
git add apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.tsx apps/web/src/views/ProjectsView.css apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.test.ts
git commit -m "feat: display deliverable AI result threads"
```

### Task 5: End-to-end regression verification and desktop deployment

**Files:**
- Modify only if verification exposes a defect in the files above.

- [ ] **Step 1: Run focused backend and frontend suites**

Run:

```bash
pnpm --filter server test -- mcp-v2-deliverable-task-tools.test.ts
pnpm --filter web test -- DeliverablesModel.test.ts DeliverablesWorkspace.test.ts
pnpm --filter server typecheck
pnpm --filter web typecheck
```

Expected: all commands PASS. If the full server suite fails on the known `better-sqlite3` Node ABI mismatch, report it separately and do not mask it as a feature failure.

- [ ] **Step 2: Run the production build**

Run the repository’s established desktop packaging command, verify it succeeds, then replace `/Applications/Rich.app` using the project’s existing safe backup/deployment procedure.

Expected: packaged application starts and the health endpoint responds.

- [ ] **Step 3: Manually verify the user flow**

In a temporary or test deliverable:

1. create an AI task and confirm the parent record appears with a real task ID;
2. report a result with `summary`, evidence, and `reportMarkdown`;
3. reopen the deliverable and confirm the nested `AI 回复`, `待复核` state, completion time, and report link;
4. click the report link and confirm it opens under `<deliverable>/AI任务结果/`;
5. report the same task again and confirm only one reply exists.

- [ ] **Step 4: Commit verification-only fixes if needed**

If verification changes a source or test file, stage those exact changed files and commit them as `fix: verify deliverable AI result threads`. Do not create an empty commit when no verification fix is required.
