# Deliverable Codex Conversation Workbench Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a persistent, multi-tab Codex conversation workbench to each deliverable, with immutable free/task/bug modes and a Rich-window `⌘ Space` toggle.

**Architecture:** Persist page-scoped workbench metadata separately from the existing transcript tables, then use the existing `AgentConversationService` for durable turns while a new `CodexAppServerRuntime` speaks JSONL JSON-RPC to a local `codex app-server` process. A deliverable route validates scope and constructs the mode-specific context; the web workbench owns tab selection, archive, streaming chat, and the global in-window shortcut.

**Tech Stack:** TypeScript, React 18, Hono SSE, SQLite/PostgreSQL, Vitest, Codex CLI App Server (stdio JSON-RPC), existing Rich MCP v2 and deliverable result projection.

---

## Preconditions and boundaries

- Work in a dedicated `codex/` worktree before executing this plan.
- Do not alter the global home-chat `/agent` behavior in this change. The workbench is a deliverable-only surface.
- `⌘ Space` is captured only while the Rich window/tab is focused. Do not register an OS-global shortcut and do not attempt to disable macOS Spotlight.
- First release executor is always `codex`; retain an executor field in persistence but do not render an Agent selector.
- Free and bug modes are conversations only. They must never expose a Rich writeback MCP tool.
- Task mode is also a conversation: it may write only after the user explicitly requests it in natural language. Do not create a task or result merely when a turn completes.

### Task 1: Add page-scoped conversation persistence

**Files:**
- Modify: `apps/server/src/db/sqlite.ts`
- Modify: `apps/server/src/db/postgres.ts`
- Create: `apps/server/src/repos/DeliverableCodexConversationRepo.ts`
- Create: `apps/server/src/repos/SqliteDeliverableCodexConversationRepo.ts`
- Create: `apps/server/src/repos/PostgresDeliverableCodexConversationRepo.ts`
- Test: `apps/server/test/deliverable-codex-conversation-repo.test.ts`

**Step 1: Write SQLite repository tests first.**

Cover creation of two conversations with the same `scopeKey`, ordering by `lastActiveAt DESC`, activation updating only the selected row, and archive excluding only that row from the active list. Assert all stored fields are stable:

```ts
expect(await repo.listActive("deliverable:p1:d1")).toMatchObject([
  { id: "c2", mode: "bug", executor: "codex", status: "active" },
  { id: "c1", mode: "task", executor: "codex", status: "active" },
]);
```

**Step 2: Run the focused test and verify it fails.**

Run: `pnpm --filter server test -- deliverable-codex-conversation-repo.test.ts`

Expected: FAIL because the repository and table do not exist.

**Step 3: Define the repository contract.**

Create the shared types and methods below; keep the transcript in existing `chat_conversations`/`chat_messages` rather than duplicating it.

```ts
export type DeliverableCodexMode = "free" | "task" | "bug";
export type DeliverableCodexConversationStatus = "active" | "archived";

export interface DeliverableCodexConversation {
  id: string;
  conversationId: string;
  scopeKey: string;
  projectId: string;
  deliverableId: string;
  title: string;
  mode: DeliverableCodexMode;
  executor: "codex";
  codexThreadId?: string;
  status: DeliverableCodexConversationStatus;
  contextVersion?: string;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
}

export interface DeliverableCodexConversationRepo {
  create(value: DeliverableCodexConversation): Promise<void>;
  get(id: string): Promise<DeliverableCodexConversation | null>;
  listActive(scopeKey: string): Promise<DeliverableCodexConversation[]>;
  touch(id: string, at: string): Promise<DeliverableCodexConversation | null>;
  archive(id: string, at: string): Promise<DeliverableCodexConversation | null>;
  setCodexThread(id: string, threadId: string | undefined, contextVersion: string | undefined, at: string): Promise<void>;
}
```

Add `deliverable_codex_conversations` in both schema initializers with a unique `conversation_id`, foreign key to `chat_conversations`, and index `(scope_key, status, last_active_at DESC)`. Implement equivalent SQLite and PostgreSQL SQL; PostgreSQL may use `ON CONFLICT` only where a real conflict is intended.

