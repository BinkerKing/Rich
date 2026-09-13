# AI Task Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone, scene-driven AI Task Management module that Codex App MCP clients can claim and complete with concise result nodes.

**Architecture:** Add a dedicated task aggregate (`ai_tasks`, `ai_task_nodes`, `ai_task_resources`) with SQLite and PostgreSQL repositories. A service owns validation, task packets, atomic claims, result nodes, continuation, review, and legacy system-improvement migration. REST routes power the separate UI while MCP tools expose the same service to Codex App.

**Tech Stack:** TypeScript, Hono, Zod, better-sqlite3, PostgreSQL, React, Vitest, MCP SDK.

---

### Task 1: Define scene-driven AI task domain and persistence

**Files:**
- Create: `apps/server/src/ai-task-management/types.ts`
- Create: `apps/server/src/ai-task-management/scenes.ts`
- Create: `apps/server/src/repos/AiTaskManagementRepo.ts`
- Create: `apps/server/src/repos/SqliteAiTaskManagementRepo.ts`
- Create: `apps/server/src/repos/PostgresAiTaskManagementRepo.ts`
- Modify: `apps/server/src/db/sqlite.ts`
- Modify: `apps/server/src/db/postgres.ts`
- Test: `apps/server/test/ai-task-management-repo.test.ts`

1. Write failing repository tests for create/list/get, atomic claim and node persistence.
2. Run the test and verify the expected missing-module failure.
3. Add the minimal domain, schema tables, SQLite repository, then PostgreSQL repository.
4. Re-run the repository tests and typecheck.
5. Commit the persistence layer.

### Task 2: Add task service, concise context inheritance and review lifecycle

**Files:**
- Create: `apps/server/src/ai-task-management/service.ts`
- Test: `apps/server/test/ai-task-management-service.test.ts`

1. Write failing tests for scene validation, task packet redaction, result nodes, continuation inheritance and resolve/review behavior.
2. Run the test and verify failure.
3. Implement only the service methods exercised by the tests.
4. Run the service and repository tests.
5. Commit the service layer.

### Task 3: Expose REST and MCP APIs

**Files:**
- Create: `apps/server/src/routes/aiTaskManagement.ts`
- Create: `apps/server/src/mcp-v2/tasks/aiTaskManagementTools.ts`
- Modify: `apps/server/src/mcp-v2/server.ts`
- Modify: `apps/server/src/index.ts`
- Test: `apps/server/test/ai-task-management-mcp.test.ts`

1. Write failing MCP tests for list, claim, get packet, report result and create continuation.
2. Run the test and verify failure.
3. Register REST and MCP adapters over the service; do not add dispatch or polling.
4. Run targeted tests and server typecheck.
5. Commit the API layer.

### Task 4: Migrate system-improvement records into the unified model

**Files:**
- Create: `apps/server/src/ai-task-management/improvementMigration.ts`
- Modify: `apps/server/src/index.ts`
- Test: `apps/server/test/ai-task-management-improvement-migration.test.ts`

1. Write a failing test that maps legacy reason, PRD, files and verifications to a `system_improvement` task and result nodes idempotently.
2. Run it and verify failure.
3. Implement the migration and one-way compatibility strategy.
4. Run migration tests and repository tests.
5. Commit migration support.

### Task 5: Build the standalone AI Task Management UI

**Files:**
- Create: `apps/web/src/views/AiTaskManagementView.tsx`
- Create: `apps/web/src/views/AiTaskManagementView.css`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/state/store.ts`
- Modify: `apps/web/src/api/client.ts`
- Test: `apps/web/src/views/AiTaskManagementView.test.ts`

1. Write failing view tests for status filters, concise node rendering and Review actions.
2. Run them and verify failure.
3. Implement the standalone dark, sparse management page; do not import TaskWorkbench components.
4. Run the UI tests, typecheck and build.
5. Commit the UI.

### Task 6: Add Codex slash submission flows

**Files:**
- Modify: `apps/web/src/lib/codexSlashTools.ts`
- Modify: `apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.tsx`
- Modify: `apps/web/src/lib/codexLocationContext.ts`
- Test: `apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.test.ts`

1. Write failing tests for `/bug`, `/需求` and `/项目` task creation intents.
2. Run them and verify failure.
3. Implement `/bug` contextual screenshot submission, `/需求` submission, and project-deliverable selection without requiring navigation to the deliverable page.
4. Run targeted tests, full typecheck and build.
5. Commit the submission flows.

### Task 7: Validate, publish and document

**Files:**
- Modify: `docs/RICH_MCP_V2_CATALOG.md`
- Modify: `docs/RICH_CLI_COVERAGE.md`

1. Run the full test suite, server and web typechecks, and production build.
2. Verify task management REST and MCP behavior against a temporary SQLite database.
3. Update MCP and UI documentation.
4. Commit all verified changes.
5. Rebuild and republish the desktop App, restart it, and retain only `/Applications/Rich.app` as specified by the saved user preference.
