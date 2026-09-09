# Standalone Flowcharts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make flowcharts a standalone Rich application whose graph data has a dedicated ID and table, while projects retain their own references to flowchart IDs.

**Architecture:** Add a `flowcharts` persistence boundary and HTTP API independent of project-management module items. Reuse the current React Flow editor through a data-source abstraction; mount it in a standalone list-to-fullscreen application patterned after Deep Workbench. Project data owns an ordered `flowchartIds` reference list, so binding or unbinding affects only the project.

**Tech Stack:** TypeScript, Hono, SQLite/PostgreSQL, React, Zustand, React Flow, Vitest.

---

### Task 1: Standalone flowchart persistence and API

**Files:**
- Modify: `apps/server/src/db/sqlite.ts`
- Modify: `apps/server/src/db/postgres.ts`
- Create: `apps/server/src/flowcharts/repository.ts`
- Create: `apps/server/src/flowcharts/service.ts`
- Create: `apps/server/src/routes/flowcharts.ts`
- Modify: `apps/server/src/index.ts`
- Test: `apps/server/test/flowcharts.test.ts`

- [ ] **Step 1: Write failing repository/API tests** for create, list, update, and delete of a graph with an independent UUID.
- [ ] **Step 2: Run the focused server test** and confirm it fails because standalone flowchart storage does not exist.
- [ ] **Step 3: Add the `flowcharts` table** with `id`, `title`, `graph_json`, `created_at`, and `updated_at` in both database initializers.
- [ ] **Step 4: Implement the repository, service, and `/api/flowcharts` CRUD routes** using the same graph payload shape as the current editor.
- [ ] **Step 5: Run the focused server test** and confirm it passes.

### Task 2: Flowchart application and reusable editor data source

**Files:**
- Modify: `apps/web/src/views/project-management/flowcharts/FlowchartsWorkspace.tsx`
- Create: `apps/web/src/views/FlowchartsView.tsx`
- Create: `apps/web/src/views/FlowchartsView.test.tsx`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/state/store.ts`
- Modify: `apps/web/src/lib/appCatalog.ts`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Write a failing UI test** showing the independent flowchart list and a new chart action.
- [ ] **Step 2: Run the focused web test** and confirm it fails because the standalone application is unavailable.
- [ ] **Step 3: Extract the graph editor’s persistence operations behind a small source interface** so the project screen and application reuse the same React Flow canvas.
- [ ] **Step 4: Build `FlowchartsView`** with a Deep-Workbench-style chart list and full-screen editor, backed by `/api/flowcharts`.
- [ ] **Step 5: Register the `flowcharts` application view and launcher card** and run the focused web test until it passes.

### Task 3: Project-owned flowchart references

**Files:**
- Modify: `apps/server/src/repos/ProjectManagementRepo.ts`
- Modify: `apps/server/src/repos/SqliteProjectManagementRepo.ts`
- Modify: `apps/server/src/repos/PostgresProjectManagementRepo.ts`
- Modify: `apps/server/src/routes/projectManagement.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/views/ProjectWorkspace.tsx`
- Test: `apps/server/test/projectFlowcharts.test.ts`
- Test: `apps/web/src/views/ProjectWorkspace.test.ts`

- [ ] **Step 1: Write failing tests** for a project saving and retrieving its ordered `flowchartIds` without copying graph JSON.
- [ ] **Step 2: Run those focused tests** and confirm they fail for the missing project reference contract.
- [ ] **Step 3: Add project-level read/write operations for `flowchartIds`** and render the project’s references with the shared graph editor.
- [ ] **Step 4: Preserve existing module-item reads as compatibility-only data** so existing project charts remain visible during the transition.
- [ ] **Step 5: Run focused server and web tests** and confirm they pass.

### Task 4: Verification and desktop release

**Files:**
- No product-code files beyond the tasks above.

- [ ] **Step 1: Run targeted tests, typecheck, and build.**
- [ ] **Step 2: Inspect the final diff** to confirm only standalone-flowchart and direct integration files changed.
- [ ] **Step 3: Commit only this feature’s files.**
- [ ] **Step 4: Rebuild, republish, and restart `/Applications/Rich.app`** according to the saved Rich preference.