**Step 4: Run focused tests and typecheck.**

Run: `pnpm --filter server test -- deliverable-codex-conversation-repo.test.ts && pnpm --filter server typecheck`

Expected: PASS.

**Step 5: Commit.**

```bash
git add apps/server/src/db/sqlite.ts apps/server/src/db/postgres.ts apps/server/src/repos/DeliverableCodexConversationRepo.ts apps/server/src/repos/SqliteDeliverableCodexConversationRepo.ts apps/server/src/repos/PostgresDeliverableCodexConversationRepo.ts apps/server/test/deliverable-codex-conversation-repo.test.ts
git commit -m "feat: persist deliverable codex conversations"
```

### Task 2: Build and test immutable deliverable contexts

**Files:**
- Create: `apps/server/src/deliverable-codex/DeliverableCodexContextService.ts`
- Create: `apps/server/test/deliverable-codex-context-service.test.ts`
- Modify: `apps/server/src/ai-tasks/DeliverableTaskContextService.ts` only if a narrowly reusable safe helper is needed

**Step 1: Write failing context tests.**

Use a minimal `ProjectManagementRepo` fake with one deliverable. Assert the mode package contains the stable IDs and deliverable folder/path, that task mode includes objectives/acceptance criteria and explicit writeback instructions, and that free/bug packages explicitly prohibit writeback tools.

```ts
expect(task.systemInstruction).toContain("only write back when the user explicitly asks");
expect(free.allowedMcpTools).not.toContain("rich_task_report_result");
expect(bug.systemInstruction).toContain("reproduction");
```

**Step 2: Run the focused test and verify it fails.**

Run: `pnpm --filter server test -- deliverable-codex-context-service.test.ts`

Expected: FAIL because the context service is absent.

**Step 3: Implement the minimum context builder.**

Expose `build({ projectId, deliverableId, mode })`, which loads the deliverable from `listAllModuleItems(projectId, "deliverables")`, normalizes it using `normalizeDeliverableContent`, and returns:

```ts
{
  scopeKey: `deliverable:${projectId}:${deliverableId}`,
  contextVersion: sha256(JSON.stringify(stableContext)),
  systemInstruction: string,
  initialContext: string,
  allowedMcpTools: string[],
  workspaceRoot?: string,
}
```

Keep the initial context bounded: title, immutable IDs, plain-text description/records, folder path, relevant file metadata, and mode contract. Do not dump all file contents or every project record into the prompt. For bug mode, add diagnosis/expected-result guidance; for task mode, include the existing deliverable result-report tool contract and the explicit-user-request rule.

**Step 4: Run focused tests and typecheck.**

Run: `pnpm --filter server test -- deliverable-codex-context-service.test.ts && pnpm --filter server typecheck`

Expected: PASS.

**Step 5: Commit.**

```bash
git add apps/server/src/deliverable-codex/DeliverableCodexContextService.ts apps/server/src/ai-tasks/DeliverableTaskContextService.ts apps/server/test/deliverable-codex-context-service.test.ts
git commit -m "feat: build deliverable codex mode contexts"
```

### Task 3: Add the Codex App Server runtime

**Files:**
- Create: `apps/server/src/agent-conversations/CodexAppServerRuntime.ts`
- Create: `apps/server/test/codex-app-server-runtime.test.ts`
- Modify: `apps/server/src/agent-conversations/AgentRuntimePort.ts`
- Modify: `apps/server/src/ai/codex.ts` to export/reuse the tested binary resolver rather than duplicating binary discovery

**Step 1: Write a fake JSONL app-server test harness.**

Inject a process factory into `CodexAppServerRuntime`; use an in-memory duplex fake rather than the real CLI. Test that it sends `initialize`, `initialized`, then `thread/start`/`thread/resume` and `turn/start`; test that `item/agentMessage/delta`, tool progress, `turn/completed`, stale-thread errors, and `turn/interrupt` map to `AgentRuntimeEvent` values.

**Step 2: Run it and verify it fails.**

Run: `pnpm --filter server test -- codex-app-server-runtime.test.ts`

Expected: FAIL because no App Server runtime exists.

