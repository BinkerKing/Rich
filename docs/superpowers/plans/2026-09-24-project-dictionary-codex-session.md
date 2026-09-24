# Project Dictionary Codex Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind each project's data dictionary to one durable Codex Session, recreate it after archive, and expose it from the data-dictionary tree header.

**Architecture:** Keep dictionary bindings in their own schema, repository, context service, and `/api/project-dictionary-codex` routes. Reuse only shared chat persistence, the Codex runtime, and the existing conversation drawer after extending that drawer with a `dictionary` resource type.

**Tech Stack:** TypeScript, Hono, SQLite/PostgreSQL, React 18, Vitest, Node test runner.

---

### Task 1: Persist a single bound dictionary conversation

**Files:**
- Create: `apps/server/src/repos/ProjectDictionaryCodexConversationRepo.ts`
- Create: `apps/server/src/repos/SqliteProjectDictionaryCodexConversationRepo.ts`
- Create: `apps/server/src/repos/PostgresProjectDictionaryCodexConversationRepo.ts`
- Create: `apps/server/test/project-dictionary-codex-conversation-repo.test.ts`
- Modify: `apps/server/src/db/sqlite.ts`
- Modify: `apps/server/src/db/postgres.ts`

- [ ] **Step 1: Write the failing repository test**

```ts
it("clears the binding when the active dictionary conversation is archived", async () => {
  await repo.create(conversation("first"));
  await repo.bind("first", "2026-09-24T00:01:00.000Z");
  await repo.archive("first", "2026-09-24T00:02:00.000Z");
  expect(await repo.getBound("project-1")).toBeNull();
  expect(await repo.get("first")).toMatchObject({ isBound: false, status: "archived" });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @ke/server test -- project-dictionary-codex-conversation-repo.test.ts`

Expected: FAIL because the dedicated repository is absent.

- [ ] **Step 3: Add the dedicated schema and repositories**

Create `project_dictionary_codex_conversations` with `project_id`, `conversation_id`, `title`, `codex_thread_id`, `status`, `is_bound`, and timestamps. Add a partial unique index for `project_id` where `status = 'active' AND is_bound = true`. Implement `create`, `get`, `listActive`, `getBound`, `bind`, `archive`, `touch`, and `setCodexThread`; binding must clear any earlier binding transactionally.

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @ke/server test -- project-dictionary-codex-conversation-repo.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/server/src/db/sqlite.ts apps/server/src/db/postgres.ts apps/server/src/repos/ProjectDictionaryCodexConversationRepo.ts apps/server/src/repos/SqliteProjectDictionaryCodexConversationRepo.ts apps/server/src/repos/PostgresProjectDictionaryCodexConversationRepo.ts apps/server/test/project-dictionary-codex-conversation-repo.test.ts && git commit -m "feat: persist project dictionary Codex sessions"`

### Task 2: Build dictionary context and independent binding API

**Files:**
- Create: `apps/server/src/project-dictionary-codex/DictionaryCodexContextService.ts`
- Create: `apps/server/src/routes/projectDictionaryCodex.ts`
- Create: `apps/server/test/project-dictionary-codex-routes.test.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Write failing route tests**

```ts
it("creates a named bound Session when a project has none", async () => {
  const response = await app.request("/project-1/conversations/ensure-bound", { method: "POST" });
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ created: true, conversation: { projectId: "project-1", isBound: true, title: "支付项目 · 数据字典 · Codex" } });
});
it("creates a replacement Session after the previous binding is archived", async () => {
  await app.request("/project-1/conversations/archive-bound", { method: "POST" });
  expect((await app.request("/project-1/conversations/ensure-bound", { method: "POST" })).status).toBe(201);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @ke/server test -- project-dictionary-codex-routes.test.ts`

Expected: FAIL because the independent route is absent.

- [ ] **Step 3: Implement context and route**

The context returns scope `dictionary:<projectId>`, a system instruction requiring `rich_dictionary_manage` before analysis or change, and allowed tools `rich_dictionary_manage`, `rich_project_files_get`, and `rich_project_file_read`. `ensure-bound` obtains the title from the project element, starts Codex with `{ fresh: true, executor: 'codex' }` only for a new row, and returns 200 on reuse or 201 on creation. `archive-bound` archives the binding and exits the runtime.

- [ ] **Step 4: Register the independent route and verify it**

Run: `pnpm --filter @ke/server test -- project-dictionary-codex-routes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/server/src/project-dictionary-codex/DictionaryCodexContextService.ts apps/server/src/routes/projectDictionaryCodex.ts apps/server/src/index.ts apps/server/test/project-dictionary-codex-routes.test.ts && git commit -m "feat: add project dictionary Codex binding api"`

### Task 3: Open the dictionary binding from the workspace

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/views/project-management/DictionaryWorkspace.tsx`
- Modify: `apps/web/src/views/project-management/deliverables/DeliverableCodexLauncher.tsx`
- Modify: `apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.tsx`
- Modify: `apps/web/src/views/ProjectsView.css`
- Modify: `apps/web/src/views/project-management/DictionaryWorkspace.test.ts`
- Modify: `apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.location.test.ts`

- [ ] **Step 1: Write failing UI source tests**

```ts
assert.match(source, /aria-label="Codex 对话" title="Codex 对话" onClick=\{\(\) => void openDictionaryCodexConversation\(\)\}/);
assert.match(source, /api\.ensureProjectDictionaryCodexSession\(project\.id\)/);
assert.match(workbenchSource, /resourceType === "dictionary"[\s\S]*?\/api\/project-dictionary-codex/);
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm --filter @ke/web test -- DictionaryWorkspace.test.ts DeliverableCodexWorkbench.location.test.ts`

Expected: FAIL because the icon and dictionary routing are absent.

- [ ] **Step 3: Implement the narrow UI integration**

Add `ensureProjectDictionaryCodexSession(projectId)` to the client. The new tree-header icon ensures the session and calls `openBoundCodex` with `resourceType: 'dictionary'`, title `<project.title> · 数据字典`, and the returned conversation ID. Extend the launcher and workbench resource unions, select the dictionary API list path, show “项目数据字典” location text, and make only the generic task mode available.

- [ ] **Step 4: Run focused checks**

Run: `pnpm --filter @ke/web test -- DictionaryWorkspace.test.ts DeliverableCodexWorkbench.location.test.ts && pnpm --filter @ke/web run build`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/web/src/api/client.ts apps/web/src/views/project-management/DictionaryWorkspace.tsx apps/web/src/views/project-management/deliverables/DeliverableCodexLauncher.tsx apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.tsx apps/web/src/views/ProjectsView.css apps/web/src/views/project-management/DictionaryWorkspace.test.ts apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.location.test.ts && git commit -m "feat: open project dictionary Codex session"`

### Task 4: Verify the integrated change

**Files:**
- Modify: `docs/superpowers/plans/2026-09-24-project-dictionary-codex-session.md`

- [ ] **Step 1: Run server checks**

Run: `pnpm --filter @ke/server test -- project-dictionary-codex-conversation-repo.test.ts project-dictionary-codex-routes.test.ts && pnpm --filter @ke/server typecheck`

Expected: PASS.

- [ ] **Step 2: Run web checks**

Run: `pnpm --filter @ke/web test -- DictionaryWorkspace.test.ts DeliverableCodexWorkbench.location.test.ts && pnpm --filter @ke/web run build`

Expected: PASS.

- [ ] **Step 3: Mark completed steps and commit the plan update**

Run: `git add docs/superpowers/plans/2026-09-24-project-dictionary-codex-session.md && git commit -m "docs: verify project dictionary Codex session plan"`