**Step 3: Implement a line-oriented JSON-RPC client.**

Spawn `codex app-server --listen stdio://` with `stdin/stdout` pipes. Serialize one JSON object per line, correlate responses by id, and expose a singleton process owned by the Rich server. Initialize once with `clientInfo: { name: "rich", title: "Rich", version }`; start/resume a native thread per Rich conversation and retain its thread id.

Map the stable app-server notifications to existing events:

```ts
item/agentMessage/delta -> { type: "delta", text }
item/started|item/completed -> tool/progress event when applicable
turn/completed -> { type: "done", fullText, sessionId: threadId }
```

Add `interrupt(threadId)` to `AgentRuntimePort` and call App Server `turn/interrupt`. Keep the transport on stdio; do not expose a WebSocket listener. Do not use `codex exec` for this interactive runtime.

**Step 4: Make tool exposure mode-aware.**

Pass the selected MCP server/tool policy when starting each thread. The implementation must not rely only on a prompt to hide writeback: free and bug threads must receive no writeback MCP capability; task threads receive only the scoped Rich task-result/report tools. If the current App Server configuration surface cannot apply an isolated per-thread MCP policy, stop this task and document the protocol constraint before exposing any write capability.

**Step 5: Run tests and typecheck.**

Run: `pnpm --filter server test -- codex-app-server-runtime.test.ts apps/server/test/agent-conversation-service.test.ts && pnpm --filter server typecheck`

Expected: PASS.

**Step 6: Commit.**

```bash
git add apps/server/src/agent-conversations/CodexAppServerRuntime.ts apps/server/src/agent-conversations/AgentRuntimePort.ts apps/server/src/ai/codex.ts apps/server/test/codex-app-server-runtime.test.ts
git commit -m "feat: run interactive codex app server conversations"
```

### Task 4: Generalize the durable conversation service for Codex workbench sessions

**Files:**
- Modify: `apps/server/src/repos/AgentConversationConfigRepo.ts`
- Modify: `apps/server/src/repos/SqliteAgentConversationConfigRepo.ts`
- Modify: `apps/server/src/repos/PostgresAgentConversationConfigRepo.ts`
- Modify: `apps/server/src/agent-conversations/AgentConversationService.ts`
- Modify: `apps/server/src/agent-conversations/types.ts`
- Test: `apps/server/test/agent-conversation-service.test.ts`
- Test: `apps/server/test/agent-conversation-config-repo.test.ts`

**Step 1: Add failing tests for a Codex-configured session.**

Extend the test fake to accept executor `codex`, mode-owned system instruction, and a task-mode writeback tool list. Assert a saved Codex native thread is reused; assert independent conversations can run turns concurrently; assert a free-mode runtime cannot receive a writeback tool event.

**Step 2: Run focused tests and verify failure.**

Run: `pnpm --filter server test -- agent-conversation-service.test.ts agent-conversation-config-repo.test.ts`

Expected: FAIL because config restricts executor to `hermes` and has no per-workbench policy.

**Step 3: Implement the smallest generalization.**

Change `executor` to `"hermes" | "codex"`, keep old rows valid, and add optional immutable session fields necessary to pass the context builder result: `systemInstruction`, `mode`, and `allowedMcpServers`/tool policy. Do not alter the home session behavior. Modify `sendMessage` to prepend the stored mode instruction and only add a context refresh when the stored `contextVersion` changed.

Keep all existing turn lease, idempotency, summary, stale-session retry, and transcript persistence rules intact. Add an explicit runtime lookup keyed by executor rather than instantiating Hermes unconditionally in `buildApp`.

**Step 4: Run focused tests and typecheck.**

Run: `pnpm --filter server test -- agent-conversation-service.test.ts agent-conversation-config-repo.test.ts && pnpm --filter server typecheck`

Expected: PASS, including pre-existing Hermes tests.

**Step 5: Commit.**

```bash
git add apps/server/src/repos/AgentConversationConfigRepo.ts apps/server/src/repos/SqliteAgentConversationConfigRepo.ts apps/server/src/repos/PostgresAgentConversationConfigRepo.ts apps/server/src/agent-conversations/AgentConversationService.ts apps/server/src/agent-conversations/types.ts apps/server/test/agent-conversation-service.test.ts apps/server/test/agent-conversation-config-repo.test.ts
git commit -m "feat: support codex durable agent sessions"
```

### Task 5: Expose deliverable workbench routes and writeback status

**Files:**
- Create: `apps/server/src/routes/deliverableCodexConversations.ts`
- Create: `apps/server/test/deliverable-codex-conversation-routes.test.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/src/mcp-v2/tasks/deliverableTaskTools.ts`

**Step 1: Write route tests.**

Test list/create/activate/archive/stream routes with an in-memory repo and fake runtime. Verify project-deliverable ownership is checked, `mode` rejects values outside free/task/bug, creation defaults executor to Codex, archived sessions disappear from the list, and sending a message yields normal SSE `turn`, `text`, `tool`, `done`, and `error` events.

For task-mode writeback, assert the request context includes conversation and deliverable correlations. For free and bug, assert `rich_task_report_result` is unavailable before model execution.

**Step 2: Run it and verify failure.**

Run: `pnpm --filter server test -- deliverable-codex-conversation-routes.test.ts`

Expected: FAIL because routes do not exist.

**Step 3: Implement routes and wire dependencies in `buildApp`.**

Mount an independent route module under `/api/projects`:

```text
GET  /:projectId/deliverables/:deliverableId/codex-conversations
POST /:projectId/deliverables/:deliverableId/codex-conversations
POST /codex-conversations/:id/activate
POST /codex-conversations/:id/archive
POST /codex-conversations/:id/stream
```

Creation must create the standard `chat_conversations` transcript row, the new scope row, the generalized Agent config, and then return the durable conversation metadata. Do not start a native thread until the first message. Archive both the scope row and its Agent/chat session; call native thread archive only when a native id exists.

Extend the existing deliverable writeback tool input with optional `conversationId` and `turnId`, preserve them in the result metadata/status event, and keep current `ai_task_result` idempotency behavior unchanged.

**Step 4: Run routes and full server suite.**

Run: `pnpm --filter server test -- deliverable-codex-conversation-routes.test.ts && pnpm --filter server test && pnpm --filter server typecheck`

Expected: PASS.

**Step 5: Commit.**

```bash
git add apps/server/src/routes/deliverableCodexConversations.ts apps/server/src/index.ts apps/server/src/mcp-v2/tasks/deliverableTaskTools.ts apps/server/test/deliverable-codex-conversation-routes.test.ts
git commit -m "feat: add deliverable codex conversation api"
```

### Task 6: Implement the deliverable Codex workbench UI

**Files:**
- Create: `apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.tsx`
- Create: `apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.test.ts`
- Modify: `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.tsx`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/views/ProjectsView.css`

**Step 1: Add failing UI/model contract tests.**

Use source-level tests consistent with the existing workspace suite. Assert a topmost tab strip, no tab close button, archive action, `+` new-window popover, immutable mode badge, Codex-only label, inline transcript/tool events, and a page-level open trigger. Assert free/bug/task mode selection exists only in the new-window popover.

**Step 2: Run the focused test and verify it fails.**

Run: `pnpm --filter web test -- DeliverableCodexWorkbench.test.ts`

Expected: FAIL because the workbench component is absent.

**Step 3: Add typed API client methods.**

Add `DeliverableCodexConversation` and methods for list/create/activate/archive plus an SSE parser that preserves event names rather than collapsing all events into generic text. Use one request id and user message id per submit; keep the selected tab’s pending state local so other tabs remain switchable.

**Step 4: Build the modal and integrate it into `DeliverablesWorkspace`.**

The workbench must:

- load active conversations when opened and select the latest active one;
- render title tabs as the first row, ordered by last activation;
- show a fixed mode badge and `Codex` executor; no close icon;
- create from a compact popover containing title + free/task/bug selection and `创建后不可切换`;
- archive only by explicit archive action, then select the next active tab or empty state;
- fetch the selected transcript and render streamed text/tool/error events in the broad central chat area;
- show the project/deliverable breadcrumb and connection state beneath the tabs;
- leave no context sidebar and no in-chat approval controls.

Use `aria-modal`, focus trapping, Escape to close the overlay only, and visible loading/error states. Do not allow mode changes after creation.

**Step 5: Run focused UI checks.**

Run: `pnpm --filter web test -- DeliverableCodexWorkbench.test.ts DeliverablesWorkspace.test.ts && pnpm --filter web typecheck`

Expected: PASS.

**Step 6: Commit.**

```bash
git add apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.tsx apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.test.ts apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.tsx apps/web/src/api/client.ts apps/web/src/views/ProjectsView.css
git commit -m "feat: add deliverable codex workbench"
```

### Task 7: Add the Rich-window `⌘ Space` toggle

**Files:**
- Create: `apps/web/src/hooks/useRichWorkbenchShortcut.ts`
- Create: `apps/web/src/hooks/useRichWorkbenchShortcut.test.ts`
- Modify: `apps/web/src/views/ProjectWorkspace.tsx`
- Modify: `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.tsx`

**Step 1: Write keyboard tests.**

Test that `metaKey + Space` calls `preventDefault()` and toggles open/closed while the application is focused, including from an input/textarea/contenteditable target. Test that plain Space and Ctrl+Space do nothing. Test that a non-deliverable scope produces the explicit unavailable state, not a guessed conversation.

**Step 2: Run it and verify failure.**

Run: `pnpm --filter web test -- useRichWorkbenchShortcut.test.ts`

Expected: FAIL because the hook is absent.

**Step 3: Implement one app-level capture listener.**

Mount the hook at `ProjectWorkspace` so it sees every project-management section. On `keydown`, require `event.metaKey && event.code === "Space"`, prevent default, and toggle the workbench. Pass an explicit page scope descriptor from `DeliverablesWorkspace`; unsupported sections return `{ supported: false }` and render the defined unavailable-state overlay.

Do not install browser-wide handlers outside the mounted Rich app. Do not use `globalShortcut`, Electron APIs, or attempt to override Spotlight.

**Step 4: Run focused tests and typecheck.**

Run: `pnpm --filter web test -- useRichWorkbenchShortcut.test.ts DeliverableCodexWorkbench.test.ts && pnpm --filter web typecheck`

Expected: PASS.

**Step 5: Commit.**

```bash
git add apps/web/src/hooks/useRichWorkbenchShortcut.ts apps/web/src/hooks/useRichWorkbenchShortcut.test.ts apps/web/src/views/ProjectWorkspace.tsx apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.tsx
git commit -m "feat: toggle codex workbench with command space"
```

### Task 8: End-to-end verification and documentation refresh

**Files:**
- Modify: `docs/plans/2026-09-02-deliverable-codex-conversation-workbench-design.md` only for differences discovered during implementation
- Test: `apps/server/test/agent-conversation-e2e.test.ts`
- Test: `apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.test.ts`

**Step 1: Add an e2e-style server test with the fake app-server runtime.**

Cover: create two task-mode conversations for the same deliverable; start a turn in each; archive one; reopen/list and confirm the other is restored; create free and bug conversations and prove writeback is blocked; explicitly request task-mode writeback and assert one correlated deliverable result projection appears.

**Step 2: Run the test and verify it fails before final wiring, then passes after completion.**

Run: `pnpm --filter server test -- agent-conversation-e2e.test.ts && pnpm --filter web test -- DeliverableCodexWorkbench.test.ts`

Expected: PASS after Tasks 1–7.

**Step 3: Run the full verification set.**

Run:

```bash
pnpm --filter server test
pnpm --filter server typecheck
pnpm --filter web test
pnpm --filter web typecheck
git diff --check
```

Expected: all commands exit 0. Manually verify `⌘ Space` in an active Rich window opens the workbench, the second press hides it, and macOS Spotlight still works when Rich is not focused.

**Step 4: Commit.**

```bash
git add docs/plans/2026-09-02-deliverable-codex-conversation-workbench-design.md apps/server/test/agent-conversation-e2e.test.ts apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.test.ts
git commit -m "test: verify deliverable codex workbench"
```
